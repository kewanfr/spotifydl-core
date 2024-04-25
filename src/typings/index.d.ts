export interface ITrack {
    name: string
    artists: string[]
    album_name: string
    release_date: string
    cover_url: string
    track_number: number
}

export interface IPlaylist {
    name: string
    total_tracks: number
    tracks: string[]
}

export interface IArtist {
    id: string
    name: string
    herf: string
}

export interface IMetadata {
    title: string
    artist: string
    album_artist: string
    album: string
    date: string
    attachments?: string[]
    id3v1?: boolean
    'id3v2.3'?: boolean
    track?: number
}
