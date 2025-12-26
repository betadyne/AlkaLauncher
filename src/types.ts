// Game and VNDB types

export interface Game {
    id: string;
    title: string;
    path: string;
    vndb_id: string | null;
    cover_url: string | null;
    play_time: number;
    is_finished: boolean;
    last_played: string | null;
}

export interface VndbImage {
    url: string;
    sexual: number;
    violence: number;
}

export interface VndbSearchResult {
    id: string;
    title: string;
    image: VndbImage | null;
    released: string | null;
    rating: number | null;
}

export interface VndbTag {
    id: string;
    name: string;
    rating: number;
    spoiler: number;
}

export interface VndbVnDetail {
    id: string;
    title: string;
    image: VndbImage | null;
    released: string | null;
    rating: number | null;
    description: string | null;
    length: number | null;
    length_minutes: number | null;
    tags: VndbTag[] | null;
}

export interface VndbTrait {
    id: string;
    name: string;
    group_id: string | null;
    group_name: string | null;
    spoiler: number;
}

export interface VndbCharacterVn {
    id: string;
    role: string;
    spoiler: number;
}

export interface VndbCharacter {
    id: string;
    name: string;
    original: string | null;
    aliases: string[] | null;
    image: VndbImage | null;
    description: string | null;
    blood_type: string | null;
    height: number | null;
    weight: number | null;
    bust: number | null;
    waist: number | null;
    hips: number | null;
    cup: string | null;
    age: number | null;
    birthday: number[] | null;
    sex: string[] | null;
    vns: VndbCharacterVn[] | null;
    traits: VndbTrait[] | null;
}

export interface VndbUserListItem {
    id: string;
    vote: number | null;
    labels: { id: number; label: string }[] | null;
}

export interface AppSettings {
    vndb_token: string | null;
    vndb_user_id: string | null;
    blur_nsfw: boolean;
}
