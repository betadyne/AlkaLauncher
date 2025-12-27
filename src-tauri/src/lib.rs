use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use parking_lot::Mutex;
use std::time::Instant;
use tauri::{State, Emitter, Manager};
use uuid::Uuid;
use redb::{Database, TableDefinition};
use chrono::Local;
use tokio::task;

// Event payload for game exit notification
#[derive(Debug, Clone, Serialize)]
pub struct GameExitedPayload {
    pub game_id: String,
    pub play_minutes: u64,
}

// Cache table definitions
const VN_CACHE: TableDefinition<&str, &[u8]> = TableDefinition::new("vn_cache");
const CHAR_CACHE: TableDefinition<&str, &[u8]> = TableDefinition::new("char_cache");

// === MODELS ===

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
    pub last_played: Option<String>, // ISO 8601 timestamp e.g. "2025-12-25T20:30:00+07:00"
    #[serde(default)]
    pub is_hidden: bool,
}

// Daily playtime tracking for progress reports
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
pub struct DailyPlaytimeData {
    // Map of game_id -> Map of date_string -> minutes played
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

// Extended VN details
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
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbTag {
    pub id: String,
    pub name: String,
    pub rating: f64,
    #[serde(default)]
    pub spoiler: i32,
}

// Character models
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

// User list models
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

// Auth info response
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VndbAuthInfo {
    pub id: String,
    pub username: String,
}

// Settings
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
pub struct AppSettings {
    pub vndb_token: Option<String>,
    pub vndb_user_id: Option<String>,
    pub blur_nsfw: bool,
}

// === STATE ===

pub struct AppState {
    games: Mutex<Vec<GameMetadata>>,
    running_game: Mutex<Option<RunningGame>>,
    settings: Mutex<AppSettings>,
    // In-memory cache for instant access
    vn_mem_cache: Mutex<HashMap<String, VndbVnDetail>>,
    char_mem_cache: Mutex<HashMap<String, Vec<VndbCharacter>>>,
    // Shared HTTP client for connection pooling
    http_client: reqwest::Client,
    // Persistence database
    db: Option<Database>,
}

struct RunningGame {
    id: String,
    start_time: Instant,
}

// NO_REPLACE: Remove lazy initialization logic

// === STORAGE ===

fn get_data_dir() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("AlkaLauncher");
    fs::create_dir_all(&data_dir).ok();
    data_dir
}

fn get_data_path() -> PathBuf {
    get_data_dir().join("games.json")
}

fn get_settings_path() -> PathBuf {
    get_data_dir().join("settings.json")
}

fn get_daily_playtime_path() -> PathBuf {
    get_data_dir().join("daily_playtime.json")
}

// Get current local date as string (YYYY-MM-DD)
fn get_today_date_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

// Get current local timestamp as ISO 8601 string
fn get_current_timestamp() -> String {
    Local::now().to_rfc3339()
}

// Atomic write: write to temp file, sync, then rename
fn atomic_write(path: &std::path::Path, content: &str) -> Result<(), String> {
    use std::io::Write;
    let tmp_path = path.with_extension("json.tmp");
    let file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    {
        let mut writer = std::io::BufWriter::new(&file);
        writer.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
    }
    file.sync_all().map_err(|e| format!("Failed to sync: {}", e))?;
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to rename: {}", e))
}

fn save_games(games: &[GameMetadata]) -> Result<(), String> {
    let path = get_data_path();
    let json = serde_json::to_string_pretty(games).map_err(|e| e.to_string())?;
    atomic_write(&path, &json)
}

