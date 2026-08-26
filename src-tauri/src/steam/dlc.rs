use crate::error::AppResult;
use crate::steam::keys::DLC_BASE;
use crate::steam::paths::fetch_json;
use crate::steam::search::validate_app_id;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DlcGroup {
    pub dlc_app_id: Option<i64>,
    pub dlc_app_name: String,
    pub achievement_api_names: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DlcGroupsResult {
    pub app_id: String,
    pub groups: Vec<DlcGroup>,
    pub by_api_name: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn clean_dlc_label(value: &str) -> String {
    value
        .replace(['™', '®', '©'], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn get_steam_dlc_groups(app_id: &str) -> AppResult<DlcGroupsResult> {
    validate_app_id(app_id)?;
    let id = app_id.trim();

    match fetch_dlc_inner(id) {
        Ok(result) => Ok(result),
        Err(err) => Ok(DlcGroupsResult {
            app_id: id.to_string(),
            groups: vec![],
            by_api_name: HashMap::new(),
            error: Some(err.to_string()),
        }),
    }
}

fn fetch_dlc_inner(app_id: &str) -> AppResult<DlcGroupsResult> {
    let url = format!(
        "https://steamhunters.com/api/GetAchievementGroups/v1?appId={app_id}&groupBy=dlc"
    );
    let data = fetch_json(&url)?;
    let groups_raw = data
        .get("groups")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut groups = Vec::new();
    let mut by_api_name = HashMap::new();

    for group in groups_raw {
        let dlc_app_id = group
            .get("dlcAppId")
            .and_then(|v| v.as_i64().or_else(|| v.as_u64().map(|n| n as i64)));
        let dlc_app_name = clean_dlc_label(group.get("dlcAppName").and_then(|v| v.as_str()).unwrap_or(""));
        let names = group
            .get("achievementApiNames")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        if dlc_app_name.is_empty() || dlc_app_id.is_none() || names.is_empty() {
            continue;
        }

        for api_name in &names {
            by_api_name.insert(api_name.clone(), dlc_app_name.clone());
        }
        groups.push(DlcGroup {
            dlc_app_id,
            dlc_app_name,
            achievement_api_names: names,
        });
    }

    Ok(DlcGroupsResult {
        app_id: app_id.to_string(),
        groups,
        by_api_name,
        error: None,
    })
}

pub fn extract_dlc_name(description: &str) -> Option<String> {
    let patterns = [
        r"(?i)\(Requires DLC:\s*([^)]+)\)",
        r"(?i)Requires DLC:\s*([^.)\n]+)",
        r"(?i)\(DLC:\s*([^)]+)\)",
    ];
    for pat in patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            if let Some(caps) = re.captures(description) {
                let label = clean_dlc_label(&caps[1]);
                if !label.is_empty() {
                    return Some(label);
                }
            }
        }
    }
    None
}

pub fn assign_dlc(api_name: Option<&str>, description: &str, by_api: &HashMap<String, String>) -> String {
    if let Some(name) = api_name {
        if let Some(dlc) = by_api.get(name) {
            return dlc.clone();
        }
    }
    if let Some(from_desc) = extract_dlc_name(description) {
        return from_desc;
    }
    DLC_BASE.to_string()
}
