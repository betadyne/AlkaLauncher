// Re-export types from auto-generated bindings
// This file maintains backward compatibility while using specta-generated types

export type {
    GameMetadata as Game,
    VndbImage,
    VndbSearchResult,
    VndbTag,
    VndbProducer,
    VndbVnDetail,
    VndbTrait,
    VndbCharacterVn,
    VndbCharacter,
    VndbUserListItem,
    VndbLabel,
    VndbAuthInfo,
    AppSettings,
    DailyPlaytimeData,
} from "./bindings";

export interface GameExitedPayload {
    game_id: string;
    play_minutes: number;
}
