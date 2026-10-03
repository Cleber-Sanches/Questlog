use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedMedia {
    /// Chave estável: `{appId}/{uuid}.ext`
    pub key: String,
    /// Caminho absoluto no disco
    pub path: String,
    /// Token para HTML/quill: `guia-media:appId/file.ext`
    pub token: String,
}

fn media_root(app_data: &Path) -> PathBuf {
    app_data.join("media")
}

fn sanitize_app_id(app_id: &str) -> String {
    app_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn ext_from_mime(mime: &str) -> &'static str {
    let m = mime.to_ascii_lowercase();
    if m.contains("png") {
        "png"
    } else if m.contains("webp") {
        "webp"
    } else if m.contains("gif") {
        "gif"
    } else if m.contains("jpeg") || m.contains("jpg") {
        "jpg"
    } else if m.contains("svg") {
        "svg"
    } else {
        "bin"
    }
}

fn ext_from_url(url: &str) -> &'static str {
    let lower = url.to_ascii_lowercase();
    if lower.contains(".png") {
        "png"
    } else if lower.contains(".webp") {
        "webp"
    } else if lower.contains(".gif") {
        "gif"
    } else if lower.contains(".svg") {
        "svg"
    } else {
        "jpg"
    }
}

fn write_bytes(app_data: &Path, app_id: &str, bytes: &[u8], ext: &str) -> AppResult<SavedMedia> {
    if bytes.is_empty() {
        return Err(AppError::Message("Arquivo de imagem vazio.".into()));
    }
    if bytes.len() > 12 * 1024 * 1024 {
        return Err(AppError::Message("Imagem muito grande (máx. 12 MB).".into()));
    }
    let app = sanitize_app_id(app_id);
    let dir = media_root(app_data).join(&app);
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Message(format!("Falha ao criar pasta de mídia: {e}")))?;
    let name = format!("{}.{}", Uuid::new_v4(), ext.trim_matches('.'));
    let path = dir.join(&name);
    std::fs::write(&path, bytes)
        .map_err(|e| AppError::Message(format!("Falha ao salvar imagem: {e}")))?;
    let key = format!("{app}/{name}");
    Ok(SavedMedia {
        path: path.to_string_lossy().into_owned(),
        token: format!("guia-media:{key}"),
        key,
    })
}

