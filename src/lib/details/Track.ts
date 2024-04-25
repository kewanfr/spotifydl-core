import { ITrack } from '../../typings'

export default class TrackDetails implements ITrack {
    constructor(
        // Needed to download
        public name = '',
        public artists: string[] = [],
        public album_name = '',
        public release_date = '',
        public cover_url = '',
        public track_number = 0,

        // Optional
        public spotify_id = '',
        public spotify_url = '',
        public youtube_url = '',
    ) {}
}

export interface ITrackDetails {
    // Needed to download
    name: string
    artists: string[]
    album_name: string
    release_date: string
    cover_url: string
    track_number: number

    // Optional
    spotify_id?: string
    spotify_url?: string
    youtube_url?: string
}