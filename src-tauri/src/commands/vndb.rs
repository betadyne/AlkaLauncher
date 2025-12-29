use std::fs;
use tauri::State;
use tokio::task;

use crate::database::{
    disk_cache_get, disk_cache_set, get_data_dir, save_settings, CHAR_CACHE, VN_CACHE,
};
use crate::error::{AppError, AppResult};
use crate::models::{
    VndbAuthInfo, VndbCharacter, VndbResponse, VndbSearchResult, VndbUserListItem, VndbVnDetail,
};
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub async fn search_vndb(
    query: String,
    state: State<'_, AppState>,
) -> AppResult<Vec<VndbSearchResult>> {
    let body = serde_json::json!({
        "filters": ["search", "=", query],
        "fields": "id, title, image.url, released, rating",
        "results": 10
    });

    let response = state
        .http_client
        .post("https://api.vndb.org/kana/vn")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let vndb_response: VndbResponse<VndbSearchResult> = response.json().await?;
    Ok(vndb_response.results)
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_vndb_detail(
    vndb_id: String,
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> AppResult<VndbVnDetail> {
    let refresh = force_refresh.unwrap_or(false);

    if !refresh {
        if let Some(cached) = state.vn_mem_cache.lock().get(&vndb_id) {
            return Ok(cached.clone());
        }
    }

    if !refresh {
        let db_ref = state.db.as_ref();
        let vndb_id_clone = vndb_id.clone();
        let cached = task::block_in_place(|| {
            disk_cache_get::<VndbVnDetail>(db_ref, VN_CACHE, &vndb_id_clone)
        });
        if let Some(cached) = cached {
            state
                .vn_mem_cache
                .lock()
                .insert(vndb_id.clone(), cached.clone());
            return Ok(cached);
        }
    }

    let body = serde_json::json!({
        "filters": ["id", "=", vndb_id],
        "fields": "id, title, image.url, image.sexual, image.violence, released, rating, description, length, length_minutes, tags.id, tags.name, tags.rating, tags.spoiler, developers.id, developers.name",
        "results": 1
    });

    let response = state
        .http_client
        .post("https://api.vndb.org/kana/vn")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let vndb_response: VndbResponse<VndbVnDetail> = response.json().await?;
    let detail = vndb_response
        .results
        .into_iter()
        .next()
        .ok_or_else(|| AppError::NotFound("VN not found".into()))?;

    state
        .vn_mem_cache
        .lock()
        .insert(vndb_id.clone(), detail.clone());

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
pub async fn fetch_vndb_characters(
    vndb_id: String,
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> AppResult<Vec<VndbCharacter>> {
    let refresh = force_refresh.unwrap_or(false);

    if !refresh {
        if let Some(cached) = state.char_mem_cache.lock().get(&vndb_id) {
            return Ok(cached.clone());
        }
    }

    if !refresh {
        let db_ref = state.db.as_ref();
        let vndb_id_clone = vndb_id.clone();
        let cached = task::block_in_place(|| {
            disk_cache_get::<Vec<VndbCharacter>>(db_ref, CHAR_CACHE, &vndb_id_clone)
        });
        if let Some(cached) = cached {
            state
                .char_mem_cache
                .lock()
                .insert(vndb_id.clone(), cached.clone());
            return Ok(cached);
        }
    }

    let body = serde_json::json!({
        "filters": ["vn", "=", ["id", "=", vndb_id]],
        "fields": "id, name, original, aliases, image.url, image.sexual, image.violence, description, blood_type, height, weight, bust, waist, hips, cup, age, birthday, sex, vns.id, vns.role, vns.spoiler, traits.id, traits.name, traits.group_id, traits.group_name, traits.spoiler",
        "results": 50
    });

    let response = state
        .http_client
        .post("https://api.vndb.org/kana/character")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let vndb_response: VndbResponse<VndbCharacter> = response.json().await?;
    let chars = vndb_response.results;

    state
        .char_mem_cache
        .lock()
        .insert(vndb_id.clone(), chars.clone());

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
pub fn clear_vndb_cache(vndb_id: String, state: State<AppState>) -> AppResult<()> {
    state.vn_mem_cache.lock().remove(&vndb_id);
    state.char_mem_cache.lock().remove(&vndb_id);

    if let Some(db) = state.db.as_ref() {
        if let Ok(write_txn) = db.begin_write() {
            if let Ok(mut t) = write_txn.open_table(VN_CACHE) {
                let _ = t.remove(vndb_id.as_str());
            }
            if let Ok(mut t) = write_txn.open_table(CHAR_CACHE) {
                let _ = t.remove(vndb_id.as_str());
            }
            let _ = write_txn.commit();
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn clear_all_cache(state: State<AppState>) -> AppResult<()> {
    state.vn_mem_cache.lock().clear();
    state.char_mem_cache.lock().clear();

    let path = get_data_dir().join("vndb_cache.redb");
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn vndb_auth_check(state: State<'_, AppState>) -> AppResult<VndbAuthInfo> {
    let token = {
        let settings = state.settings.lock();
        settings
            .vndb_token
            .clone()
            .ok_or_else(|| AppError::AuthRequired("No VNDB token configured".into()))?
    };

    let response = state
        .http_client
        .get("https://api.vndb.org/kana/authinfo")
        .header("Authorization", format!("Token {}", token))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::AuthRequired("Invalid token".into()));
    }

    let auth_info: VndbAuthInfo = response.json().await?;

    let mut settings = state.settings.lock();
    settings.vndb_user_id = Some(auth_info.id.clone());
    let _ = save_settings(&settings);

    Ok(auth_info)
}

#[tauri::command]
#[specta::specta]
pub async fn vndb_get_user_vn(
    vndb_id: String,
    state: State<'_, AppState>,
) -> AppResult<Option<VndbUserListItem>> {
    let settings = state.settings.lock().clone();
    let token = settings
        .vndb_token
        .ok_or_else(|| AppError::AuthRequired("No VNDB token".into()))?;
    let user_id = settings
        .vndb_user_id
        .ok_or_else(|| AppError::AuthRequired("Not authenticated".into()))?;

    let body = serde_json::json!({
        "user": user_id,
        "filters": ["id", "=", vndb_id],
        "fields": "id, vote, labels.id, labels.label, started, finished",
        "results": 1
    });

    let response = state
        .http_client
        .post("https://api.vndb.org/kana/ulist")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await?;

    let vndb_response: VndbResponse<VndbUserListItem> = response.json().await?;
    Ok(vndb_response.results.into_iter().next())
}

#[tauri::command]
#[specta::specta]
pub async fn vndb_set_status(
    vndb_id: String,
    label_id: i32,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let settings = state.settings.lock().clone();
    let token = settings
        .vndb_token
        .ok_or_else(|| AppError::AuthRequired("No VNDB token".into()))?;

    let labels_unset: Vec<i32> = [1, 2, 3, 4, 5]
        .into_iter()
        .filter(|&x| x != label_id)
        .collect();
    let body = serde_json::json!({
        "labels_set": [label_id],
        "labels_unset": labels_unset
    });

    let response = state
        .http_client
        .patch(format!("https://api.vndb.org/kana/ulist/{}", vndb_id))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await?;

    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(AppError::VndbApi(format!("Failed to set status: {}", err)));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn vndb_set_vote(
    vndb_id: String,
    vote: i32,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let settings = state.settings.lock().clone();
    let token = settings
        .vndb_token
        .ok_or_else(|| AppError::AuthRequired("No VNDB token".into()))?;

    let body = serde_json::json!({ "vote": vote });

    let response = state
        .http_client
        .patch(format!("https://api.vndb.org/kana/ulist/{}", vndb_id))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await?;

    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(AppError::VndbApi(format!("Failed to set vote: {}", err)));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn vndb_remove_vote(vndb_id: String, state: State<'_, AppState>) -> AppResult<()> {
    let settings = state.settings.lock().clone();
    let token = settings
        .vndb_token
        .ok_or_else(|| AppError::AuthRequired("No VNDB token".into()))?;

    let body = serde_json::json!({ "vote": null });

    let response = state
        .http_client
        .patch(format!("https://api.vndb.org/kana/ulist/{}", vndb_id))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Token {}", token))
        .json(&body)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::VndbApi("Failed to remove vote".into()));
    }
    Ok(())
}
