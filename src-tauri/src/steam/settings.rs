use crate::db::repos;
use crate::error::AppResult;
use crate::steam::paths::{detect_steam_path, validate_steam_root};
use rusqlite::Connection;
use serde::Serialize;

const KEY: &str = "steam_install_dir";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamSettingsStatus {
    pub install_dir: Option<String>,
    pub detected_dir: Option<String>,
}

pub fn get_status(conn: &Connection) -> AppResult<SteamSettingsStatus> {
    let install_dir = repos::get_setting(conn, KEY)?;
    let detected_dir = detect_steam_path(None).map(|p| p.to_string_lossy().to_string());
    Ok(SteamSettingsStatus {
        install_dir,
        detected_dir,
    })
}

pub fn set_install_dir(conn: &Connection, path: &str) -> AppResult<()> {
    if path.trim().is_empty() {
        conn.execute("DELETE FROM app_settings WHERE key = ?1", [KEY])?;
        return Ok(());
    }
    let root = validate_steam_root(path)?;
    repos::set_setting(conn, KEY, &root.to_string_lossy())
}

pub fn read_install_dir(conn: &Connection) -> Option<String> {
    repos::get_setting(conn, KEY)
        .ok()
        .flatten()
        .filter(|s| !s.trim().is_empty())
}
