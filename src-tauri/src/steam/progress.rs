use crate::error::{AppError, AppResult};
use crate::steam::bvdf;
use crate::steam::paths::{
    extract_icon_hash, fetch_text, find_steam_path, pick_active_user, SteamUser,
};
use chrono::{TimeZone, Utc};
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressAchievement {
    pub completed: bool,
    pub unlocked_at: Option<String>,
    pub title: String,
    pub icon: Option<String>,
    pub icon_hash: Option<String>,
    pub stat_group: String,
    pub bit_index: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamProgress {
    pub app_id: String,
    pub steam_user: SteamUser,
    pub mtime_ms: f64,
    /// `local` = cache Steam; `community` = perfil público (fallback)
    pub source: String,
    pub achievements: HashMap<String, ProgressAchievement>,
}

pub fn get_steam_progress(app_id: &str, custom_install_dir: Option<&str>) -> AppResult<SteamProgress> {
    let id = app_id.trim();
    if !id.chars().all(|c| c.is_ascii_digit()) || id.is_empty() {
        return Err(AppError::from("appId inválido"));
    }

    let steam_path = find_steam_path(custom_install_dir)?;
    let user = pick_active_user(&steam_path)?;

    let schema_path = steam_path
        .join("appcache")
        .join("stats")
        .join(format!("UserGameStatsSchema_{id}.bin"));
    let stats_path = steam_path
        .join("appcache")
        .join("stats")
        .join(format!("UserGameStats_{}_{id}.bin", user.steam_id3));

    if !schema_path.exists() {
        return Err(AppError::Message(format!(
            "Schema não encontrado para o app {id}. Abra o jogo pelo menos uma vez na Steam."
        )));
    }

    let mut mtime_ms = if stats_path.exists() {
        fs::metadata(&stats_path)?
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    } else {
        0.0
    };

    let schema_map = bvdf::parse(&fs::read(&schema_path)?)?;
    let app = schema_map
        .get(id)
        .ok_or_else(|| AppError::Message(format!("Schema inválido para o app {id}.")))?;
    let stats = app
        .get("stats")
        .and_then(|v| v.as_object())
        .ok_or_else(|| AppError::Message(format!("Schema inválido para o app {id}.")))?;

    let cache = if stats_path.exists() {
        let user_stats = bvdf::parse(&fs::read(&stats_path)?)?;
        user_stats
            .get("cache")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    let mut achievements = HashMap::new();
    for (group_id, group_val) in stats {
        let bits = match group_val.get("bits").and_then(|v| v.as_object()) {
            Some(b) => b,
            None => continue,
        };
        for (bit_index_str, bit) in bits {
            let bit_index: i64 = bit_index_str.parse().unwrap_or(0);
            let name = bit
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }

            let unlock_ts = cache
                .get(group_id)
                .and_then(|g| g.get("AchievementTimes"))
                .and_then(|t| t.get(bit_index_str))
                .and_then(value_as_i64);

            let completed = unlock_ts.is_some();
            let unlocked_at = unlock_ts.and_then(|ts| {
                Utc.timestamp_opt(ts, 0)
                    .single()
                    .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            });

            let title = bit
                .pointer("/display/name/brazilian")
                .or_else(|| bit.pointer("/display/name/english"))
                .and_then(|v| v.as_str())
                .unwrap_or(&name)
                .to_string();

            let icon = bit
                .pointer("/display/icon")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let icon_hash = icon.as_deref().and_then(extract_icon_hash);

            achievements.insert(
                name,
                ProgressAchievement {
                    completed,
                    unlocked_at,
                    title,
                    icon,
                    icon_hash,
                    stat_group: group_id.clone(),
                    bit_index,
                },
            );
        }
    }

    // Sempre mescla o perfil público: Ubisoft/etc. podem ter cache local
    // parcial — se só consultarmos a community quando local_unlocked==0,
    // conquistas novas depois da primeira sync nunca entram.
    let mut source = "local".to_string();
    if let Ok(remote) = fetch_community_unlocks(id, &user.steam_id64) {
        let mut applied = 0usize;
        for (api, unlock) in remote {
            if !unlock.completed {
                continue;
            }
            if let Some(row) = achievements.get_mut(&api) {
                if !row.completed {
                    row.completed = true;
                    row.unlocked_at = unlock.unlocked_at.or(row.unlocked_at.clone());
                    applied += 1;
                }
                if row.icon_hash.is_none() {
                    if let Some(h) = unlock.icon_hash.clone() {
                        row.icon_hash = Some(h);
                    }
                }
                if row.icon.is_none() {
                    row.icon = unlock.icon.clone();
                }
                if (row.title.is_empty() || row.title == api) && unlock.title.is_some() {
                    row.title = unlock.title.clone().unwrap_or(row.title.clone());
                }
            } else {
                achievements.insert(
                    api.clone(),
                    ProgressAchievement {
                        completed: true,
                        unlocked_at: unlock.unlocked_at,
                        title: unlock.title.unwrap_or_else(|| api.clone()),
                        icon: unlock.icon,
                        icon_hash: unlock.icon_hash,
                        stat_group: "community".into(),
                        bit_index: -1,
                    },
                );
                applied += 1;
            }
        }
        if applied > 0 || achievements.values().any(|a| a.completed) {
            source = "community".into();
            // mtime estável: hash dos unlocks (evita “sempre mudou” e loop no frontend)
            let mut keys: Vec<&str> = achievements
                .iter()
                .filter(|(_, a)| a.completed)
                .map(|(k, _)| k.as_str())
                .collect();
            keys.sort_unstable();
            let digest = keys.join("|");
            mtime_ms = digest
                .bytes()
                .fold(0u64, |acc, b| acc.wrapping_mul(16777619).wrapping_add(u64::from(b)))
                as f64;
        }
    }

    Ok(SteamProgress {
        app_id: id.to_string(),
        steam_user: user,
        mtime_ms,
        source,
        achievements,
    })
}

fn fetch_community_unlocks(
    app_id: &str,
    steam_id64: &str,
) -> AppResult<HashMap<String, CommunityUnlock>> {
    let urls = [
        format!(
            "https://steamcommunity.com/profiles/{steam_id64}/stats/{app_id}/achievements/?xml=1&l=brazilian"
        ),
        format!(
            "https://steamcommunity.com/profiles/{steam_id64}/stats/{app_id}/?xml=1&l=brazilian"
        ),
    ];

    let mut last_err: Option<AppError> = None;
    for url in urls {
        match fetch_community_xml(&url) {
            Ok(map) if !map.is_empty() => return Ok(map),
            Ok(_) => {
                last_err = Some(AppError::from(
                    "Nenhuma conquista no XML do perfil (jogo sem stats públicos?).",
                ));
            }
            Err(err) => last_err = Some(err),
        }
    }
    Err(last_err.unwrap_or_else(|| {
        AppError::from("Nenhuma conquista no XML do perfil (jogo sem stats públicos?).")
    }))
}

fn fetch_community_xml(url: &str) -> AppResult<HashMap<String, CommunityUnlock>> {
    let xml = fetch_text(url)?;
    let low = xml.to_ascii_lowercase();
    if low.contains("<privacystate>private</privacystate>") || low.contains("this profile is private")
    {
        return Err(AppError::from(
            "Perfil Steam privado — não dá para ler as conquistas pela web.",
        ));
    }

    let block_re =
        Regex::new(r#"(?is)<achievement\s+closed="([01])"[^>]*>(.*?)</achievement>"#)
            .map_err(|e| AppError::from(e.to_string()))?;
    let api_re =
        Regex::new(r#"(?is)<apiname>\s*(?:<!\[CDATA\[(.*?)\]\]>|([^<\s]+))\s*</apiname>"#)
            .map_err(|e| AppError::from(e.to_string()))?;
    let name_re =
        Regex::new(r#"(?is)<name>\s*(?:<!\[CDATA\[(.*?)\]\]>|([^<]+))\s*</name>"#)
            .map_err(|e| AppError::from(e.to_string()))?;
    let icon_re =
        Regex::new(r#"(?is)<iconclosed>\s*(?:<!\[CDATA\[(.*?)\]\]>|([^<\s]+))\s*</iconclosed>"#)
            .map_err(|e| AppError::from(e.to_string()))?;
    let ts_re = Regex::new(r#"(?is)<unlocktimestamp>\s*(\d+)\s*</unlocktimestamp>"#)
        .map_err(|e| AppError::from(e.to_string()))?;

    let mut out = HashMap::new();
    for caps in block_re.captures_iter(&xml) {
        let closed = caps.get(1).map(|m| m.as_str()).unwrap_or("0") == "1";
        let body = caps.get(2).map(|m| m.as_str()).unwrap_or("");
        let Some(api_caps) = api_re.captures(body) else {
            continue;
        };
        let api = api_caps
            .get(1)
            .or_else(|| api_caps.get(2))
            .map(|m| m.as_str().trim().to_string())
            .filter(|s| !s.is_empty());
        let Some(api) = api else {
            continue;
        };
        let title = name_re.captures(body).and_then(|c| {
            c.get(1)
                .or_else(|| c.get(2))
                .map(|m| m.as_str().trim().to_string())
                .filter(|s| !s.is_empty())
        });
        let icon = icon_re.captures(body).and_then(|c| {
            c.get(1)
                .or_else(|| c.get(2))
                .map(|m| m.as_str().trim().to_string())
                .filter(|s| !s.is_empty())
        });
        let icon_hash = icon.as_deref().and_then(extract_icon_hash);
        let unlocked_at = ts_re.captures(body).and_then(|c| {
            let ts: i64 = c.get(1)?.as_str().parse().ok()?;
            Utc.timestamp_opt(ts, 0)
                .single()
                .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        });
        out.insert(
            api,
            CommunityUnlock {
                completed: closed,
                unlocked_at,
                title,
                icon,
                icon_hash,
            },
        );
    }

    Ok(out)
}

struct CommunityUnlock {
    completed: bool,
    unlocked_at: Option<String>,
    title: Option<String>,
    icon: Option<String>,
    icon_hash: Option<String>,
}

fn value_as_i64(v: &Value) -> Option<i64> {
    v.as_i64()
        .or_else(|| v.as_u64().map(|n| n as i64))
        .or_else(|| v.as_f64().map(|n| n as i64))
}
