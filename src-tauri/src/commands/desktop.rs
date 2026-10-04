use crate::backup;
use crate::db::repos;
use crate::error::AppResult;
use crate::state::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

pub const MAIN_LABEL: &str = "main";
pub const SETTING_TRAY: &str = "minimize_to_tray";

pub struct DesktopFlags {
    pub allow_exit: AtomicBool,
}

impl DesktopFlags {
    pub fn new() -> Self {
        Self {
            allow_exit: AtomicBool::new(false),
        }
    }
}

fn setting_on(state: &AppState, key: &str, default: bool) -> bool {
    let conn = state.db.lock();
    match repos::get_setting(&conn, key) {
        Ok(Some(value)) => {
            let v = value.trim();
            v == "1" || v.eq_ignore_ascii_case("true")
        }
        _ => default,
    }
}

fn tray_enabled(state: &AppState) -> bool {
    setting_on(state, SETTING_TRAY, true)
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.hide();
    }
}

fn backup_now(app: &AppHandle) {
    if let Some(state) = app.try_state::<Arc<AppState>>() {
        let conn = state.db.lock();
        let _ = backup::run_backup(&conn, &state.app_data_dir);
    }
}

#[tauri::command]
pub fn app_show_main(app: AppHandle) -> AppResult<()> {
    show_main(&app);
    Ok(())
}

#[tauri::command]
pub fn app_to_tray(app: AppHandle) -> AppResult<()> {
    hide_main(&app);
    Ok(())
}

#[tauri::command]
pub fn app_minimize_or_tray(app: AppHandle, state: State<Arc<AppState>>) -> AppResult<()> {
    if tray_enabled(&state) {
        hide_main(&app);
    } else if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.minimize();
    }
    Ok(())
}

#[tauri::command]
pub fn app_close_or_tray(
    app: AppHandle,
    state: State<Arc<AppState>>,
    flags: State<DesktopFlags>,
) -> AppResult<()> {
    if tray_enabled(&state) && !flags.allow_exit.load(Ordering::SeqCst) {
        hide_main(&app);
        return Ok(());
    }
    app_quit_inner(&app, &flags);
    Ok(())
}

#[tauri::command]
pub fn app_quit(app: AppHandle, flags: State<DesktopFlags>) -> AppResult<()> {
    app_quit_inner(&app, &flags);
    Ok(())
}

fn app_quit_inner(app: &AppHandle, flags: &DesktopFlags) {
    flags.allow_exit.store(true, Ordering::SeqCst);
    backup_now(app);
    app.exit(0);
}

pub fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    let tauri::WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    if window.label() != MAIN_LABEL {
        return;
    }

    let app = window.app_handle();
    let to_tray = app
        .try_state::<Arc<AppState>>()
        .map(|state| tray_enabled(&state))
        .unwrap_or(true);
    let exiting = app
        .try_state::<DesktopFlags>()
        .map(|flags| flags.allow_exit.load(Ordering::SeqCst))
        .unwrap_or(false);

    if to_tray && !exiting {
        api.prevent_close();
        let _ = window.hide();
        return;
    }

    backup_now(&app);
}

pub fn install_tray(app: &AppHandle, state: &AppState) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let locale = {
        let conn = state.db.lock();
        repos::get_setting(&conn, "locale")
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let en = locale.to_ascii_lowercase().starts_with("en");
    let open_label = if en { "Open" } else { "Abrir" };
    let quit_label = if en { "Quit" } else { "Sair" };

    let open = MenuItem::with_id(app, "open", open_label, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Questlog")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "quit" => {
                if let Some(flags) = app.try_state::<DesktopFlags>() {
                    app_quit_inner(app, &flags);
                } else {
                    app.exit(0);
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}
