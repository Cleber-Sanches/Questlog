//! Resolve links reais de vídeo no YouTube (não páginas de pesquisa).

use regex::Regex;
use std::sync::OnceLock;
use std::time::Duration;

fn video_id_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#""videoId"\s*:\s*"([a-zA-Z0-9_-]{11})""#).expect("regex"))
}

fn search_query_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?:[?&](?:search_query|q)=)([^&#]+)"#).expect("regex")
    })
}

fn watch_id_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r#"(?i)(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})"#,
        )
        .expect("regex")
    })
}

pub fn is_youtube_search_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.contains("youtube.com/results")
        || lower.contains("search_query=")
        || (lower.contains("youtube.com") && lower.contains("/results"))
}

pub fn is_real_video_url(url: &str) -> bool {
    let t = url.trim();
    if t.is_empty() || is_youtube_search_url(t) {
        return false;
    }
    if watch_id_re().is_match(t) {
        return true;
    }
    let lower = t.to_ascii_lowercase();
    // Vimeo player/page com id numérico
    lower.contains("vimeo.com/") && t.chars().any(|c| c.is_ascii_digit())
}

/// Extrai ID de vídeo watch se a URL já for de um vídeo.
pub fn extract_watch_url(url: &str) -> Option<String> {
    let t = url.trim();
    if let Some(c) = watch_id_re().captures(t) {
        let id = c.get(1)?.as_str();
        return Some(format!("https://www.youtube.com/watch?v={id}"));
    }
    None
}

fn decode_query_component(raw: &str) -> String {
    urlencoding::decode(raw)
        .map(|s| s.replace('+', " "))
        .unwrap_or_else(|_| raw.replace('+', " "))
}

pub fn extract_search_query(url: &str) -> Option<String> {
    if let Some(c) = search_query_re().captures(url) {
        let q = decode_query_component(c.get(1)?.as_str()).trim().to_string();
        if !q.is_empty() {
            return Some(q);
        }
    }
    None
}

pub fn build_video_query(game_name: &str, achievement_title: &str) -> String {
    format!(
        "{} {} achievement guide",
        game_name.trim(),
        achievement_title.trim()
    )
}

/// Busca no YouTube e devolve o primeiro `watch?v=` encontrado.
pub fn resolve_first_watch_url(query: &str) -> Option<String> {
    let q = query.trim();
    if q.is_empty() {
        return None;
    }

    let url = format!(
        "https://www.youtube.com/results?search_query={}&sp=EgIQAQ%3D%3D",
        urlencoding::encode(q)
    );

    let client = reqwest::blocking::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .ok()?;

    let body = client
        .get(&url)
        .header("Accept-Language", "en-US,en;q=0.9,pt-BR;q=0.8")
        .send()
        .ok()?
        .error_for_status()
        .ok()?
        .text()
        .ok()?;

    first_video_id_from_html(&body).map(|id| format!("https://www.youtube.com/watch?v={id}"))
}

fn first_video_id_from_html(html: &str) -> Option<String> {
    let mut seen = std::collections::HashSet::new();
    for cap in video_id_re().captures_iter(html) {
        let id = cap.get(1)?.as_str();
        // Alguns IDs repetidos / de anúncios; pega o primeiro distinto
        if !seen.insert(id.to_string()) {
            continue;
        }
        // YouTube às vezes injeta IDs placeholder; 11 chars já filtrados
        return Some(id.to_string());
    }
    None
}

/// Converte search URL, query solta ou URL inválida em watch real.
/// Se já for watch/vimeo, normaliza; se falhar a resolução, devolve None.
pub fn ensure_real_video_url(
    raw: &str,
    game_name: &str,
    achievement_title: &str,
) -> Option<String> {
    let t = raw.trim();
    if t.is_empty() {
        return None;
    }
    if let Some(w) = extract_watch_url(t) {
        return Some(w);
    }
    if is_real_video_url(t) {
        return Some(t.to_string());
    }
    let query = extract_search_query(t)
        .filter(|q| !q.is_empty())
        .unwrap_or_else(|| build_video_query(game_name, achievement_title));
    resolve_first_watch_url(&query)
}
