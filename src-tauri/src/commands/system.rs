use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;
use tauri::{Emitter, Manager, State};
use tokio::task;

use crate::database::{get_current_timestamp, record_daily_playtime, save_games};
use crate::discord;
use crate::error::{AppError, AppResult};
use crate::models::{GameExitedPayload, RunningGame};
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn launch_game(
    id: String,
    app_handle: tauri::AppHandle,
    state: State<AppState>,
) -> AppResult<()> {
    let games = state.games.lock();
    let game = games
        .iter()
        .find(|g| g.id == id)
        .ok_or_else(|| AppError::NotFound("Game not found".into()))?;

    let path = PathBuf::from(&game.path);

    if !path.exists() {
        return Err(AppError::ProcessLaunch(format!(
            "Game executable not found: {}",
            path.display()
        )));
    }
    if !path.is_file() {
        return Err(AppError::ProcessLaunch(format!(
            "Path is not a file: {}",
            path.display()
        )));
    }

    let mut child = Command::new(&path)
        .current_dir(path.parent().unwrap_or(&path))
        .spawn()
        .map_err(|e| {
            use std::io::ErrorKind;
            match e.kind() {
                ErrorKind::NotFound => AppError::ProcessLaunch(format!(
                    "Executable not found or invalid: {}",
                    path.display()
                )),
                ErrorKind::PermissionDenied => AppError::ProcessLaunch(format!(
                    "Permission denied: cannot execute {}",
                    path.display()
                )),
                _ => AppError::ProcessLaunch(format!(
                    "Failed to launch game: {} ({})",
                    e,
                    path.display()
                )),
            }
        })?;

    let game_title = game.title.clone();
    let cover_url = game.cover_url.clone();
    let discord_start = discord::get_unix_timestamp();

    let start_time = Instant::now();
    {
        let mut running = state.running_game.lock();
        *running = Some(RunningGame {
            id: id.clone(),
            start_time,
            title: game_title.clone(),
            cover_url: cover_url.clone(),
            discord_start_timestamp: discord_start,
        });
    }

    {
        let settings = state.settings.lock();
        if settings.discord_rpc_enabled {
            // Get developer name from VN cache if available
            let developer = game.vndb_id.as_ref().and_then(|vndb_id| {
                state.vn_mem_cache.lock().get(vndb_id).and_then(|vn| {
                    vn.developers.as_ref().and_then(|devs| {
                        devs.first().map(|d| d.name.clone())
                    })
                })
            });

            // Build buttons list based on settings (max 2)
            let vndb_game_url = game.vndb_id.as_ref().map(|id| format!("https://vndb.org/{}", id));
            let vndb_profile_url = settings.vndb_user_id.as_ref().map(|id| format!("https://vndb.org/{}", id));
            const GITHUB_URL: &str = "https://github.com/betadyne/AlkaLauncher";

            let mut buttons: Vec<(&str, String)> = Vec::new();

            // Add buttons in priority order (View on VNDB > My Profile > GitHub)
            if settings.discord_btn_vndb_game {
                if let Some(ref url) = vndb_game_url {
                    buttons.push(("View on VNDB", url.clone()));
                }
            }
            if settings.discord_btn_vndb_profile && buttons.len() < 2 {
                if let Some(ref url) = vndb_profile_url {
                    buttons.push(("My VNDB Profile", url.clone()));
                }
            }
            if settings.discord_btn_github && buttons.len() < 2 {
                buttons.push(("GitHub", GITHUB_URL.to_string()));
            }

            // Convert to the format expected by set_activity
            let button_refs: Vec<(&str, &str)> = buttons
                .iter()
                .map(|(label, url)| (*label, url.as_str()))
                .collect();

            log::info!("Discord RPC buttons: {:?}", button_refs.iter().map(|(l, _)| *l).collect::<Vec<_>>());

            let _ = state.discord_rpc.set_activity(
                &game_title,
                cover_url.as_deref(),
                developer.as_deref(),
                button_refs,
                discord_start,
            );
        }
    }

    drop(games);

    let app_handle_clone = app_handle.clone();
    let game_id = id.clone();

    tauri::async_runtime::spawn(async move {
        let exit_result = task::spawn_blocking(move || child.wait()).await;

        let minutes = start_time.elapsed().as_secs() / 60;
        let state = app_handle_clone.state::<AppState>();

        let _ = state.discord_rpc.clear_activity();

        {
            let mut games = state.games.lock();
            if let Some(g) = games.iter_mut().find(|g| g.id == game_id) {
                g.play_time += minutes;
                g.last_played = Some(get_current_timestamp());
                let _ = save_games(&games);
            }
        }

        record_daily_playtime(&game_id, minutes);

        {
            let mut running = state.running_game.lock();
            *running = None;
        }

        let _ = app_handle.emit(
            "game-exited",
            GameExitedPayload {
                game_id: game_id.clone(),
                play_minutes: minutes,
            },
        );

        if let Ok(Err(e)) = exit_result {
            eprintln!("Game process error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn stop_tracking(state: State<AppState>) -> AppResult<u64> {
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

        record_daily_playtime(&game_id, minutes);

        return Ok(minutes);
    }
    Ok(0)
}

#[tauri::command]
#[specta::specta]
pub fn poll_running_game(state: State<AppState>) -> Option<String> {
    let running = state.running_game.lock();
    running.as_ref().map(|g| g.id.clone())
}

#[tauri::command]
#[specta::specta]
pub fn get_elapsed_time(state: State<AppState>) -> u64 {
    let running = state.running_game.lock();
    running
        .as_ref()
        .map(|r| r.start_time.elapsed().as_secs())
        .unwrap_or(0)
}
