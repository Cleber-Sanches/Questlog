mod backup;
mod commands;
mod db;
mod error;
mod state;
mod steam;
mod ai;

use state::AppState;
use std::time::Duration;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon().cloned() {
                    let _ = window.set_icon(icon);
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_data = app
                .path()
                .app_data_dir()
                .expect("app_data_dir indisponível");
            std::fs::create_dir_all(&app_data)?;
            let db_path = app_data.join("guia.sqlite");
            let conn = db::schema::open_db(&db_path)?;
            let state = AppState::new(conn, app_data);
            app.manage(state.clone());
            app.manage(commands::desktop::DesktopFlags::new());
            commands::desktop::prepare_overlay(app.handle());
            if let Err(err) = commands::desktop::install_tray(app.handle(), &state) {
                log::warn!("bandeja: {err}");
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(10));
                if let Some(state) = handle.try_state::<std::sync::Arc<AppState>>() {
                    if state.should_auto_backup(Duration::from_secs(30)) {
                        let conn = state.db.lock();
                        if backup::run_backup(&conn, &state.app_data_dir).is_ok() {
                            drop(conn);
                            state.clear_backup_request();
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            commands::desktop::handle_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            commands::db::db_get_bootstrap,
            commands::db::db_upsert_game,
            commands::db::db_set_game_archived,
            commands::db::db_delete_game,
            commands::db::db_set_active_game,
            commands::db::db_list_achievements,
            commands::db::db_set_achievements,
            commands::db::db_patch_achievement,
            commands::db::db_insert_achievement,
            commands::db::db_delete_achievement,
            commands::db::db_set_setting,
            commands::db::db_set_collapsed,
            commands::db::db_import_profile,
            commands::db::db_export_profile,
            commands::steam::get_steam_progress_cmd,
            commands::steam::search_steam_games_cmd,
            commands::steam::get_steam_achievements_cmd,
            commands::steam::steam_refresh_locale_texts_cmd,
            commands::steam::get_steam_dlc_groups_cmd,
            commands::steam::get_steam_client_icon_cmd,
            commands::steam::steam_get_settings,
            commands::steam::steam_set_install_dir,
            commands::backup::backup_now,
            commands::backup::backup_set_external_dir,
            commands::backup::backup_get_status,
            commands::backup::backup_maybe_auto,
            commands::backup::backup_restore_sqlite,
            commands::system::open_external_url,
            commands::desktop::overlay_show_unlock,
            commands::desktop::overlay_hide,
            commands::desktop::app_show_main,
            commands::desktop::app_to_tray,
            commands::desktop::app_minimize_or_tray,
            commands::desktop::app_close_or_tray,
            commands::desktop::app_quit,
            commands::ai::ai_get_settings,
            commands::ai::ai_save_settings,
            commands::ai::ai_detect_cli,
            commands::ai::ai_test_auth,
            commands::ai::ai_cli_login,
            commands::ai::ai_list_models,
            commands::ai::ai_chat_turn,
            commands::ai::ai_chat_cancel,
            commands::ai::ai_enrich_guide,
            commands::media::media_get_root,
            commands::media::media_save_base64,
            commands::media::media_save_from_url,
            commands::media::media_resolve_path,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar Questlog");
}
