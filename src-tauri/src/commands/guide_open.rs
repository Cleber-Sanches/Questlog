use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

pub struct PendingGuideOpens(pub Mutex<Vec<String>>);

pub fn is_guide_open_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    !path.starts_with('-')
        && (lower.ends_with(".questlog") || lower.ends_with(".json") || lower.ends_with(".txt"))
}

pub fn guide_paths_from_args(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| is_guide_open_path(arg))
        .filter(|arg| Path::new(arg.as_str()).is_file())
        .cloned()
        .collect()
}

pub fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn emit_guide_open_paths(app: &AppHandle, paths: &[String]) {
    for path in paths {
        let _ = app.emit("guide-open-path", path.clone());
    }
}

#[tauri::command]
pub fn take_pending_guide_opens(state: State<'_, PendingGuideOpens>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap_or_else(|e| e.into_inner()))
}

#[tauri::command]
pub fn read_guide_open_file(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if !is_guide_open_path(trimmed) {
        return Err("tipo de arquivo inválido".into());
    }
    let file = PathBuf::from(trimmed);
    if !file.is_file() {
        return Err("arquivo não encontrado".into());
    }
    std::fs::read_to_string(&file).map_err(|e| e.to_string())
}
