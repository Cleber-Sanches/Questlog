use crate::error::{AppError, AppResult};

#[tauri::command]
pub fn open_external_url(url: String) -> AppResult<()> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(AppError::Message("URL vazia".into()));
    }
    let lower = trimmed.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(AppError::Message(
            "Só é permitido abrir URLs http(s)".into(),
        ));
    }
    open::that(trimmed).map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}
