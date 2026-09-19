use crate::error::{AppError, AppResult};
use crate::steam::keys::GROUP_NONE;
use crate::steam::bvdf;
use crate::steam::dlc::{assign_dlc, get_steam_dlc_groups};
use crate::steam::paths::{
    extract_icon_hash, fetch_json, fetch_text, find_steam_path_optional,
};
use crate::steam::search::validate_app_id;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SteamAchievement {
    pub id: i64,
    pub api_name: String,
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub title_en: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub description_en: String,
    pub icon: String,
    pub completed: bool,
    pub unlocked_at: Option<String>,
    pub group: String,
    pub dlc: String,
    pub video_url: String,
    pub guide_url: String,
    pub tips: String,
    pub global_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stat_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<i64>,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementsResult {
    pub app_id: String,
    pub source: String,
    pub achievements: Vec<SteamAchievement>,
    pub dlc_groups: Vec<crate::steam::dlc::DlcGroup>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

struct CommunityRow {
    title: String,
    description: String,
    icon: String,
    icon_hash: Option<String>,
    global_percent: Option<f64>,
    api_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocaleTextRow {
    pub id: i64,
    pub api_name: Option<String>,
    pub title_en: String,
    pub description_en: String,
}

#[derive(Clone)]
struct LocalEntry {
    api_name: String,
    title: String,
    title_en: String,
    icon_file: String,
    icon_hash: Option<String>,
    stat_group: String,
    bit_index: i64,
    hidden: bool,
    description: String,
    description_en: String,
}

pub fn bit_is_hidden(bit: &Value) -> bool {
    fn flag(value: Option<&Value>) -> bool {
        match value {
            Some(Value::Bool(on)) => *on,
            Some(Value::Number(n)) => n.as_i64().unwrap_or(0) != 0,
            Some(Value::String(raw)) => {
                let text = raw.trim();
                !text.is_empty() && text != "0" && !text.eq_ignore_ascii_case("false")
            }
            _ => false,
        }
    }
    flag(bit.get("hidden")) || flag(bit.pointer("/display/hidden"))
}

fn display_text(bit: &Value, field: &str, prefer: &str) -> String {
    let prefer_path = format!("/display/{field}/{prefer}");
    let english_path = format!("/display/{field}/english");
    let brazilian_path = format!("/display/{field}/brazilian");
    bit.pointer(&prefer_path)
        .or_else(|| bit.pointer(&english_path))
        .or_else(|| bit.pointer(&brazilian_path))
        .or_else(|| bit.pointer(&format!("/display/{field}")))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

pub fn bit_description(bit: &Value, prefer: &str) -> String {
    let desc = display_text(bit, "desc", prefer);
    if !desc.is_empty() {
        return desc;
    }
    display_text(bit, "description", prefer)
}

fn looks_like_hidden_placeholder(title: &str, description: &str) -> bool {
    let title = title.trim().to_ascii_lowercase();
    let description = description.trim().to_ascii_lowercase();
    matches!(
        title.as_str(),
        "hidden achievement" | "hidden achievements" | "conquista oculta" | "hidden"
    ) || title.contains("hidden achievement")
        || description.contains("hidden achievement")
        || description.contains("conquista oculta")
        || description.contains("continue playing to unlock this hidden")
}

fn decode_html(text: &str) -> String {
    let no_tags = regex::Regex::new(r"<[^>]+>")
        .unwrap()
        .replace_all(text, "");
    no_tags
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_community_achievements(html: &str) -> Vec<CommunityRow> {
    let re = regex::Regex::new(
        r#"(?is)class="achieveRow[^"]*"[\s\S]*?<img src="([^"]+)"[\s\S]*?achievePercent">\s*([\d.,]+)\s*%[\s\S]*?<h3>([\s\S]*?)</h3>[\s\S]*?<h5>([\s\S]*?)</h5>"#,
    )
    .unwrap();
    let mut rows = Vec::new();
    for caps in re.captures_iter(html) {
        let icon = caps[1].to_string();
        let percent_raw = caps[2].replace(',', ".");
        let global_percent = percent_raw.parse::<f64>().ok();
        rows.push(CommunityRow {
            title: decode_html(&caps[3]),
            description: decode_html(&caps[4]),
            icon_hash: extract_icon_hash(&icon),
            icon,
            global_percent,
            api_name: None,
        });
    }
    rows
}

fn fetch_global_percentages(app_id: &str) -> AppResult<Vec<(String, f64)>> {
    let url = format!(
        "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid={app_id}"
    );
    let data = fetch_json(&url)?;
    let list = data
        .pointer("/achievementpercentages/achievements")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(list
        .into_iter()
        .filter_map(|item| {
            let api_name = item.get("name")?.as_str()?.to_string();
            let percent = item.get("percent")?.as_f64()?;
            Some((api_name, percent))
        })
        .collect())
}

fn read_local_schema(
    app_id: &str,
    custom_install_dir: Option<&str>,
) -> Option<(HashMap<String, LocalEntry>, HashMap<String, LocalEntry>)> {
    let steam_path = find_steam_path_optional(custom_install_dir)?;
    let schema_path = steam_path
        .join("appcache")
        .join("stats")
        .join(format!("UserGameStatsSchema_{app_id}.bin"));
    if !schema_path.exists() {
        return None;
    }
    let schema = bvdf::parse(&fs::read(schema_path).ok()?).ok()?;
    let app = schema.get(app_id)?;
    let stats = app.get("stats")?.as_object()?;

    let mut by_hash = HashMap::new();
    let mut by_api = HashMap::new();

    for (group_id, group_val) in stats {
        let bits = match group_val.get("bits").and_then(|v| v.as_object()) {
            Some(b) => b,
            None => continue,
        };
        for (bit_index_str, bit) in bits {
            let api_name = bit.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if api_name.is_empty() {
                continue;
            }
            let icon_file = bit
                .pointer("/display/icon")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let icon_hash = extract_icon_hash(&icon_file);
            let title = bit
                .pointer("/display/name/brazilian")
                .or_else(|| bit.pointer("/display/name/english"))
                .and_then(|v| v.as_str())
                .unwrap_or(&api_name)
                .to_string();
            let title_en = bit
                .pointer("/display/name/english")
                .or_else(|| bit.pointer("/display/name/brazilian"))
                .and_then(|v| v.as_str())
                .unwrap_or(&api_name)
                .to_string();
            let description = bit_description(bit, "brazilian");
            let description_en = bit_description(bit, "english");
            let entry = LocalEntry {
                api_name: api_name.clone(),
                title,
                title_en,
                icon_file,
                icon_hash: icon_hash.clone(),
                stat_group: group_id.clone(),
                bit_index: bit_index_str.parse().unwrap_or(0),
                hidden: bit_is_hidden(bit),
                description,
                description_en,
            };
            by_api.insert(api_name, entry.clone());
            if let Some(h) = icon_hash {
                by_hash.insert(h, entry);
            }
        }
    }

    Some((by_hash, by_api))
}

fn match_api_names(mut rows: Vec<CommunityRow>, globals: &[(String, f64)]) -> Vec<CommunityRow> {
    let mut pool: HashMap<String, Vec<String>> = HashMap::new();
    for (api_name, percent) in globals {
        if !percent.is_finite() {
            continue;
        }
        let key = format!("{percent:.1}");
        pool.entry(key).or_default().push(api_name.clone());
    }

    for row in &mut rows {
        if row.api_name.is_some() {
            continue;
        }
        let Some(pct) = row.global_percent else { continue };
        let key = format!("{pct:.1}");
        if let Some(list) = pool.get_mut(&key) {
            if !list.is_empty() {
                row.api_name = Some(list.remove(0));
            }
        }
    }
    rows
}

pub fn get_steam_achievements(
    app_id: &str,
    custom_install_dir: Option<&str>,
) -> AppResult<AchievementsResult> {
    validate_app_id(app_id)?;
    let id = app_id.trim();

    match fetch_achievements_inner(id, custom_install_dir) {
        Ok(result) => Ok(result),
        Err(err) => Ok(AchievementsResult {
            app_id: id.to_string(),
            source: "error".into(),
            achievements: vec![],
            dlc_groups: vec![],
            error: Some(err.to_string()),
        }),
    }
}

fn fetch_community_rows(app_id: &str, locale: &str) -> Vec<CommunityRow> {
    fetch_text(&format!(
        "https://steamcommunity.com/stats/{app_id}/achievements/?l={locale}"
    ))
    .ok()
    .map(|html| parse_community_achievements(&html))
    .unwrap_or_default()
}

pub fn fetch_steam_english_texts(
    app_id: &str,
    custom_install_dir: Option<&str>,
) -> AppResult<Vec<LocaleTextRow>> {
    validate_app_id(app_id)?;
    let id = app_id.trim();

    let mut rows_en = fetch_community_rows(id, "english");
    if rows_en.is_empty() {
        rows_en = fetch_community_rows(id, "brazilian");
    }

    let globals = fetch_global_percentages(id).unwrap_or_default();
    let local = read_local_schema(id, custom_install_dir);

    if rows_en.is_empty() && !globals.is_empty() {
        rows_en = globals
            .iter()
            .map(|(api_name, percent)| {
                let from_local = local.as_ref().and_then(|(_, by_api)| by_api.get(api_name));
                CommunityRow {
                    title: from_local
                        .map(|e| e.title_en.clone())
                        .unwrap_or_else(|| api_name.clone()),
                    description: String::new(),
                    icon: String::new(),
                    icon_hash: from_local.and_then(|e| e.icon_hash.clone()),
                    global_percent: Some(*percent),
                    api_name: Some(api_name.clone()),
                }
            })
            .collect();
    } else if !rows_en.is_empty() {
        rows_en = match_api_names(rows_en, &globals);
    }

    let mut out = Vec::new();
    for (idx, row) in rows_en.into_iter().enumerate() {
        let mut api_name = row.api_name.clone();
        if let Some((by_hash, by_api)) = &local {
            if let Some(hash) = &row.icon_hash {
                if let Some(entry) = by_hash.get(hash) {
                    api_name = Some(entry.api_name.clone());
                }
            }
            if let Some(name) = &api_name {
                if let Some(entry) = by_api.get(name) {
                    api_name = Some(entry.api_name.clone());
                }
            }
        }
        let title_en = if row.title.trim().is_empty() {
            api_name.clone().unwrap_or_default()
        } else {
            row.title
        };
        out.push(LocaleTextRow {
            id: (idx as i64) + 1,
            api_name,
            title_en,
            description_en: row.description,
        });
    }
    Ok(out)
}

fn fetch_achievements_inner(app_id: &str, custom_install_dir: Option<&str>) -> AppResult<AchievementsResult> {
    let mut rows = fetch_community_rows(app_id, "brazilian");
    if rows.is_empty() {
        rows = fetch_community_rows(app_id, "english");
    }
    let english_rows = fetch_community_rows(app_id, "english");
    let globals = fetch_global_percentages(app_id).unwrap_or_default();
    let local = read_local_schema(app_id, custom_install_dir);

    let mut source = if rows.is_empty() {
        if globals.is_empty() {
            return Err(AppError::from(
                "Nenhuma conquista pública encontrada. O jogo pode não ter conquistas Steam.",
            ));
        }
        rows = globals
            .iter()
            .map(|(api_name, percent)| {
                let from_local = local.as_ref().and_then(|(_, by_api)| by_api.get(api_name));
                let icon_file = from_local.map(|e| e.icon_file.as_str()).unwrap_or("");
                let icon = if icon_file.is_empty() {
                    String::new()
                } else {
                    format!(
                        "https://shared.fastly.steamstatic.com/community_assets/images/apps/{app_id}/{icon_file}"
                    )
                };
                CommunityRow {
                    title: from_local
                        .map(|e| e.title.clone())
                        .unwrap_or_else(|| api_name.clone()),
                    description: String::new(),
                    icon,
                    icon_hash: from_local.and_then(|e| e.icon_hash.clone()),
                    global_percent: Some(*percent),
                    api_name: Some(api_name.clone()),
                }
            })
            .collect();
        "global-percent".to_string()
    } else {
        rows = match_api_names(rows, &globals);
        if local.is_some() {
            "steam-community+local-schema+global-percent".to_string()
        } else {
            "steam-community+global-percent".to_string()
        }
    };

    let english_by_index: Vec<(String, String)> = english_rows
        .iter()
        .map(|r| (r.title.clone(), r.description.clone()))
        .collect();

    let dlc = get_steam_dlc_groups(app_id)?;
    if !dlc.groups.is_empty() {
        source.push_str("+steamhunters-dlc");
    }

    let mut achievements = Vec::new();
    for (idx, row) in rows.into_iter().enumerate() {
        let mut api_name = row.api_name.unwrap_or_default();
        let mut stat_group = None;
        let mut bit_index = None;

        if let Some((by_hash, by_api)) = &local {
            if let Some(hash) = &row.icon_hash {
                if let Some(entry) = by_hash.get(hash) {
                    api_name = entry.api_name.clone();
                    stat_group = Some(entry.stat_group.clone());
                    bit_index = Some(entry.bit_index);
                }
            }
            if api_name.is_empty() {
                // keep empty
            } else if let Some(entry) = by_api.get(&api_name) {
                stat_group = Some(entry.stat_group.clone());
                bit_index = Some(entry.bit_index);
            }
        }

        if api_name.is_empty() {
            api_name = format!("unknown_{idx}");
        }

        let global_percent = row.global_percent.or_else(|| {
            globals
                .iter()
                .find(|(n, _)| n == &api_name)
                .map(|(_, p)| *p)
        });

        let dlc_label = assign_dlc(Some(&api_name), &row.description, &dlc.by_api_name);

        let schema = local
            .as_ref()
            .and_then(|(_, by_api)| by_api.get(&api_name));
        let schema_hidden = schema.map(|entry| entry.hidden).unwrap_or(false);
        let hidden = schema_hidden || looks_like_hidden_placeholder(&row.title, &row.description);

        let mut description = row.description;
        if description.trim().is_empty() || looks_like_hidden_placeholder("", &description) {
            if let Some(entry) = schema {
                if !entry.description.is_empty() {
                    description = entry.description.clone();
                }
            }
        }

        let (mut title_en, mut description_en) = english_by_index
            .get(idx)
            .cloned()
            .or_else(|| {
                schema.map(|e| (e.title_en.clone(), e.description_en.clone()))
            })
            .unwrap_or_default();
        if description_en.trim().is_empty() || looks_like_hidden_placeholder("", &description_en) {
            if let Some(entry) = schema {
                if !entry.description_en.is_empty() {
                    description_en = entry.description_en.clone();
                }
            }
        }
        if title_en.trim().is_empty() {
            if let Some(entry) = schema {
                title_en = entry.title_en.clone();
            }
        }

        achievements.push(SteamAchievement {
            id: (idx as i64) + 1,
            api_name,
            title: row.title,
            description,
            title_en,
            description_en,
            icon: row.icon,
            completed: false,
            unlocked_at: None,
            group: GROUP_NONE.into(),
            dlc: dlc_label,
            video_url: String::new(),
            guide_url: String::new(),
            tips: String::new(),
            global_percent,
            stat_group,
            bit_index,
            hidden,
        });
    }

    Ok(AchievementsResult {
        app_id: app_id.to_string(),
        source,
        achievements,
        dlc_groups: dlc.groups,
        error: None,
    })
}
