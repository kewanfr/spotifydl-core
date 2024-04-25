import Ffmpeg from 'fluent-ffmpeg'
import { renameSync, unlinkSync } from 'fs'
import { IMetadata, ITrack } from '../typings'

export default async (data: ITrack, file: string): Promise<string> => {
    const outputOptions: string[] = ['-map', '0:0', '-codec', 'copy']
    
    const metadata: IMetadata = {
        title: data.name,
        album: data.album_name,
        artist: data.artists.join('/'),
        album_artist: data.artists[0],
        date: data.release_date,
        track: data.track_number
        //attachments: []
    }

    Object.keys(metadata).forEach((key) => {
        outputOptions.push(
            '-metadata',
            `${String(key)}=${metadata[(key as 'title' | 'artist' | 'date' | 'album' | 'track' | 'album_artist')]}`
        )
    })

    const out = `${file.split('.')[0]}_temp.mp3`
    await new Promise((resolve, reject) => {
        Ffmpeg()
            .input(file)
            .on('error', (err) => {
                reject(err)
            })
            .on('end', () => resolve(file))
            .addOutputOptions(...outputOptions)
            .saveToFile(out)
    })

    unlinkSync(file)
    renameSync(out, file)
    return file

}