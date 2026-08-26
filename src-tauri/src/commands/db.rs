use crate::db::repos::{
    self, Achievement, Bootstrap, Game, ProfilePack,
};
use crate::error::AppResult;
use crate::state::AppState;
use serde_json::Value;
use std::sync::Arc;

#[tauri::command]
pub fn db_get_bootstrap(state: tauri::State<'_, Arc<AppState>>) -> AppResult<Bootstrap> {
    let conn = state.db.lock();
    repos::get_bootstrap(&conn)
}

#[tauri::command]
pub fn db_upsert_game(state: tauri::State<'_, Arc<AppState>>, game: Game) -> AppResult<()> {
    let conn = state.db.lock();
    repos::upsert_game(&conn, &game)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_set_game_archived(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    archived: bool,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::set_game_archived(&conn, &app_id, archived)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_delete_game(state: tauri::State<'_, Arc<AppState>>, app_id: String) -> AppResult<()> {
    let conn = state.db.lock();
    repos::delete_game(&conn, &app_id)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_set_active_game(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: Option<String>,
) -> AppResult<()> {
    let conn = state.db.lock();
    match app_id {
        Some(id) => repos::set_setting(&conn, "active_game_app_id", &id)?,
        None => {
            conn.execute(
                "DELETE FROM app_settings WHERE key = 'active_game_app_id'",
                [],
            )?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn db_list_achievements(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
) -> AppResult<Vec<Achievement>> {
    let conn = state.db.lock();
    repos::list_achievements(&conn, &app_id)
}

#[tauri::command]
pub fn db_set_achievements(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    achievements: Vec<Achievement>,
) -> AppResult<()> {
    let conn = state.db.lock();
    let tx = conn.unchecked_transaction()?;
    repos::set_achievements(&tx, &app_id, &achievements)?;
    tx.commit()?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_patch_achievement(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    achievement: Achievement,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::patch_achievement(&conn, &app_id, &achievement)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_insert_achievement(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    achievement: Achievement,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::insert_achievement(&conn, &app_id, &achievement)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_delete_achievement(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    id: i64,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::delete_achievement(&conn, &app_id, id)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_set_setting(
    state: tauri::State<'_, Arc<AppState>>,
    key: String,
    value: String,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::set_setting(&conn, &key, &value)
}

#[tauri::command]
pub fn db_set_collapsed(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    view: String,
    section_name: String,
    collapsed: bool,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::set_collapsed(&conn, &app_id, &view, &section_name, collapsed)
}

#[tauri::command]
pub fn db_import_profile(
    state: tauri::State<'_, Arc<AppState>>,
    pack: ProfilePack,
) -> AppResult<()> {
    let conn = state.db.lock();
    repos::import_profile(&conn, &pack)?;
    drop(conn);
    state.mark_dirty_for_backup();
    Ok(())
}

#[tauri::command]
pub fn db_export_profile(state: tauri::State<'_, Arc<AppState>>) -> AppResult<Value> {
    let conn = state.db.lock();
    repos::export_profile(&conn)
}
