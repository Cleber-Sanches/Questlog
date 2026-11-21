use crate::commands::desktop::raise_unlock_overlay;
use crate::db::repos;
use crate::error::AppResult;
use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, LogicalPosition, Manager, State, WebviewWindow};

pub const COMPANION_LABEL: &str = "companion";
pub const SETTING_COMPANION: &str = "desktop_companion_overlay";
pub const SETTING_HOTKEY: &str = "desktop_companion_hotkey";
pub const DEFAULT_HOTKEY: &str = "Ctrl+Shift+Q";

const COMPANION_WIDTH: f64 = 440.0;
const COMPANION_HEIGHT: f64 = 720.0;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionItem {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub tips: Option<String>,
    pub icon: Option<String>,
    pub difficulty: Option<String>,
    pub missable: bool,
    pub hidden: bool,
    pub progress: Option<i64>,
    pub progress_max: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionSnapshot {
    pub locale: String,
    pub game_name: Option<String>,
    pub game_app_id: Option<String>,
    pub completed: i64,
    pub total: i64,
    pub missing: Vec<CompanionItem>,
    pub show_hidden: bool,
    pub hotkey: String,
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

fn setting_value(state: &AppState, key: &str) -> Option<String> {
    let conn = state.db.lock();
    repos::get_setting(&conn, key).ok().flatten()
}

pub fn normalize_hotkey(raw: &str) -> AppResult<String> {
    let mut mods: Vec<&'static str> = Vec::new();
    let mut key: Option<String> = None;

    for part in raw.split('+') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        let lower = trimmed.to_ascii_lowercase();
        match lower.as_str() {
            "ctrl" | "control" | "controlleft" | "controlright" => push_mod(&mut mods, "Ctrl"),
            "cmd" | "command" | "super" | "meta" | "win" | "windows" | "metaleft" | "metaright" => {
                push_mod(&mut mods, "Super")
            }
            "alt" | "option" | "altleft" | "altright" => push_mod(&mut mods, "Alt"),
            "shift" | "shiftleft" | "shiftright" => push_mod(&mut mods, "Shift"),
            other => {
                if key.is_some() {
                    return Err("atalho inválido".into());
                }
                key = Some(display_key(other));
            }
        }
    }

    let Some(key) = key else {
        return Err("atalho precisa de uma tecla".into());
    };
    if !mods.iter().any(|m| *m == "Ctrl" || *m == "Alt" || *m == "Super") {
        return Err("atalho precisa de Ctrl, Alt ou Super".into());
    }

    let mut out = mods
        .into_iter()
        .map(|m| m.to_string())
        .collect::<Vec<_>>();
    out.push(key);
    Ok(out.join("+"))
}

fn push_mod(mods: &mut Vec<&'static str>, value: &'static str) {
    if !mods.contains(&value) {
        mods.push(value);
    }
}

fn display_key(raw: &str) -> String {
    match raw {
        " " | "space" => "Space".into(),
        "escape" | "esc" => "Esc".into(),
        "arrowup" => "Up".into(),
        "arrowdown" => "Down".into(),
        "arrowleft" => "Left".into(),
        "arrowright" => "Right".into(),
        other if other.len() == 1 => other.to_ascii_uppercase(),
        other => {
            let mut chars = other.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                None => other.to_string(),
            }
        }
    }
}

fn to_accelerator(display: &str) -> String {
    display
        .split('+')
        .map(|part| match part {
            "Ctrl" => "Control",
            other => other,
        })
        .collect::<Vec<_>>()
        .join("+")
}

pub fn prepare_companion(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(COMPANION_LABEL) {
        let _ = window.set_skip_taskbar(true);
        let _ = window.set_always_on_top(true);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_focusable(true);
        let _ = window.hide();
    }
}

fn place_companion(window: &WebviewWindow) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        let _ = window.set_size(tauri::LogicalSize::new(COMPANION_WIDTH, COMPANION_HEIGHT));
        return;
    };
    let screen = monitor.size();
    let origin = monitor.position();
    let scale = monitor.scale_factor();
    let screen_w = screen.width as f64 / scale;
    let screen_h = screen.height as f64 / scale;
    let x = origin.x as f64 / scale + screen_w - COMPANION_WIDTH - 24.0;
    let y = origin.y as f64 / scale + ((screen_h - COMPANION_HEIGHT) / 2.0).max(24.0);
    let _ = window.set_size(tauri::LogicalSize::new(COMPANION_WIDTH, COMPANION_HEIGHT));
    let _ = window.set_position(LogicalPosition::new(x, y));
}

fn hide_companion(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(COMPANION_LABEL) {
        let _ = window.hide();
    }
}

