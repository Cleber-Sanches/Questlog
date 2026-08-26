use crate::error::AppResult;
use crate::steam::paths::fetch_json;
use crate::steam::search::validate_app_id;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientIconResult {
    pub app_id: String,
    pub name: Option<String>,
    pub clienticon: Option<String>,
    pub icon: Option<String>,
    pub image: String,
    pub ico: Option<String>,
    pub fallback: bool,
}

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
        .unwrap_or(serde_json::Value::Null);

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
            ico,
            fallback: false,
        });
    }

    Ok(fallback(id))
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
        ico: None,
        fallback: true,
    }
}
