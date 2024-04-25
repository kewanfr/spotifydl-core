import { promises, unlink } from 'fs-extra'
import SpotifyApi, { IAuth, UserObjectPublic } from './lib/API'
import Artist from './lib/details/Atrist'
import Playlist from './lib/details/Playlist'
import SongDetails, { ITrackDetails } from './lib/details/Track'
import { downloadYT, downloadYTAndSave } from './lib/download'
import SpotifyDlError from './lib/Error'
import getYtlink from './lib/getYtlink'
import https from 'https'
import NodeID3 from 'node-id3'

import fs from 'fs'
import { promisify } from 'util'
const readFileAsync = promisify(fs.readFile)

export default class SpotifyFetcher extends SpotifyApi {
    constructor(auth: IAuth, ytCookie?: string) {
        super(auth, ytCookie || '')

    }

    /**
     * Get the track details of the given track URL
     * @param url
     * @returns {SongDetails} Track
     */
    getTrack = async (url: string): Promise<SongDetails> => {
        await this.verifyCredentials()
        return await this.extractTrack(this.getID(url))
    }

    /**
     * Gets the info the given album URL
     * @param url
     * @returns {Playlist} Album
     */
    getAlbum = async (url: string): Promise<Playlist> => {
        await this.verifyCredentials()
        return await this.extractAlbum(this.getID(url))
    }

    /**
     * Gets the info of the given Artist URL
     * @param url
     * @returns {Artist} Artist
     */
    getArtist = async (url: string): Promise<Artist> => {
        await this.verifyCredentials()
        return await this.extractArtist(this.getID(url))
    }

    /**
     * Gets the list of albums from the given Artists URL
     * @param url
     * @returns {Playlist[]} Albums
     */
    getArtistAlbums = async (
        url: string
    ): Promise<{
        albums: Playlist[]
        artist: Artist
    }> => {
        await this.verifyCredentials()
        const artistResult = await this.getArtist(url)
        const albumsResult = await this.extractArtistAlbums(artistResult.id)
        const albumIds = albumsResult.map((album) => album.id)
        const albumInfos = []
        for (let x = 0; x < albumIds.length; x++) {
            albumInfos.push(await this.extractAlbum(albumIds[x]))
        }
        return {
            albums: albumInfos,
            artist: artistResult
        }
    }

    /**
     * Gets the playlist info from URL
     * @param url URL of the playlist
     * @returns
     */
    getPlaylist = async (url: string): Promise<Playlist> => {
        await this.verifyCredentials()
        return await this.extractPlaylist(this.getID(url))
    }

    getID = (url: string): string => {
        const splits = url.split('/')
        return splits[splits.length - 1]
    }