fn show_companion(app: &AppHandle) -> AppResult<()> {
    let Some(window) = app.get_webview_window(COMPANION_LABEL) else {
        return Err("janela companion indisponível".into());
    };
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_always_on_top(true);
    let _ = window.set_ignore_cursor_events(false);
    let _ = window.set_focusable(true);
    place_companion(&window);
    let _ = window.show();
    let _ = window.set_focus();
    raise_unlock_overlay(app);
    let emit_win = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(80));
        let _ = emit_win.emit("companion-shown", ());
    });
    Ok(())
}

pub fn toggle_companion_window(app: &AppHandle) -> AppResult<()> {
    let Some(state) = app.try_state::<Arc<AppState>>() else {
        return Ok(());
    };
    if !setting_on(&state, SETTING_COMPANION, true) {
        hide_companion(app);
        return Ok(());
    }
    let Some(window) = app.get_webview_window(COMPANION_LABEL) else {
        return Err("janela companion indisponível".into());
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return Ok(());
    }
    show_companion(app)
}

pub fn on_hotkey(app: &AppHandle) {
    if let Err(err) = toggle_companion_window(app) {
        log::warn!("companion hotkey: {err}");
    }
}

pub fn refresh_shortcut(app: &AppHandle) -> AppResult<()> {
    #[cfg(desktop)]
    {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;

        let _ = app.global_shortcut().unregister_all();
        let Some(state) = app.try_state::<Arc<AppState>>() else {
            return Ok(());
        };
        if !setting_on(&state, SETTING_COMPANION, true) {
            hide_companion(app);
            return Ok(());
        }
        let raw = setting_value(&state, SETTING_HOTKEY).unwrap_or_else(|| DEFAULT_HOTKEY.into());
        let display = normalize_hotkey(&raw).unwrap_or_else(|_| DEFAULT_HOTKEY.into());
        let accel = to_accelerator(&display);
        app.global_shortcut()
            .register(accel.as_str())
            .map_err(|err| format!("não foi possível registrar o atalho: {err}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn companion_toggle(app: AppHandle) -> AppResult<()> {
    toggle_companion_window(&app)
}

#[tauri::command]
pub fn companion_hide(app: AppHandle) -> AppResult<()> {
    hide_companion(&app);
    Ok(())
}

#[tauri::command]
pub fn companion_refresh_shortcut(app: AppHandle) -> AppResult<()> {
    refresh_shortcut(&app)
}

#[tauri::command]
pub fn companion_set_hotkey(
    app: AppHandle,
    state: State<Arc<AppState>>,
    hotkey: String,
) -> AppResult<String> {
    let display = normalize_hotkey(&hotkey)?;
    {
        let conn = state.db.lock();
        repos::set_setting(&conn, SETTING_HOTKEY, &display)?;
    }
    refresh_shortcut(&app)?;
    Ok(display)
}

#[tauri::command]
pub fn companion_get_snapshot(state: State<Arc<AppState>>) -> AppResult<CompanionSnapshot> {
    let conn = state.db.lock();
    let locale = repos::get_setting(&conn, "locale")?.unwrap_or_else(|| "pt".into());
    let english = locale.to_ascii_lowercase().starts_with("en");
    let show_hidden = match repos::get_setting(&conn, "show_hidden_achievements")? {
        Some(value) => {
            let v = value.trim();
            v == "1" || v.eq_ignore_ascii_case("true")
        }
        None => false,
    };
    let hotkey = repos::get_setting(&conn, SETTING_HOTKEY)?
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_HOTKEY.into());
    let game_app_id = repos::get_setting(&conn, "active_game_app_id")?;
    let games = repos::list_games(&conn)?;
    let game = game_app_id
        .as_ref()
        .and_then(|id| games.iter().find(|g| g.app_id == *id));
    let game_name = game.map(|g| g.name.clone());

    let mut completed = 0i64;
    let mut total = 0i64;
    let mut missing = Vec::new();

    if let Some(app_id) = game_app_id.as_deref() {
        let items = repos::list_achievements(&conn, app_id)?;
        total = items.len() as i64;
        for item in items {
            if item.completed {
                completed += 1;
                continue;
            }
            let title = if english {
                item.title_en
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or(&item.title)
                    .to_string()
            } else {
                item.title.clone()
            };
            let description = if english {
                item.description_en
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .or(item.description.clone())
            } else {
                item.description.clone()
            };
            missing.push(CompanionItem {
                id: item.id,
                title,
                description,
                tips: item.tips,
                icon: item.icon,
                difficulty: item.difficulty,
                missable: item.missable,
                hidden: item.hidden,
                progress: item.progress,
                progress_max: item.progress_max,
            });
        }
    }

    Ok(CompanionSnapshot {
        locale,
        game_name,
        game_app_id,
        completed,
        total,
        missing,
        show_hidden,
        hotkey,
    })
}
