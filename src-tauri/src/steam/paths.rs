use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamUser {
    pub persona_name: Option<String>,
    pub account_name: Option<String>,
    pub steam_id3: String,
    pub steam_id64: String,
}

pub fn find_steam_path(custom: Option<&str>) -> AppResult<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(p) = custom {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            candidates.push(PathBuf::from(trimmed));
        }
    }
    if let Ok(p) = std::env::var("STEAM_PATH") {
        if !p.trim().is_empty() {
            candidates.push(PathBuf::from(p));
        }
    }
    candidates.push(PathBuf::from(r"C:\Program Files (x86)\Steam"));
    candidates.push(PathBuf::from(r"C:\Program Files\Steam"));

    for candidate in candidates {
        if candidate.join("appcache").join("stats").is_dir() {
            return Ok(candidate);
        }
    }

    Err(AppError::from(
        "Não encontrei a instalação da Steam. Escolha a pasta nas configurações.",
    ))
}

pub fn find_steam_path_optional(custom: Option<&str>) -> Option<PathBuf> {
    find_steam_path(custom).ok()
}

pub fn detect_steam_path(custom: Option<&str>) -> Option<PathBuf> {
    find_steam_path(custom).ok()
}

pub fn validate_steam_root(path: &str) -> AppResult<PathBuf> {
    let root = PathBuf::from(path.trim());
    if root.join("appcache").join("stats").is_dir() {
        return Ok(root);
    }
    Err(AppError::from(
        "Pasta inválida. Selecione a pasta raiz da Steam (onde ficam appcache e steamapps).",
    ))
}

#[derive(Debug)]
struct LoginUser {
    steam_id64: String,
    account_name: Option<String>,
    persona_name: Option<String>,
    timestamp: i64,
    auto_login: bool,
}

fn parse_login_users(text: &str) -> Vec<LoginUser> {
    let mut users = Vec::new();
    let re = regex::Regex::new(r#""(\d{17})"\s*\{([^}]*)\}"#).unwrap();
    for caps in re.captures_iter(text) {
        let steam_id64 = caps[1].to_string();
        let body = &caps[2];
        let get = |key: &str| -> Option<String> {
            let pat = format!(r#""{key}"\s*"([^"]*)""#);
            regex::Regex::new(&pat)
                .ok()
                .and_then(|r| r.captures(body).map(|c| c[1].to_string()))
        };
        users.push(LoginUser {
            steam_id64,
            account_name: get("AccountName"),
            persona_name: get("PersonaName"),
            timestamp: get("Timestamp")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            auto_login: get("AutoLogin").as_deref() == Some("1"),
        });
    }
    users
}

pub fn pick_active_user(steam_path: &Path) -> AppResult<SteamUser> {
    let login_path = steam_path.join("config").join("loginusers.vdf");
    let text = fs::read_to_string(&login_path)?;
    let mut users = parse_login_users(&text);
    if users.is_empty() {
        return Err(AppError::from("Não encontrei nenhuma conta em loginusers.vdf."));
    }

    users.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    let chosen = users
        .iter()
        .find(|u| u.auto_login)
        .or_else(|| users.first())
        .unwrap();

    let steam_id64: u64 = chosen
        .steam_id64
        .parse()
        .map_err(|_| AppError::from("SteamID64 inválido"))?;
    let steam_id3 = (steam_id64 - 76561197960265728).to_string();

    Ok(SteamUser {
        persona_name: chosen.persona_name.clone(),
        account_name: chosen.account_name.clone(),
        steam_id3,
        steam_id64: chosen.steam_id64.clone(),
    })
}

pub fn extract_icon_hash(icon_file: &str) -> Option<String> {
    let re = regex::Regex::new(r"([a-fA-F0-9]{40})").ok()?;
    re.captures(icon_file)
        .map(|c| c[1].to_ascii_lowercase())
}

pub fn http_client() -> AppResult<&'static reqwest::blocking::Client> {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    if let Some(c) = CLIENT.get() {
        return Ok(c);
    }
    let built = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .pool_max_idle_per_host(4)
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(AppError::from)?;
    let _ = CLIENT.set(built);
    Ok(CLIENT.get().expect("http client"))
}

pub fn fetch_text(url: &str) -> AppResult<String> {
    let client = http_client()?;
    let res = client
        .get(url)
        .header("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8")
        .header(
            "Accept",
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        )
        .send()?;
    if !res.status().is_success() {
        return Err(AppError::Message(format!(
            "HTTP {} em {url}",
            res.status()
        )));
    }
    Ok(res.text()?)
}

pub fn fetch_json(url: &str) -> AppResult<serde_json::Value> {
    let text = fetch_text(url)?;
    Ok(serde_json::from_str(&text)?)
}
