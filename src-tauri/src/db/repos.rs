use crate::error::AppResult;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameLink {
    pub id: String,
    pub label: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub app_id: String,
    pub name: String,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub clienticon: Option<String>,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub links: Vec<GameLink>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub id: i64,
    #[serde(default)]
    pub api_name: Option<String>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub title_en: Option<String>,
    #[serde(default)]
    pub description_en: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub global_percent: Option<f64>,
    #[serde(default, rename = "group")]
    pub group: Option<String>,
    #[serde(default)]
    pub group_en: Option<String>,
    #[serde(default)]
    pub dlc: Option<String>,
    #[serde(default)]
    pub tips: Option<String>,
    #[serde(default)]
    pub video_url: Option<String>,
    #[serde(default)]
    pub guide_url: Option<String>,
    #[serde(default)]
    pub difficulty: Option<String>,
    #[serde(default)]
    pub missable: bool,
    #[serde(default)]
    pub req_level: Option<String>,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub completed_manual: bool,
    #[serde(default)]
    pub unlocked_at: Option<String>,
    #[serde(default)]
    pub progress: Option<i64>,
    #[serde(default)]
    pub progress_max: Option<i64>,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub games: Vec<Game>,
    pub active_game_app_id: Option<String>,
    pub achievements_by_app_id: HashMap<String, Vec<Achievement>>,
    pub collapsed_sections: HashMap<String, bool>,
    pub settings: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePack {
    pub active_game_app_id: Option<String>,
    pub games: Vec<Game>,
    pub achievements_by_app_id: HashMap<String, Vec<Achievement>>,
    #[serde(default)]
    pub prefs: Option<ProfilePrefs>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePrefs {
    #[serde(default)]
    pub collapsed_sections: HashMap<String, bool>,
}

pub fn get_setting(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    let value = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO app_settings(key, value) VALUES(?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn list_games(conn: &Connection) -> AppResult<Vec<Game>> {
    let mut stmt = conn.prepare(
        "SELECT app_id, name, image_url, icon_hash, client_icon_hash, archived, metadata_json
         FROM games ORDER BY name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, Option<String>>(6)?,
        ))
    })?;

    let mut games = Vec::new();
    for row in rows {
        let (app_id, name, image, icon, clienticon, archived, metadata_json) = row?;
        let links = list_links(conn, &app_id)?;
        let metadata = metadata_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
        games.push(Game {
            app_id,
            name,
            image,
            icon,
            clienticon,
            archived: archived != 0,
            links,
            metadata,
        });
    }
    Ok(games)
}

fn list_links(conn: &Connection, app_id: &str) -> AppResult<Vec<GameLink>> {
    let mut stmt = conn.prepare(
        "SELECT id, label, url FROM game_links WHERE app_id = ?1 ORDER BY sort_order, label",
    )?;
    let rows = stmt.query_map(params![app_id], |row| {
        Ok(GameLink {
            id: row.get(0)?,
            label: row.get(1)?,
            url: row.get(2)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn upsert_game(conn: &Connection, game: &Game) -> AppResult<()> {
    let metadata = game
        .metadata
        .as_ref()
        .map(|v| v.to_string());
    conn.execute(
        "INSERT INTO games(app_id, name, image_url, icon_hash, client_icon_hash, archived, metadata_json)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(app_id) DO UPDATE SET
           name = excluded.name,
           image_url = excluded.image_url,
           icon_hash = excluded.icon_hash,
           client_icon_hash = excluded.client_icon_hash,
           archived = excluded.archived,
           metadata_json = excluded.metadata_json",
        params![
            game.app_id,
            game.name,
            game.image,
            game.icon,
            game.clienticon,
            if game.archived { 1 } else { 0 },
            metadata,
        ],
    )?;

    conn.execute("DELETE FROM game_links WHERE app_id = ?1", params![game.app_id])?;
    for (i, link) in game.links.iter().enumerate() {
        conn.execute(
            "INSERT INTO game_links(id, app_id, label, url, sort_order) VALUES(?1, ?2, ?3, ?4, ?5)",
            params![link.id, game.app_id, link.label, link.url, i as i64],
        )?;
    }
    Ok(())
}

pub fn set_game_archived(conn: &Connection, app_id: &str, archived: bool) -> AppResult<()> {
    conn.execute(
        "UPDATE games SET archived = ?1 WHERE app_id = ?2",
        params![if archived { 1 } else { 0 }, app_id],
    )?;
    Ok(())
}

pub fn delete_game(conn: &Connection, app_id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM games WHERE app_id = ?1", params![app_id])?;
    Ok(())
}

pub fn list_achievements(conn: &Connection, app_id: &str) -> AppResult<Vec<Achievement>> {
    let mut stmt = conn.prepare(
        "SELECT id, api_name, title, description, icon_url, global_percent, group_name, dlc,
                tips, video_url, guide_url, difficulty, missable, req_level,
                completed, completed_manual, unlocked_at, title_en, description_en, group_en,
                progress, progress_max, hidden
         FROM achievements WHERE app_id = ?1 ORDER BY id",
    )?;
    let rows = stmt.query_map(params![app_id], |row| {
        Ok(Achievement {
            id: row.get(0)?,
            api_name: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            icon: row.get(4)?,
            global_percent: row.get(5)?,
            group: row.get(6)?,
            dlc: row.get(7)?,
            tips: row.get(8)?,
            video_url: row.get(9)?,
            guide_url: row.get(10)?,
            difficulty: row.get(11)?,
            missable: row.get::<_, i64>(12)? != 0,
            req_level: row.get(13)?,
            completed: row.get::<_, i64>(14)? != 0,
            completed_manual: row.get::<_, i64>(15)? != 0,
            unlocked_at: row.get(16)?,
            title_en: row.get(17)?,
            description_en: row.get(18)?,
            group_en: row.get(19)?,
            progress: row.get(20)?,
            progress_max: row.get(21)?,
            hidden: row.get::<_, i64>(22).unwrap_or(0) != 0,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn set_achievements(conn: &Connection, app_id: &str, items: &[Achievement]) -> AppResult<()> {
    conn.execute("DELETE FROM achievements WHERE app_id = ?1", params![app_id])?;
    for item in items {
        conn.execute(
            "INSERT INTO achievements(
                id, app_id, api_name, title, description, icon_url, global_percent,
                group_name, dlc, tips, video_url, guide_url, difficulty, missable, req_level,
                completed, completed_manual, unlocked_at, title_en, description_en, group_en,
                progress, progress_max, hidden
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24)",
            params![
                item.id,
                app_id,
                item.api_name,
                item.title,
                item.description,
                item.icon,
                item.global_percent,
                item.group,
                item.dlc,
                item.tips,
                item.video_url,
                item.guide_url,
                item.difficulty,
                if item.missable { 1 } else { 0 },
                item.req_level,
                if item.completed { 1 } else { 0 },
                if item.completed_manual { 1 } else { 0 },
                item.unlocked_at,
                item.title_en,
                item.description_en,
                item.group_en,
                item.progress,
                item.progress_max,
                if item.hidden { 1 } else { 0 },
            ],
        )?;
    }
    Ok(())
}

pub fn patch_achievement(conn: &Connection, app_id: &str, item: &Achievement) -> AppResult<()> {
    conn.execute(
        "UPDATE achievements SET
            api_name = ?1, title = ?2, description = ?3, icon_url = ?4, global_percent = ?5,
            group_name = ?6, dlc = ?7, tips = ?8, video_url = ?9, guide_url = ?10,
            difficulty = ?11, missable = ?12, req_level = ?13, completed = ?14,
            completed_manual = ?15, unlocked_at = ?16, title_en = ?17, description_en = ?18,
            group_en = ?19, progress = ?20, progress_max = ?21, hidden = ?22
         WHERE app_id = ?23 AND id = ?24",
        params![
            item.api_name,
            item.title,
            item.description,
            item.icon,
            item.global_percent,
            item.group,
            item.dlc,
            item.tips,
            item.video_url,
            item.guide_url,
            item.difficulty,
            if item.missable { 1 } else { 0 },
            item.req_level,
            if item.completed { 1 } else { 0 },
            if item.completed_manual { 1 } else { 0 },
            item.unlocked_at,
            item.title_en,
            item.description_en,
            item.group_en,
            item.progress,
            item.progress_max,
            if item.hidden { 1 } else { 0 },
            app_id,
            item.id,
        ],
    )?;
    Ok(())
}

pub fn insert_achievement(conn: &Connection, app_id: &str, item: &Achievement) -> AppResult<()> {
    conn.execute(
        "INSERT INTO achievements(
            id, app_id, api_name, title, description, icon_url, global_percent,
            group_name, dlc, tips, video_url, guide_url, difficulty, missable, req_level,
            completed, completed_manual, unlocked_at, title_en, description_en, group_en,
            progress, progress_max, hidden
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24)",
        params![
            item.id,
            app_id,
            item.api_name,
            item.title,
            item.description,
            item.icon,
            item.global_percent,
            item.group,
            item.dlc,
            item.tips,
            item.video_url,
            item.guide_url,
            item.difficulty,
            if item.missable { 1 } else { 0 },
            item.req_level,
            if item.completed { 1 } else { 0 },
            if item.completed_manual { 1 } else { 0 },
            item.unlocked_at,
            item.title_en,
            item.description_en,
            item.group_en,
            item.progress,
            item.progress_max,
            if item.hidden { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

pub fn delete_achievement(conn: &Connection, app_id: &str, id: i64) -> AppResult<()> {
    conn.execute(
        "DELETE FROM achievements WHERE app_id = ?1 AND id = ?2",
        params![app_id, id],
    )?;
    Ok(())
}

pub fn refresh_achievement_locale_texts(
    conn: &Connection,
    app_id: &str,
    items: &[(i64, Option<String>, String, String)],
) -> AppResult<usize> {
    let mut updated = 0usize;
    for (id, api_name, title_en, description_en) in items {
        let changed = conn.execute(
            "UPDATE achievements SET title_en = ?1, description_en = ?2
             WHERE app_id = ?3 AND id = ?4 AND (
                api_name = ?5 OR (?5 IS NULL AND api_name IS NULL) OR api_name LIKE 'unknown_%'
             )",
            params![title_en, description_en, app_id, id, api_name],
        )?;
        if changed == 0 {
            let changed = conn.execute(
                "UPDATE achievements SET title_en = ?1, description_en = ?2
                 WHERE app_id = ?3 AND id = ?4",
                params![title_en, description_en, app_id, id],
            )?;
            updated += changed as usize;
        } else {
            updated += changed as usize;
        }
    }
    Ok(updated)
}

pub fn list_collapsed(conn: &Connection) -> AppResult<HashMap<String, bool>> {
    let mut stmt = conn.prepare("SELECT app_id, view, section_name FROM collapsed_sections")?;
    let rows = stmt.query_map([], |row| {
        Ok(format!(
            "{}::{}::{}",
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?
        ))
    })?;
    let mut map = HashMap::new();
    for key in rows.flatten() {
        map.insert(key, true);
    }
    Ok(map)
}

pub fn set_collapsed(
    conn: &Connection,
    app_id: &str,
    view: &str,
    section_name: &str,
    collapsed: bool,
) -> AppResult<()> {
    if collapsed {
        conn.execute(
            "INSERT OR IGNORE INTO collapsed_sections(app_id, view, section_name) VALUES(?1,?2,?3)",
            params![app_id, view, section_name],
        )?;
    } else {
        conn.execute(
            "DELETE FROM collapsed_sections WHERE app_id = ?1 AND view = ?2 AND section_name = ?3",
            params![app_id, view, section_name],
        )?;
    }
    Ok(())
}

pub fn get_bootstrap(conn: &Connection) -> AppResult<Bootstrap> {
    let games = list_games(conn)?;
    let active_game_app_id = get_setting(conn, "active_game_app_id")?;
    let mut achievements_by_app_id = HashMap::new();
    for game in &games {
        achievements_by_app_id.insert(game.app_id.clone(), list_achievements(conn, &game.app_id)?);
    }
    let collapsed_sections = list_collapsed(conn)?;
    let mut settings = HashMap::new();
    let mut stmt = conn.prepare("SELECT key, value FROM app_settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows.flatten() {
        settings.insert(row.0, row.1);
    }
    Ok(Bootstrap {
        games,
        active_game_app_id,
        achievements_by_app_id,
        collapsed_sections,
        settings,
    })
}

pub fn import_profile(conn: &Connection, pack: &ProfilePack) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(
        "DELETE FROM achievements;
         DELETE FROM game_links;
         DELETE FROM collapsed_sections;
         DELETE FROM games;",
    )?;

    for game in &pack.games {
        upsert_game(&tx, game)?;
        if let Some(items) = pack.achievements_by_app_id.get(&game.app_id) {
            set_achievements(&tx, &game.app_id, items)?;
        }
    }

    if let Some(active) = &pack.active_game_app_id {
        set_setting(&tx, "active_game_app_id", active)?;
    }

    if let Some(prefs) = &pack.prefs {
        for key in prefs.collapsed_sections.keys() {
            let parts: Vec<_> = key.splitn(3, "::").collect();
            if parts.len() == 3 {
                set_collapsed(&tx, parts[0], parts[1], parts[2], true)?;
            }
        }
    }

    tx.commit()?;
    Ok(())
}

pub fn export_profile(conn: &Connection) -> AppResult<Value> {
    let bootstrap = get_bootstrap(conn)?;
    Ok(serde_json::json!({
        "type": "questlog-profile",
        "version": 1,
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "activeGameAppId": bootstrap.active_game_app_id,
        "games": bootstrap.games,
        "achievementsByAppId": bootstrap.achievements_by_app_id,
        "prefs": {
            "collapsedSections": bootstrap.collapsed_sections
        }
    }))
}
