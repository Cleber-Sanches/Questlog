use crate::error::{AppError, AppResult};
use crate::steam::paths::http_client;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchItem {
    pub app_id: String,
    pub name: String,
    pub image: String,
    pub steamdb_url: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub items: Vec<SearchItem>,
}

struct CacheEntry {
    at: Instant,
    items: Vec<SearchItem>,
}

fn search_cache() -> &'static Mutex<HashMap<String, CacheEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn type_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn looks_like_non_game(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    [
        "soundtrack",
        " ost",
        "dlc",
        "demo",
        "playtest",
        "beta",
        "server",
        "dedicated server",
        "season pass",
        "expansion pass",
        "expansion",
        "expansão",
        "expansao",
        "cosmetic",
        "bundle",
        "pacote",
        "artbook",
        "art book",
        "digital extras",
        "digital deluxe upgrade",
        "theme pack",
        "prologue",
        "wallpaper",
        "original soundtrack",
    ]
    .iter()
    .any(|k| n.contains(k))
        || n.starts_with("atualização para")
        || n.starts_with("atualizacao para")
        || n.starts_with("upgrade to")
}

fn store_item_type_rejected(item: &Value) -> bool {
    match item
        .get("type")
        .and_then(|v| v.as_str())
        .map(|s| s.to_ascii_lowercase())
    {
        Some(ref t)
            if matches!(
                t.as_str(),
                "dlc"
                    | "music"
                    | "video"
                    | "bundle"
                    | "hardware"
                    | "mod"
                    | "advertising"
                    | "demo"
                    | "episode"
            ) =>
        {
            true
        }
        _ => false,
    }
}

/// Confirma via appdetails se o app é jogo base (`type == game`).
fn steam_app_is_game(app_id: &str) -> bool {
    if let Ok(cache) = type_cache().lock() {
        if let Some(t) = cache.get(app_id) {
            return t == "game";
        }
    }

    let Ok(client) = http_client() else {
        return true; // sem rede extra: não bloqueia resultado já filtrado
    };
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={app_id}&filters=basic"
    );
    let parsed: Value = match client
        .get(&url)
        .timeout(Duration::from_secs(4))
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.json())
    {
        Ok(v) => v,
        Err(_) => return false,
    };

    let app_type = parsed
        .get(app_id)
        .and_then(|v| v.get("data"))
        .and_then(|v| v.get("type"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if let Ok(mut cache) = type_cache().lock() {
        if !app_type.is_empty() {
            cache.insert(app_id.to_string(), app_type.clone());
            if cache.len() > 512 {
                cache.clear();
            }
        }
    }

    app_type == "game"
}

pub fn search_steam_games(query: &str) -> AppResult<SearchResult> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(SearchResult { items: vec![] });
    }

    let cache_key = format!("v2:{}", q.to_ascii_lowercase());
    if let Ok(cache) = search_cache().lock() {
        if let Some(entry) = cache.get(&cache_key) {
            if entry.at.elapsed() < Duration::from_secs(120) {
                return Ok(SearchResult {
                    items: entry.items.clone(),
                });
            }
        }
    }

    // category1=998 = jogos — ainda assim a Steam mistura DLC; validamos o type depois.
    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=brazilian&cc=BR&category1=998",
        urlencoding::encode(q)
    );

    let client = http_client()?;
    let data: Value = client
        .get(&url)
        .timeout(Duration::from_secs(8))
        .send()?
        .error_for_status()?
        .json()?;

    let items = data
        .get("items")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut out = Vec::new();
    for item in items.into_iter().take(24) {
        if store_item_type_rejected(&item) {
            continue;
        }
        let id = item
            .get("id")
            .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|n| n as u64)))
            .map(|n| n.to_string())
            .or_else(|| item.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()));
        let Some(app_id) = id else { continue };
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() || looks_like_non_game(&name) {
            continue;
        }
        // Garante jogo base (exclui DLC/music/etc. que a storesearch às vezes devolve como "app").
        if !steam_app_is_game(&app_id) {
            continue;
        }
        let image = item
            .pointer("/tiny_image")
            .or_else(|| item.get("tiny_image"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                format!(
                    "https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/capsule_231x87.jpg"
                )
            });
        out.push(SearchItem {
            steamdb_url: format!("https://steamdb.info/app/{app_id}/"),
            app_id,
            name,
            image,
        });
        if out.len() >= 10 {
            break;
        }
    }

    if let Ok(mut cache) = search_cache().lock() {
        cache.insert(
            cache_key,
            CacheEntry {
                at: Instant::now(),
                items: out.clone(),
            },
        );
        if cache.len() > 64 {
            cache.retain(|_, v| v.at.elapsed() < Duration::from_secs(120));
        }
    }

    Ok(SearchResult { items: out })
}

pub fn validate_app_id(app_id: &str) -> AppResult<()> {
    if app_id.chars().all(|c| c.is_ascii_digit()) && !app_id.is_empty() {
        Ok(())
    } else {
        Err(AppError::from("appId inválido"))
    }
}
