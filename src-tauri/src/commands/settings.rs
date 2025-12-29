use tauri::State;

use crate::database::save_settings;
use crate::error::AppResult;
use crate::models::AppSettings;
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn init_app() {}

#[tauri::command]
#[specta::specta]
pub fn get_settings(state: State<AppState>) -> AppSettings {
    state.settings.lock().clone()
}

#[tauri::command]
#[specta::specta]
pub fn save_vndb_token(token: String, state: State<AppState>) -> AppResult<()> {
    let mut settings = state.settings.lock();
    settings.vndb_token = Some(token);
    save_settings(&settings)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn clear_vndb_token(state: State<AppState>) -> AppResult<()> {
    let mut settings = state.settings.lock();
    settings.vndb_token = None;
    settings.vndb_user_id = None;
    save_settings(&settings)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_blur_nsfw(blur: bool, state: State<AppState>) -> AppResult<()> {
    let mut settings = state.settings.lock();
    settings.blur_nsfw = blur;
    save_settings(&settings)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_discord_rpc_enabled(enabled: bool, state: State<AppState>) -> AppResult<()> {
    let mut settings = state.settings.lock();
    settings.discord_rpc_enabled = enabled;

    if !enabled {
        let _ = state.discord_rpc.clear_activity();
    }

    save_settings(&settings)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_discord_rpc_buttons(
    vndb_game: bool,
    vndb_profile: bool,
    github: bool,
    state: State<AppState>,
) -> AppResult<()> {
    // Count active buttons (max 2 allowed by Discord)
    let active_count = [vndb_game, vndb_profile, github].iter().filter(|&&x| x).count();
    if active_count > 2 {
        return Err(crate::error::AppError::Validation(
            "Maximum 2 Discord buttons can be active".to_string(),
        ));
    }

    let mut settings = state.settings.lock();
    settings.discord_btn_vndb_game = vndb_game;
    settings.discord_btn_vndb_profile = vndb_profile;
    settings.discord_btn_github = github;
    save_settings(&settings)?;
    Ok(())
}
