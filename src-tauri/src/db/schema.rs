use crate::error::AppResult;
use rusqlite::Connection;
use std::path::Path;

pub fn open_db(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        ",
    )?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS games (
            app_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            image_url TEXT,
            icon_hash TEXT,
            client_icon_hash TEXT,
            archived INTEGER NOT NULL DEFAULT 0,
            metadata_json TEXT
        );

        CREATE TABLE IF NOT EXISTS game_links (
            id TEXT PRIMARY KEY,
            app_id TEXT NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER NOT NULL,
            app_id TEXT NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
            api_name TEXT,
            title TEXT NOT NULL,
            description TEXT,
            icon_url TEXT,
            global_percent REAL,
            group_name TEXT,
            dlc TEXT,
            tips TEXT,
            video_url TEXT,
            guide_url TEXT,
            difficulty TEXT,
            missable INTEGER NOT NULL DEFAULT 0,
            req_level TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            completed_manual INTEGER NOT NULL DEFAULT 0,
            unlocked_at TEXT,
            PRIMARY KEY (app_id, id)
        );

        CREATE INDEX IF NOT EXISTS idx_achievements_app ON achievements(app_id);
        CREATE INDEX IF NOT EXISTS idx_achievements_api ON achievements(app_id, api_name);
        CREATE INDEX IF NOT EXISTS idx_achievements_completed ON achievements(app_id, completed);

        CREATE TABLE IF NOT EXISTS collapsed_sections (
            app_id TEXT NOT NULL,
            view TEXT NOT NULL,
            section_name TEXT NOT NULL,
            PRIMARY KEY (app_id, view, section_name)
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )?;

    for sql in [
        "ALTER TABLE achievements ADD COLUMN title_en TEXT",
        "ALTER TABLE achievements ADD COLUMN description_en TEXT",
        "ALTER TABLE achievements ADD COLUMN group_en TEXT",
        "ALTER TABLE achievements ADD COLUMN progress INTEGER",
        "ALTER TABLE achievements ADD COLUMN progress_max INTEGER",
        "ALTER TABLE achievements ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
    ] {
        let _ = conn.execute(sql, []);
    }

    Ok(())
}
