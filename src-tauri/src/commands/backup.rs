use crate::backup::{self, BackupInfo};
use crate::db::repos;
use crate::error::AppResult;
use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    pub last_backup_at: Option<String>,
    pub last_backup_path: Option<String>,
    pub external_backup_dir: Option<String>,
}

#[tauri::command]
pub fn backup_now(state: tauri::State<'_, Arc<AppState>>) -> AppResult<BackupInfo> {
    let conn = state.db.lock();
    let info = backup::run_backup(&conn, &state.app_data_dir)?;
    drop(conn);
    state.clear_backup_request();
    Ok(info)
}

#[tauri::command]
pub fn backup_set_external_dir(
    state: tauri::State<'_, Arc<AppState>>,
    path: String,
) -> AppResult<()> {
    let conn = state.db.lock();
    backup::set_external_dir(&conn, &path)
}

#[tauri::command]
pub fn backup_get_status(state: tauri::State<'_, Arc<AppState>>) -> AppResult<BackupStatus> {
    let conn = state.db.lock();
    Ok(BackupStatus {
        last_backup_at: repos::get_setting(&conn, "last_backup_at")?,
        last_backup_path: repos::get_setting(&conn, "last_backup_path")?,
        external_backup_dir: repos::get_setting(&conn, "external_backup_dir")?,
    })
}

#[tauri::command]
pub fn backup_maybe_auto(state: tauri::State<'_, Arc<AppState>>) -> AppResult<Option<BackupInfo>> {
    if !state.should_auto_backup(std::time::Duration::from_secs(30)) {
        return Ok(None);
    }
    let conn = state.db.lock();
    let info = backup::run_backup(&conn, &state.app_data_dir)?;
    drop(conn);
    state.clear_backup_request();
    Ok(Some(info))
}

#[tauri::command]
pub fn backup_restore_sqlite(
    state: tauri::State<'_, Arc<AppState>>,
    path: String,
) -> AppResult<()> {
    backup::restore_sqlite_backup(&state, std::path::Path::new(&path))
}
