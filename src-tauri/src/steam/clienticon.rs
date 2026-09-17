use crate::error::AppResult;
use crate::steam::paths::fetch_json;
use crate::steam::search::validate_app_id;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientIconResult {
    pub app_id: String,
    pub name: Option<String>,
    pub clienticon: Option<String>,
    pub icon: Option<String>,
    pub image: String,
    /// Capa da Store (header hashed). Jogos novos não têm `/header.jpg` na raiz.
    pub cover: Option<String>,
    pub ico: Option<String>,
    pub fallback: bool,
}

const STORE_ASSET: &str = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
const LANGS: &[&str] = &["brazilian", "portuguese", "english", "latam", "spanish"];

pub fn get_steam_client_icon(app_id: &str) -> AppResult<ClientIconResult> {
    validate_app_id(app_id)?;
    let id = app_id.trim();

    let url = format!("https://api.steamcmd.net/v1/info/{id}");
    let data = match fetch_json(&url) {
        Ok(v) => v,
        Err(_) => {
            return Ok(fallback(id));
        }
    };

    let common = data
        .pointer(&format!("/data/{id}/common"))
        .cloned()
        .unwrap_or(Value::Null);

    let name = common
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let clienticon = common
        .get("clienticon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let icon = common
        .get("icon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let cover = cover_from_common(id, &common);

    let hash = icon.clone().or_else(|| clienticon.clone());
    if let Some(h) = hash {
        let image = format!(
            "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/{id}/{h}.jpg"
        );
        let ico = clienticon.as_ref().map(|c| {
            format!(
                "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/{id}/{c}.ico"
            )
        });
        return Ok(ClientIconResult {
            app_id: id.to_string(),
            name,
            clienticon,
            icon,
            image,
            cover,
            ico,
            fallback: false,
        });
    }

    let mut result = fallback(id);
    result.name = name;
    result.cover = cover;
    Ok(result)
}

fn cover_from_common(app_id: &str, common: &Value) -> Option<String> {
    if let Some(full) = common.get("library_assets_full") {
        for pointer in ["/library_header/image2x", "/library_header/image"] {
            if let Some(path) = full.pointer(pointer).and_then(localized_path) {
                return Some(store_asset_url(app_id, &path));
            }
        }
    }
    common
        .get("header_image")
        .and_then(localized_path)
        .map(|path| store_asset_url(app_id, &path))
}

fn localized_path(value: &Value) -> Option<String> {
    if let Some(s) = value.as_str().filter(|s| !s.is_empty()) {
        return Some(s.to_string());
    }
    let obj = value.as_object()?;
    for lang in LANGS {
        if let Some(s) = obj
            .get(*lang)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        {
            return Some(s.to_string());
        }
    }
    obj.values()
        .find_map(|v| v.as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()))
}

fn store_asset_url(app_id: &str, rel: &str) -> String {
    if rel.starts_with("http://") || rel.starts_with("https://") {
        return rel.to_string();
    }
    format!("{STORE_ASSET}/{app_id}/{rel}")
}

fn fallback(app_id: &str) -> ClientIconResult {
    ClientIconResult {
        app_id: app_id.to_string(),
        name: None,
        clienticon: None,
        icon: None,
        image: format!(
            "https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/capsule_231x87.jpg"
        ),
        cover: None,
        ico: None,
        fallback: true,
    }
}