    downloadImage = async <T extends undefined | string>(
        url: string,
        filename = (Math.random() + 1).toString(36).substring(7) + '.jpg'
    ): Promise<T extends undefined ? Buffer : string> => {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                const chunks: Buffer[] = []
                res.on('data', (chunk) => {
                    chunks.push(chunk)
                })
                res.on('end', async () => {
                    const buffer = Buffer.concat(chunks)
                    if (!filename) {
                        resolve(buffer as any)
                    } else {
                        await promises.writeFile(filename, buffer)
                        resolve(filename as any)
                    }
                })
                res.on('error', (err) => reject(err))
            })
        })
    }

    /**
     * Get the buffer of the file (image) from the given URL
     * @param url
     * @returns
     */
    getBufferFromUrl = async (url: string): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                const chunks: Buffer[] = []
                res.on('data', (chunk) => {
                    chunks.push(chunk)
                })
                res.on('end', async () => {
                    const buffer = Buffer.concat(chunks)
                    resolve(buffer)
                })
                res.on('error', (err) => reject(err))
            })
        })
    }

    /**
     * Tag the given mp3 file with cover image and metadata
     * @param fileName mp3 fileName to tag
     * @param coverUrl cover image to tag
     * @param info metadata to tag
     * @returns `Promise<string>` file
     */
    tagMp3 = async (fileName: string, info: SongDetails | ITrackDetails): Promise<string> => {
        const mp3Buffer = await readFileAsync(fileName)
        const imageBuffer = await this.getBufferFromUrl(info.cover_url)
        const tags = await NodeID3.read(mp3Buffer)

        // Add cover image to mp3File
        tags.image = {
            mime: 'image/jpeg',
            type: {
                id: 3,
                name: 'front cover'
            },
            description: 'Cover',
            imageBuffer: imageBuffer
        }

        tags.trackNumber = info.track_number.toString()
        tags.title = info.name
        tags.album = info.album_name
        tags.artist = info.artists.join('/')
        tags.performerInfo = info.artists[0]
        tags.recordingTime = info.release_date

        try {
            const taggedMp3Data = await NodeID3.write(tags, mp3Buffer)
            await promises.writeFile(fileName, taggedMp3Data)
        } catch (err) {
            console.error('Error updating tags', err)
        }

        return fileName
    }

    /**
     * Downloads the given spotify track
     * @param url Url to download
     * @param filename file to save to
     * @returns `buffer` if no filename is provided and `string` if it is
     */
    downloadTrack = async <T extends undefined | string>(
        url: string,
        filename?: undefined | string
    ): Promise<T extends undefined ? Buffer : string> => {
        await this.verifyCredentials()
        const info = await this.getTrack(url)
        return await this.downloadTrackFromInfo(info, filename)
    }

    /**
     * Gets the Buffer of track from the info
     * @param info info of the track got from `spotify.getTrack()`
     * @returns
     */
    downloadTrackFromInfo = async <T extends undefined | string>(
        info: SongDetails | ITrackDetails,
        filename?: undefined | string
    ): Promise<T extends undefined ? Buffer : string> => {
        const yt_link = info.youtube_url ?? (await getYtlink(`${info.name} ${info.artists.join(' ')}`))
        // const link = await getYtlink(`${info.name} ${info.artists.join(' ')}`)
        console.log(yt_link)
        if (!yt_link) throw new SpotifyDlError(`Couldn't get a download URL for the track: ${info.name}`)
        const resultFilename = await downloadYTAndSave(
            yt_link,
            filename ?? (Math.random() + 1).toString(36).substring(7) + '.mp3',
            this.yt_cookie
        )

        // Tag metadata
        await this.tagMp3(resultFilename, info)

        if (!resultFilename) {
            return false as any
        }

        if (!filename) {
            const buffer = await readFileAsync(resultFilename)
            await unlink(resultFilename)
            return buffer as any
        }
        return resultFilename as any

        // const link = await getYtlink(`${info.name} ${info.artists[0]}`)
        // if (!link) throw new SpotifyDlError(`Couldn't get a download URL for the track: ${info.name}`)
        // return await downloadYT(link)
    }

    private downloadBatch = async (url: string, type: 'album' | 'playlist'): Promise<(string | Buffer)[]> => {
        await this.verifyCredentials()
        const playlist = await this[type === 'album' ? 'getAlbum' : 'getPlaylist'](url)
        return Promise.all(
            playlist.tracks.map(async (track) => {
                try {
                    return await this.downloadTrack(track)
                } catch (err) {
                    return ''
                }
            })
        )
    }

    /**
     * Downloads the tracks of a playlist
     * @param url URL of the playlist
     * @returns `Promise<(string|Buffer)[]>`
     */
    downloadPlaylist = async (url: string): Promise<(string | Buffer)[]> => await this.downloadBatch(url, 'playlist')

    /**
     * Downloads the tracks of a Album
     * @param url URL of the Album
     * @returns `Promise<(string|Buffer)[]>`
     */
    downloadAlbum = async (url: string): Promise<(string | Buffer)[]> => await this.downloadBatch(url, 'album')

    /**
     * Gets the info of tracks from playlist URL
     * @param url URL of the playlist
     */
    getTracksFromPlaylist = async (
        url: string
    ): Promise<{ name: string; total_tracks: number; tracks: SongDetails[] | ITrackDetails[] }> => {
        await this.verifyCredentials()
        const playlist = await this.getPlaylist(url)
        const tracks = await Promise.all(playlist.tracks.map((track) => this.getTrack(track)))
        return {
            name: playlist.name,
            total_tracks: playlist.total_tracks,
            tracks
        }
    }

    /**
     * Gets the info of tracks from Album URL
     * @param url URL of the playlist
     */
    getTracksFromAlbum = async (
        url: string
    ): Promise<{ name: string; total_tracks: number; tracks: SongDetails[] | ITrackDetails[] }> => {
        await this.verifyCredentials()
        const playlist = await this.getAlbum(url)
        const tracks = await Promise.all(playlist.tracks.map((track) => this.getTrack(track)))
        return {
            name: playlist.name,
            total_tracks: playlist.total_tracks,
            tracks
        }
    }

    getSpotifyUser = async (id: string): Promise<UserObjectPublic> => await this.getUser(id)
}
