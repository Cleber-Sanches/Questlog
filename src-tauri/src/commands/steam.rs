use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::steam::achievements::{
    fetch_steam_english_texts, get_steam_achievements, AchievementsResult,
};
use crate::steam::clienticon::{get_steam_client_icon, ClientIconResult};
use crate::steam::dlc::{get_steam_dlc_groups, DlcGroupsResult};
use crate::steam::progress::{get_steam_progress, SteamProgress};
use crate::steam::search::{search_steam_games, SearchResult};
use crate::steam::settings::{self, SteamSettingsStatus};
use std::sync::Arc;

fn custom_install_dir(state: &AppState) -> Option<String> {
    let conn = state.db.lock();
    settings::read_install_dir(&conn)
}

#[tauri::command]
pub fn get_steam_progress_cmd(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
) -> AppResult<SteamProgress> {
    let custom = custom_install_dir(&state);
    get_steam_progress(&app_id, custom.as_deref())
}

#[tauri::command]
pub async fn search_steam_games_cmd(query: String) -> AppResult<SearchResult> {
    tauri::async_runtime::spawn_blocking(move || search_steam_games(&query))
        .await
        .map_err(|e| AppError::from(format!("busca Steam: {e}")))?
}

#[tauri::command]
pub fn get_steam_achievements_cmd(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
) -> AppResult<AchievementsResult> {
    let custom = custom_install_dir(&state);
    get_steam_achievements(&app_id, custom.as_deref())
}

#[tauri::command]
pub fn steam_refresh_locale_texts_cmd(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
) -> AppResult<usize> {
    let custom = custom_install_dir(&state);
    let texts = fetch_steam_english_texts(&app_id, custom.as_deref())?;
    let conn = state.db.lock();
    let payload: Vec<(i64, Option<String>, String, String)> = texts
        .into_iter()
        .map(|row| (row.id, row.api_name, row.title_en, row.description_en))
        .collect();
    crate::db::repos::refresh_achievement_locale_texts(&conn, &app_id, &payload)
}

#[tauri::command]
pub fn get_steam_dlc_groups_cmd(app_id: String) -> AppResult<DlcGroupsResult> {
    get_steam_dlc_groups(&app_id)
}

#[tauri::command]
pub fn get_steam_client_icon_cmd(app_id: String) -> AppResult<ClientIconResult> {
    get_steam_client_icon(&app_id)
}

#[tauri::command]
pub fn steam_get_settings(state: tauri::State<'_, Arc<AppState>>) -> AppResult<SteamSettingsStatus> {
    let conn = state.db.lock();
    settings::get_status(&conn)
}

#[tauri::command]
pub fn steam_set_install_dir(
    state: tauri::State<'_, Arc<AppState>>,
    path: String,
) -> AppResult<()> {
    let conn = state.db.lock();
    settings::set_install_dir(&conn, &path)
}
