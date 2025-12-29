use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GameMetadata {
    pub id: String,
    pub title: String,
    pub path: String,
    pub vndb_id: Option<String>,
    pub cover_url: Option<String>,
    pub play_time: u64,
    pub is_finished: bool,
    #[serde(default)]
    pub last_played: Option<String>,
    #[serde(default)]
    pub is_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
pub struct DailyPlaytimeData {
    pub games: HashMap<String, HashMap<String, u64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbSearchResult {
    pub id: String,
    pub title: String,
    pub image: Option<VndbImage>,
    pub released: Option<String>,
    pub rating: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbImage {
    pub url: String,
    #[serde(default)]
    pub sexual: f64,
    #[serde(default)]
    pub violence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbResponse<T> {
    pub results: Vec<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbVnDetail {
    pub id: String,
    pub title: String,
    pub image: Option<VndbImage>,
    pub released: Option<String>,
    pub rating: Option<f64>,
    pub description: Option<String>,
    pub length: Option<i32>,
    pub length_minutes: Option<i32>,
    pub tags: Option<Vec<VndbTag>>,
    pub developers: Option<Vec<VndbProducer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbTag {
    pub id: String,
    pub name: String,
    pub rating: f64,
    #[serde(default)]
    pub spoiler: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbProducer {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbCharacter {
    pub id: String,
    pub name: String,
    pub original: Option<String>,
    pub aliases: Option<Vec<String>>,
    pub image: Option<VndbImage>,
    pub description: Option<String>,
    pub blood_type: Option<String>,
    pub height: Option<i32>,
    pub weight: Option<i32>,
    pub bust: Option<i32>,
    pub waist: Option<i32>,
    pub hips: Option<i32>,
    pub cup: Option<String>,
    pub age: Option<i32>,
    pub birthday: Option<Vec<i32>>,
    pub sex: Option<Vec<String>>,
    pub vns: Option<Vec<VndbCharacterVn>>,
    pub traits: Option<Vec<VndbTrait>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbTrait {
    pub id: String,
    pub name: String,
    pub group_id: Option<String>,
    pub group_name: Option<String>,
    #[serde(default)]
    pub spoiler: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbCharacterVn {
    pub id: String,
    pub role: String,
    #[serde(default)]
    pub spoiler: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbUserListItem {
    pub id: String,
    pub vote: Option<i32>,
    pub labels: Option<Vec<VndbLabel>>,
    pub started: Option<String>,
    pub finished: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbLabel {
    pub id: i32,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbAuthInfo {
    pub id: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
pub struct AppSettings {
    pub vndb_token: Option<String>,
    pub vndb_user_id: Option<String>,
    pub blur_nsfw: bool,
    #[serde(default = "default_discord_enabled")]
    pub discord_rpc_enabled: bool,
    #[serde(default = "default_true")]
    pub discord_btn_vndb_game: bool,
    #[serde(default)]
    pub discord_btn_vndb_profile: bool,
    #[serde(default)]
    pub discord_btn_github: bool,
}

fn default_discord_enabled() -> bool {
    true
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
pub struct GameExitedPayload {
    pub game_id: String,
    pub play_minutes: u64,
}

pub struct RunningGame {
    pub id: String,
    pub start_time: Instant,
    pub title: String,
    pub cover_url: Option<String>,
    pub discord_start_timestamp: u64,
}
