use parking_lot::Mutex;
use redb::Database;
use std::collections::HashMap;

use crate::discord::DiscordRpc;
use crate::models::{AppSettings, GameMetadata, RunningGame, VndbCharacter, VndbVnDetail};

pub struct AppState {
    pub games: Mutex<Vec<GameMetadata>>,
    pub running_game: Mutex<Option<RunningGame>>,
    pub settings: Mutex<AppSettings>,
    pub vn_mem_cache: Mutex<HashMap<String, VndbVnDetail>>,
    pub char_mem_cache: Mutex<HashMap<String, Vec<VndbCharacter>>>,
    pub http_client: reqwest::Client,
    pub db: Option<Database>,
    pub discord_rpc: DiscordRpc,
}
