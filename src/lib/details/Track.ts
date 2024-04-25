import { ITrack } from '../../typings'

export default class TrackDetails implements ITrack {
    constructor(
        public name = '',
        public artists: string[] = [],
        public album_name = '',
        public release_date = '',
        public cover_url = '',
        public track_number = 0,
        public youtube_url: string | null = null
    ) {}
}

export interface ITrackDetails {
    name: string
    artists: string[]
    album_name: string
    release_date: string
    cover_url: string
    track_number: number,
    youtube_url?: string | null,
}