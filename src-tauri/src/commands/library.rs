use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

use crate::database::save_games;
use crate::error::AppResult;
use crate::models::GameMetadata;
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn get_all_games(state: State<AppState>) -> Vec<GameMetadata> {
    state.games.lock().clone()
}

#[tauri::command]
#[specta::specta]
pub fn add_local_game(path: String, state: State<AppState>) -> AppResult<GameMetadata> {
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
pub fn remove_game(id: String, state: State<AppState>) -> AppResult<()> {
    let mut games = state.games.lock();
    games.retain(|g| g.id != id);
    save_games(&games)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn update_game(game: GameMetadata, state: State<AppState>) -> AppResult<()> {
    let mut games = state.games.lock();
    if let Some(existing) = games.iter_mut().find(|g| g.id == game.id) {
        *existing = game;
    }
    save_games(&games)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_game_hidden(id: String, hidden: bool, state: State<AppState>) -> AppResult<()> {
    let mut games = state.games.lock();
    if let Some(game) = games.iter_mut().find(|g| g.id == id) {
        game.is_hidden = hidden;
    }
    save_games(&games)?;
    Ok(())
}