pub fn save_url_to_media(app_data: &Path, app_id: &str, url: &str) -> AppResult<SavedMedia> {
    let url = rewrite_media_url(url.trim());
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(AppError::Message("URL de imagem inválida.".into()));
    }

    let client = crate::steam::paths::http_client()?;
    let res = client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
        .send()
        .map_err(|e| AppError::Message(format!("Download da imagem falhou: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Message(format!("Download da imagem falhou: {e}")))?;

    let mime = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = res
        .bytes()
        .map_err(|e| AppError::Message(format!("Download da imagem falhou: {e}")))?;

    // Resposta HTML (página 404) não é imagem
    if mime.to_ascii_lowercase().contains("text/html") {
        return Err(AppError::Message(format!(
            "URL não é imagem (HTML): {url}"
        )));
    }
    if bytes.len() < 64 {
        return Err(AppError::Message("Download da imagem muito pequeno.".into()));
    }

    let ext = if !mime.is_empty() && !mime.contains("octet-stream") {
        ext_from_mime(&mime)
    } else {
        ext_from_url(&url)
    };
    write_bytes(app_data, app_id, &bytes, ext)
}

/// Corrige URLs quebradas comuns (wiki Valheim weirdgloop `/w/images` → `/images`).
fn rewrite_media_url(url: &str) -> String {
    let mut u = url.to_string();
    // weirdgloop: /w/images/... e /w/Images/... 404; /images/... funciona
    if u.contains("weirdgloop.org/w/images/") || u.contains("weirdgloop.org/w/Images/") {
        u = u.replace("/w/images/", "/images/");
        u = u.replace("/w/Images/", "/images/");
    }
    u
}

/// Baixa imagens http(s) em HTML e troca por `guia-media:...`.
pub fn materialize_html_images(app_data: &Path, app_id: &str, html: &str) -> String {
    let re = match regex::Regex::new(r#"(?i)(<img\b[^>]*\bsrc\s*=\s*)(["'])(https?://[^"']+)\2"#) {
        Ok(r) => r,
        Err(_) => return html.to_string(),
    };
    let mut out = html.to_string();
    let caps: Vec<_> = re.captures_iter(html).collect();
    for cap in caps.into_iter().rev() {
        let full = cap.get(0).map(|m| m.as_str()).unwrap_or("");
        let prefix = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let quote = cap.get(2).map(|m| m.as_str()).unwrap_or("\"");
        let url = cap.get(3).map(|m| m.as_str()).unwrap_or("");
        if url.is_empty() {
            continue;
        }
        if let Ok(saved) = save_url_to_media(app_data, app_id, url) {
            let repl = format!("{prefix}{quote}{}{quote}", saved.token);
            if let Some(pos) = out.rfind(full) {
                out.replace_range(pos..pos + full.len(), &repl);
            }
        }
    }
    // Markdown ![alt](url) → <img>; baixa se possível, senão mantém URL remota.
    let md = match regex::Regex::new(r"!\[([^\]]*)\]\(\s*<?(https?://[^)\s>]+)>?\s*\)") {
        Ok(r) => r,
        Err(_) => return out,
    };
    let source = out.clone();
    let md_caps: Vec<_> = md.captures_iter(&source).collect();
    for cap in md_caps.into_iter().rev() {
        let full = cap.get(0).map(|m| m.as_str()).unwrap_or("");
        let alt = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let url = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        if url.is_empty() {
            continue;
        }
        let src = match save_url_to_media(app_data, app_id, url) {
            Ok(saved) => saved.token,
            Err(_) => url.to_string(),
        };
        let safe_alt = alt.replace('"', "&quot;");
        let repl = format!(r#"<img src="{src}" alt="{safe_alt}" />"#);
        if let Some(pos) = out.rfind(full) {
            out.replace_range(pos..pos + full.len(), &repl);
        }
    }
    out
}

#[tauri::command]
pub fn media_get_root(state: tauri::State<'_, Arc<AppState>>) -> AppResult<String> {
    let root = media_root(&state.app_data_dir);
    std::fs::create_dir_all(&root)
        .map_err(|e| AppError::Message(format!("Falha ao criar pasta de mídia: {e}")))?;
    Ok(root.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn media_save_base64(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    data: String,
    mime: Option<String>,
) -> AppResult<SavedMedia> {
    let raw = data.trim();
    let (mime_guess, b64) = if let Some(rest) = raw.strip_prefix("data:") {
        let (meta, payload) = rest
            .split_once(',')
            .ok_or_else(|| AppError::Message("Data URL inválida.".into()))?;
        let mime = meta.split(';').next().unwrap_or("image/png").to_string();
        (mime, payload)
    } else {
        (mime.unwrap_or_else(|| "image/png".into()), raw)
    };

    let bytes = {
        use base64::Engine as _;
        base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(b64.trim()))
            .map_err(|e| AppError::Message(format!("Base64 inválido: {e}")))?
    };

    write_bytes(
        &state.app_data_dir,
        &app_id,
        &bytes,
        ext_from_mime(&mime_guess),
    )
}

#[tauri::command]
pub fn media_save_from_url(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    url: String,
) -> AppResult<SavedMedia> {
    save_url_to_media(&state.app_data_dir, &app_id, &url)
}

#[tauri::command]
pub fn media_resolve_path(
    state: tauri::State<'_, Arc<AppState>>,
    key: String,
) -> AppResult<String> {
    let key = key
        .trim()
        .trim_start_matches("guia-media:")
        .trim_start_matches("guia-media%3A");
    if key.is_empty() || key.contains("..") {
        return Err(AppError::Message("Chave de mídia inválida.".into()));
    }
    let path = media_root(&state.app_data_dir).join(Path::new(key));
    if !path.is_file() {
        return Err(AppError::Message("Mídia não encontrada.".into()));
    }
    Ok(path.to_string_lossy().into_owned())
}