fn load_games() -> Result<Vec<GameMetadata>, String> {
    let path = get_data_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read games.json: {}", e))?;
    
    match serde_json::from_str::<Vec<GameMetadata>>(&content) {
        Ok(games) => Ok(games),
        Err(e) => {
            // Backup corrupted file before returning error
            let timestamp = Local::now().format("%Y%m%d_%H%M%S");
            let backup_path = get_data_dir().join(format!("games.json.corrupted.{}", timestamp));
            if let Err(backup_err) = fs::copy(&path, &backup_path) {
                eprintln!("Failed to backup corrupted games.json: {}", backup_err);
            } else {
                eprintln!("Corrupted games.json backed up to {:?}", backup_path);
            }
            Err(format!("games.json is corrupted (parse error: {}). A backup has been created.", e))
        }
    }
}

fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    atomic_write(&path, &json)
}

fn load_settings() -> AppSettings {
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

fn load_daily_playtime() -> DailyPlaytimeData {
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

fn save_daily_playtime(data: &DailyPlaytimeData) -> Result<(), String> {
    let path = get_daily_playtime_path();
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    atomic_write(&path, &json)
}

// Record playtime for a game on a specific date
fn record_daily_playtime(game_id: &str, minutes: u64) {
    if minutes == 0 {
        return;
    }
    
    let date_str = get_today_date_string();
    let mut data = load_daily_playtime();
    
    let game_data = data.games.entry(game_id.to_string()).or_insert_with(HashMap::new);
    let current = game_data.entry(date_str).or_insert(0);
    *current += minutes;
    
    let _ = save_daily_playtime(&data);
}

// VNDB API helper - creates the shared client once
fn create_http_client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder().build()
}

// === CACHE (Disk) ===

fn disk_cache_get<T: for<'de> Deserialize<'de>>(db: Option<&Database>, table: TableDefinition<&str, &[u8]>, key: &str) -> Option<T> {
    let db = db?;
    let read_txn = db.begin_read().ok()?;
    let table = read_txn.open_table(table).ok()?;
    let value = table.get(key).ok()??;
    bincode::deserialize(value.value()).ok()
}

fn disk_cache_set<T: Serialize>(db: Option<&Database>, table: TableDefinition<&str, &[u8]>, key: &str, value: &T) {
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

// === TAURI COMMANDS ===

#[tauri::command]
#[specta::specta]
fn init_app() {
    // Database is now initialized in run() and stored in AppState
}

#[tauri::command]
#[specta::specta]
fn get_all_games(state: State<AppState>) -> Vec<GameMetadata> {
    state.games.lock().clone()
}

#[tauri::command]
#[specta::specta]
fn add_local_game(path: String, state: State<AppState>) -> Result<GameMetadata, String> {
    let path_buf = PathBuf::from(&path);
    let title = path_buf
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown Game")
        .to_string();

    let game = GameMetadata {
        id: Uuid::new_v4().to_string(),
        title,
        path,
        vndb_id: None,
        cover_url: None,
        play_time: 0,
        is_finished: false,
        last_played: None,
        is_hidden: false,
    };

    let mut games = state.games.lock();
    games.push(game.clone());
    save_games(&games)?;

    Ok(game)
}

#[tauri::command]
#[specta::specta]
fn remove_game(id: String, state: State<AppState>) -> Result<(), String> {
    let mut games = state.games.lock();
    games.retain(|g| g.id != id);
    save_games(&games)
}

#[tauri::command]
#[specta::specta]
fn update_game(game: GameMetadata, state: State<AppState>) -> Result<(), String> {
    let mut games = state.games.lock();
    if let Some(existing) = games.iter_mut().find(|g| g.id == game.id) {
        *existing = game;
    }
    save_games(&games)
}

#[tauri::command]
#[specta::specta]
fn set_game_hidden(id: String, hidden: bool, state: State<AppState>) -> Result<(), String> {
    let mut games = state.games.lock();
    if let Some(game) = games.iter_mut().find(|g| g.id == id) {
        game.is_hidden = hidden;
    }
    save_games(&games)
}

// === VNDB COMMANDS ===

#[tauri::command]
#[specta::specta]
async fn search_vndb(query: String, state: State<'_, AppState>) -> Result<Vec<VndbSearchResult>, String> {
    let body = serde_json::json!({
        "filters": ["search", "=", query],
        "fields": "id, title, image.url, released, rating",
        "results": 10
    });

    let response = state.http_client
        .post("https://api.vndb.org/kana/vn")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let vndb_response: VndbResponse<VndbSearchResult> = response.json().await.map_err(|e| e.to_string())?;
    Ok(vndb_response.results)
}

#[tauri::command]
#[specta::specta]
async fn fetch_vndb_detail(vndb_id: String, force_refresh: Option<bool>, state: State<'_, AppState>) -> Result<VndbVnDetail, String> {
    let refresh = force_refresh.unwrap_or(false);
    
    // 1. Check in-memory cache first (instant)
    if !refresh {
        if let Some(cached) = state.vn_mem_cache.lock().get(&vndb_id) {
            return Ok(cached.clone());
        }
    }
    
    // 2. Check disk cache (blocking I/O wrapped in block_in_place)
    if !refresh {
        let db_ref = state.db.as_ref();
        let vndb_id_clone = vndb_id.clone();
        let cached = task::block_in_place(|| {
            disk_cache_get::<VndbVnDetail>(db_ref, VN_CACHE, &vndb_id_clone)
        });
        if let Some(cached) = cached {
            // Store in memory for next access
            state.vn_mem_cache.lock().insert(vndb_id.clone(), cached.clone());
            return Ok(cached);
        }
    }

    // 3. Fetch from API
    let body = serde_json::json!({
        "filters": ["id", "=", vndb_id],
        "fields": "id, title, image.url, image.sexual, image.violence, released, rating, description, length, length_minutes, tags.id, tags.name, tags.rating, tags.spoiler",
        "results": 1
    });

    let response = state.http_client
        .post("https://api.vndb.org/kana/vn")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let vndb_response: VndbResponse<VndbVnDetail> = response.json().await.map_err(|e| e.to_string())?;
    let detail = vndb_response.results.into_iter().next().ok_or_else(|| "VN not found".to_string())?;

    // Store in both memory and disk cache
    state.vn_mem_cache.lock().insert(vndb_id.clone(), detail.clone());
    let db_ref = state.db.as_ref();
    let vndb_id_clone = vndb_id.clone();
    let detail_clone = detail.clone();
    task::block_in_place(|| {
        disk_cache_set(db_ref, VN_CACHE, &vndb_id_clone, &detail_clone);
    });

    Ok(detail)
}

#[tauri::command]
#[specta::specta]
async fn fetch_vndb_characters(vndb_id: String, force_refresh: Option<bool>, state: State<'_, AppState>) -> Result<Vec<VndbCharacter>, String> {
    let refresh = force_refresh.unwrap_or(false);
    
    // 1. Check in-memory cache first (instant)
    if !refresh {
        if let Some(cached) = state.char_mem_cache.lock().get(&vndb_id) {
            return Ok(cached.clone());
        }
    }
    
    // 2. Check disk cache (blocking I/O wrapped in block_in_place)
    if !refresh {
        let db_ref = state.db.as_ref();
        let vndb_id_clone = vndb_id.clone();
        let cached = task::block_in_place(|| {
            disk_cache_get::<Vec<VndbCharacter>>(db_ref, CHAR_CACHE, &vndb_id_clone)
        });
        if let Some(cached) = cached {
            state.char_mem_cache.lock().insert(vndb_id.clone(), cached.clone());
            return Ok(cached);
        }
    }

    // 3. Fetch from API
    let body = serde_json::json!({
        "filters": ["vn", "=", ["id", "=", vndb_id]],
        "fields": "id, name, original, aliases, image.url, image.sexual, image.violence, description, blood_type, height, weight, bust, waist, hips, cup, age, birthday, sex, vns.id, vns.role, vns.spoiler, traits.id, traits.name, traits.group_id, traits.group_name, traits.spoiler",
        "results": 50
    });

    let response = state.http_client
        .post("https://api.vndb.org/kana/character")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let vndb_response: VndbResponse<VndbCharacter> = response.json().await.map_err(|e| e.to_string())?;
    let chars = vndb_response.results;

    // Store in both memory and disk cache
    state.char_mem_cache.lock().insert(vndb_id.clone(), chars.clone());
    let db_ref = state.db.as_ref();
    let vndb_id_clone = vndb_id.clone();
    let chars_clone = chars.clone();
    task::block_in_place(|| {
        disk_cache_set(db_ref, CHAR_CACHE, &vndb_id_clone, &chars_clone);
    });

    Ok(chars)
}

#[tauri::command]
#[specta::specta]
fn clear_vndb_cache(vndb_id: String, state: State<AppState>) -> Result<(), String> {
    // Clear memory cache
    state.vn_mem_cache.lock().remove(&vndb_id);
    state.char_mem_cache.lock().remove(&vndb_id);
    
    // Clear disk cache
    if let Some(db) = state.db.as_ref() {
        if let Ok(write_txn) = db.begin_write() {
            if let Ok(mut t) = write_txn.open_table(VN_CACHE) { let _ = t.remove(vndb_id.as_str()); }
            if let Ok(mut t) = write_txn.open_table(CHAR_CACHE) { let _ = t.remove(vndb_id.as_str()); }
            let _ = write_txn.commit();
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
fn clear_all_cache(state: State<AppState>) -> Result<(), String> {
    // Clear memory cache
    state.vn_mem_cache.lock().clear();
    state.char_mem_cache.lock().clear();
    
    // Clear disk cache - just delete the file
    let path = get_data_dir().join("vndb_cache.redb");
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// === VNDB AUTH & USER LIST ===

#[tauri::command]
#[specta::specta]
fn get_settings(state: State<AppState>) -> AppSettings {
    state.settings.lock().clone()
}

#[tauri::command]
#[specta::specta]
fn save_vndb_token(token: String, state: State<AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock();
    settings.vndb_token = Some(token);
    save_settings(&settings)
}

#[tauri::command]
#[specta::specta]
fn clear_vndb_token(state: State<AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock();
    settings.vndb_token = None;
    settings.vndb_user_id = None;
    save_settings(&settings)
}

#[tauri::command]
#[specta::specta]
fn set_blur_nsfw(blur: bool, state: State<AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock();
    settings.blur_nsfw = blur;
    save_settings(&settings)
}

#[tauri::command]
#[specta::specta]
async fn vndb_auth_check(state: State<'_, AppState>) -> Result<VndbAuthInfo, String> {
    let token = {
        let settings = state.settings.lock();
        settings.vndb_token.clone().ok_or("No VNDB token configured")?
    };
    
    let response = state.http_client
        .get("https://api.vndb.org/kana/authinfo")
        .header("Authorization", format!("Token {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Invalid token".to_string());
    }

    let auth_info: VndbAuthInfo = response.json().await.map_err(|e| e.to_string())?;
    
    // Save user ID
    let mut settings = state.settings.lock();
    settings.vndb_user_id = Some(auth_info.id.clone());
    let _ = save_settings(&settings);
    
    Ok(auth_info)
}

#[tauri::command]
#[specta::specta]
async fn vndb_get_user_vn(vndb_id: String, state: State<'_, AppState>) -> Result<Option<VndbUserListItem>, String> {
    let settings = state.settings.lock().clone();
    let token = settings.vndb_token.ok_or("No VNDB token")?;
    let user_id = settings.vndb_user_id.ok_or("Not authenticated")?;
    
    let body = serde_json::json!({
        "user": user_id,
        "filters": ["id", "=", vndb_id],
        "fields": "id, vote, labels.id, labels.label, started, finished",
        "results": 1
    });

    let response = state.http_client
        .post("https://api.vndb.org/kana/ulist")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let vndb_response: VndbResponse<VndbUserListItem> = response.json().await.map_err(|e| e.to_string())?;
    Ok(vndb_response.results.into_iter().next())
}

#[tauri::command]
#[specta::specta]
async fn vndb_set_status(vndb_id: String, label_id: i32, state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings.lock().clone();
    let token = settings.vndb_token.ok_or("No VNDB token")?;
    
    // Labels: 1=Playing, 2=Finished, 3=Stalled, 4=Dropped, 5=Wishlist
    let labels_unset: Vec<i32> = [1, 2, 3, 4, 5].into_iter().filter(|&x| x != label_id).collect();
    let body = serde_json::json!({
        "labels_set": [label_id],
        "labels_unset": labels_unset
    });

    let response = state.http_client
        .patch(format!("https://api.vndb.org/kana/ulist/{}", vndb_id))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(format!("Failed to set status: {}", err));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn vndb_set_vote(vndb_id: String, vote: i32, state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings.lock().clone();
    let token = settings.vndb_token.ok_or("No VNDB token")?;
    
    // Vote is 10-100 (e.g., 75 = 7.5)
    let body = serde_json::json!({ "vote": vote });

    let response = state.http_client
        .patch(format!("https://api.vndb.org/kana/ulist/{}", vndb_id))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(format!("Failed to set vote: {}", err));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn vndb_remove_vote(vndb_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings.lock().clone();
    let token = settings.vndb_token.ok_or("No VNDB token")?;
    
    let body = serde_json::json!({ "vote": null });

    let response = state.http_client
        .patch(format!("https://api.vndb.org/kana/ulist/{}", vndb_id))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Failed to remove vote".to_string());
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
fn launch_game(id: String, app_handle: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let games = state.games.lock();
    let game = games
        .iter()
        .find(|g| g.id == id)
        .ok_or("Game not found")?;

    let path = PathBuf::from(&game.path);
    
    // Validate path exists and is a file
    if !path.exists() {
        return Err(format!("Game executable not found: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }

    // Spawn the process with detailed error handling
    let mut child = Command::new(&path)
        .current_dir(path.parent().unwrap_or(&path))
        .spawn()
        .map_err(|e| {
            use std::io::ErrorKind;
            match e.kind() {
                ErrorKind::NotFound => format!("Executable not found or invalid: {}", path.display()),
                ErrorKind::PermissionDenied => format!("Permission denied: cannot execute {}", path.display()),
                ErrorKind::InvalidInput => format!("Invalid executable path: {}", path.display()),
                _ => format!("Failed to launch game: {} ({})", e, path.display()),
            }
        })?;

    // Store running game state
    let start_time = Instant::now();
    {
        let mut running = state.running_game.lock();
        *running = Some(RunningGame {
            id: id.clone(),
            start_time,
        });
    }
    drop(games);

    // Clone app_handle for the async task
    let app_handle_clone = app_handle.clone();
    let game_id = id.clone();

    // Spawn async task to monitor process exit
    tauri::async_runtime::spawn(async move {
        // Wait for process to exit in blocking thread
        let exit_result = task::spawn_blocking(move || {
            child.wait()
        }).await;

        // Calculate playtime
        let minutes = start_time.elapsed().as_secs() / 60;

        // Get state from app handle
        let state = app_handle_clone.state::<AppState>();

        // Update game data
        {
            let mut games = state.games.lock();
            if let Some(g) = games.iter_mut().find(|g| g.id == game_id) {
                g.play_time += minutes;
                g.last_played = Some(get_current_timestamp());
                let _ = save_games(&games);
            }
        }

        // Record daily playtime
        record_daily_playtime(&game_id, minutes);

        // Clear running state
        {
            let mut running = state.running_game.lock();
            *running = None;
        }

        // Emit game-exited event to frontend
        let _ = app_handle.emit("game-exited", GameExitedPayload {
            game_id: game_id.clone(),
            play_minutes: minutes,
        });

        if let Ok(Err(e)) = exit_result {
            eprintln!("Game process error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
fn stop_tracking(state: State<AppState>) -> Result<u64, String> {
    let mut running = state.running_game.lock();
    if let Some(game) = running.take() {
        let elapsed = game.start_time.elapsed();
        let minutes = elapsed.as_secs() / 60;
        let game_id = game.id.clone();

        let mut games = state.games.lock();
        if let Some(g) = games.iter_mut().find(|g| g.id == game_id) {
            g.play_time += minutes;
            g.last_played = Some(get_current_timestamp());
            save_games(&games)?;
        }
        drop(games);
        
        // Record daily playtime for progress reports
        record_daily_playtime(&game_id, minutes);

        return Ok(minutes);
    }
    Ok(0)
}

#[tauri::command]
#[specta::specta]
fn poll_running_game(state: State<AppState>) -> Option<String> {
    // With event-based architecture, this just returns the current running game ID
    // The actual process monitoring is done by the async task spawned in launch_game
    let running = state.running_game.lock();
    running.as_ref().map(|g| g.id.clone())
}

#[tauri::command]
#[specta::specta]
fn get_elapsed_time(state: State<AppState>) -> u64 {
    let running = state.running_game.lock();
    running
        .as_ref()
        .map(|r| r.start_time.elapsed().as_secs())
        .unwrap_or(0)
}

// === MAIN ===

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = get_data_dir().join("vndb_cache.redb");
    let db = match Database::create(&db_path) {
        Ok(db) => Some(db),
        Err(e) => {
            eprintln!("Failed to create cache database at {:?}: {}", db_path, e);
            None
        }
    };

    let games = match load_games() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("Error loading games: {}", e);
            // Start with empty list but the error is logged and backup created
            Vec::new()
        }
    };

    let http_client = match create_http_client() {
        Ok(client) => client,
        Err(e) => {
            eprintln!("Failed to create HTTP client: {}. Running with default client.", e);
            reqwest::Client::new()
        }
    };

    let state = AppState {
        games: Mutex::new(games),
        running_game: Mutex::new(None),
        settings: Mutex::new(load_settings()),
        vn_mem_cache: Mutex::new(HashMap::new()),
        char_mem_cache: Mutex::new(HashMap::new()),
        http_client,
        db,
    };

    // Build tauri-specta for type generation
    let builder = tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            init_app,
            get_all_games,
            add_local_game,
            remove_game,
            update_game,
            search_vndb,
            fetch_vndb_detail,
            fetch_vndb_characters,
            clear_vndb_cache,
            clear_all_cache,
            get_settings,
            save_vndb_token,
            clear_vndb_token,
            set_blur_nsfw,
            vndb_auth_check,
            vndb_get_user_vn,
            vndb_set_status,
            vndb_set_vote,
            vndb_remove_vote,
            launch_game,
            stop_tracking,
            poll_running_game,
            get_elapsed_time,
            set_game_hidden,
        ])
        .typ::<GameMetadata>()
        .typ::<DailyPlaytimeData>()
        .typ::<VndbSearchResult>()
        .typ::<VndbImage>()
        .typ::<VndbVnDetail>()
        .typ::<VndbTag>()
        .typ::<VndbCharacter>()
        .typ::<VndbTrait>()
        .typ::<VndbCharacterVn>()
        .typ::<VndbUserListItem>()
        .typ::<VndbLabel>()
        .typ::<VndbAuthInfo>()
        .typ::<AppSettings>();

    // Export bindings in debug mode
    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::Number)
                .header("// Auto-generated by tauri-specta. Do not edit manually.\n"),
            "../src/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(builder.invoke_handler())
        .manage(state)
        .setup(move |app| {
            builder.mount_events(app);
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

