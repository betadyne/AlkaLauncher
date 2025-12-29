use redb::{Database, TableDefinition};
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::models::{AppSettings, DailyPlaytimeData, GameMetadata};

pub const VN_CACHE: TableDefinition<&str, &[u8]> = TableDefinition::new("vn_cache");
pub const CHAR_CACHE: TableDefinition<&str, &[u8]> = TableDefinition::new("char_cache");

pub fn get_data_dir() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("AlkaLauncher");
    fs::create_dir_all(&data_dir).ok();
    data_dir
}

pub fn get_data_path() -> PathBuf {
    get_data_dir().join("games.json")
}

pub fn get_settings_path() -> PathBuf {
    get_data_dir().join("settings.json")
}

pub fn get_daily_playtime_path() -> PathBuf {
    get_data_dir().join("daily_playtime.json")
}

pub fn get_cache_db_path() -> PathBuf {
    get_data_dir().join("vndb_cache.redb")
}

fn atomic_write(path: &Path, content: &str) -> AppResult<()> {
    let tmp_path = path.with_extension("json.tmp");
    let file = fs::File::create(&tmp_path)?;
    {
        let mut writer = std::io::BufWriter::new(&file);
        writer.write_all(content.as_bytes())?;
        writer.flush()?;
    }
    file.sync_all()?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

pub fn save_games(games: &[GameMetadata]) -> AppResult<()> {
    let path = get_data_path();
    log::info!("save_games: Saving {} games to {:?}", games.len(), path);

    if games.is_empty() && path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(existing) = serde_json::from_str::<Vec<GameMetadata>>(&content) {
                if !existing.is_empty() {
                    log::warn!(
                        "save_games: Refusing to overwrite {} existing games with empty list",
                        existing.len()
                    );
                    return Ok(());
                }
            }
        }
    }

    let json = serde_json::to_string_pretty(games)?;
    atomic_write(&path, &json)
}

pub fn load_games() -> AppResult<Vec<GameMetadata>> {
    let path = get_data_path();
    log::info!("load_games: Loading from {:?}", path);

    if !path.exists() {
        log::info!("load_games: File does not exist, returning empty list");
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)?;

    match serde_json::from_str::<Vec<GameMetadata>>(&content) {
        Ok(games) => {
            log::info!("load_games: Successfully loaded {} games", games.len());
            Ok(games)
        }
        Err(e) => {
            log::error!("load_games: Failed to parse JSON: {}", e);
            let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
            let backup_path = get_data_dir().join(format!("games.json.corrupted.{}", timestamp));
            if let Err(backup_err) = fs::copy(&path, &backup_path) {
                log::error!("Failed to backup corrupted games.json: {}", backup_err);
            }
            Err(AppError::Json(e.to_string()))
        }
    }
}

pub fn save_settings(settings: &AppSettings) -> AppResult<()> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(settings)?;
    atomic_write(&path, &json)
}

pub fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

pub fn load_daily_playtime() -> DailyPlaytimeData {
    let path = get_daily_playtime_path();
    if path.exists() {
        fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        DailyPlaytimeData::default()
    }
}

pub fn save_daily_playtime(data: &DailyPlaytimeData) -> AppResult<()> {
    let path = get_daily_playtime_path();
    let json = serde_json::to_string_pretty(data)?;
    atomic_write(&path, &json)
}

pub fn record_daily_playtime(game_id: &str, minutes: u64) {
    if minutes == 0 {
        return;
    }

    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut data = load_daily_playtime();

    let game_data = data
        .games
        .entry(game_id.to_string())
        .or_insert_with(HashMap::new);
    let current = game_data.entry(date_str).or_insert(0);
    *current += minutes;

    let _ = save_daily_playtime(&data);
}

pub fn get_current_timestamp() -> String {
    chrono::Local::now().to_rfc3339()
}

pub fn disk_cache_get<T: DeserializeOwned>(
    db: Option<&Database>,
    table: TableDefinition<&str, &[u8]>,
    key: &str,
) -> Option<T> {
    let db = db?;
    let read_txn = db.begin_read().ok()?;
    let table = read_txn.open_table(table).ok()?;
    let value = table.get(key).ok()??;
    bincode::deserialize(value.value()).ok()
}

pub fn disk_cache_set<T: Serialize>(
    db: Option<&Database>,
    table: TableDefinition<&str, &[u8]>,
    key: &str,
    value: &T,
) {
    if let Some(db) = db {
        if let Ok(write_txn) = db.begin_write() {
            if let Ok(mut t) = write_txn.open_table(table) {
                if let Ok(data) = bincode::serialize(value) {
                    let _ = t.insert(key, data.as_slice());
                }
            }
            let _ = write_txn.commit();
        }
    }
}

pub fn create_cache_db() -> Option<Database> {
    let db_path = get_cache_db_path();
    match Database::create(&db_path) {
        Ok(db) => Some(db),
        Err(e) => {
            eprintln!("Failed to create cache database at {:?}: {}", db_path, e);
            None
        }
    }
}

pub fn create_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}
