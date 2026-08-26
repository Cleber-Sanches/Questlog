use crate::db::repos;
use crate::error::{AppError, AppResult};
use chrono::Local;
use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const RETENTION: usize = 10;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub external_path: Option<String>,
    pub created_at: String,
}

pub fn backups_dir(app_data: &Path) -> PathBuf {
    app_data.join("backups")
}

pub fn run_backup(conn: &Connection, app_data: &Path) -> AppResult<BackupInfo> {
    let dir = backups_dir(app_data);
    fs::create_dir_all(&dir)?;

    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let filename = format!("guia-{stamp}.sqlite");
    let dest = dir.join(&filename);

    // Checkpoint WAL then consistent copy via VACUUM INTO
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    conn.execute(
        "VACUUM INTO ?1",
        rusqlite::params![dest.to_string_lossy().to_string()],
    )?;

    prune_dir(&dir)?;

    let mut external_path = None;
    if let Some(ext) = repos::get_setting(conn, "external_backup_dir")? {
        let ext_path = PathBuf::from(&ext);
        if !ext.trim().is_empty() {
            fs::create_dir_all(&ext_path)?;
            let ext_dest = ext_path.join(&filename);
            fs::copy(&dest, &ext_dest)?;
            prune_dir(&ext_path)?;
            external_path = Some(ext_dest.to_string_lossy().to_string());
        }
    }

    let created_at = Local::now().to_rfc3339();
    repos::set_setting(conn, "last_backup_at", &created_at)?;
    repos::set_setting(conn, "last_backup_path", &dest.to_string_lossy())?;

    Ok(BackupInfo {
        path: dest.to_string_lossy().to_string(),
        external_path,
        created_at,
    })
}

fn prune_dir(dir: &Path) -> AppResult<()> {
    let mut files: Vec<_> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.eq_ignore_ascii_case("sqlite"))
                .unwrap_or(false)
        })
        .collect();

    files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    while files.len() > RETENTION {
        if let Some(oldest) = files.first() {
            let _ = fs::remove_file(oldest.path());
            files.remove(0);
        } else {
            break;
        }
    }
    Ok(())
}

pub fn set_external_dir(conn: &Connection, path: &str) -> AppResult<()> {
    if path.trim().is_empty() {
        conn.execute(
            "DELETE FROM app_settings WHERE key = 'external_backup_dir'",
            [],
        )?;
        return Ok(());
    }
    let p = PathBuf::from(path);
    if !p.exists() {
        fs::create_dir_all(&p).map_err(|e| {
            AppError::Message(format!("Não foi possível criar pasta de backup: {e}"))
        })?;
    }
    repos::set_setting(conn, "external_backup_dir", path)
}

pub fn restore_sqlite_backup(
    state: &crate::state::AppState,
    source: &Path,
) -> AppResult<()> {
    if !source.exists() {
        return Err(AppError::from("Arquivo de backup não encontrado"));
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default();
    if !ext.eq_ignore_ascii_case("sqlite") && !ext.eq_ignore_ascii_case("db") {
        return Err(AppError::from("Selecione um arquivo .sqlite de backup"));
    }

    let db_path = state.app_data_dir.join("guia.sqlite");
    let wal_path = db_path.with_extension("sqlite-wal");
    let shm_path = db_path.with_extension("sqlite-shm");

    {
        let mut guard = state.db.lock();
        let placeholder = Connection::open_in_memory()?;
        let old = std::mem::replace(&mut *guard, placeholder);
        drop(old);
    }

    fs::copy(source, &db_path)?;
    let _ = fs::remove_file(wal_path);
    let _ = fs::remove_file(shm_path);

    let fresh = crate::db::schema::open_db(&db_path)?;
    *state.db.lock() = fresh;
    Ok(())
}
