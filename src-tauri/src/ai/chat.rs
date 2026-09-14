use crate::ai::enrich::{
    apply_patch, extract_json_array, materialize_tips_images, run_cli_with_options, CliRunOptions,
};
use crate::ai::intent::{
    detect_intent, detect_intent_with_context, is_placeholder_group, select_targets,
    suggest_gap_tool, IntentPlan, Tool,
};
use crate::ai::settings::{provider_model, resolve_cli_bin, AiProvider, AiSettings};
use crate::ai::youtube::{
    build_video_query, ensure_real_video_url, extract_watch_url, is_real_video_url,
    is_youtube_search_url, resolve_first_watch_url,
};
use crate::db::repos::Achievement;
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatTurnResult {
    pub reply: String,
    pub updated: usize,
    pub videos: usize,
    pub provider: String,
    #[serde(skip)]
    pub achievements: Vec<Achievement>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSource {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatProgressEvent {
    pub id: String,
    pub status: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// step | search | tool | source
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sources: Vec<ProgressSource>,
}

pub type ProgressFn<'a> = dyn Fn(ChatProgressEvent) + Send + 'a;

fn emit(progress: &ProgressFn<'_>, id: &str, status: &str, label: &str, detail: Option<&str>) {
    progress(ChatProgressEvent {
        id: id.into(),
        status: status.into(),
        label: label.into(),
        detail: detail.map(|d| d.to_string()),
        kind: None,
        query: None,
        sources: Vec::new(),
    });
}

fn emit_event(progress: &ProgressFn<'_>, event: ChatProgressEvent) {
    progress(event);
}

fn extract_mentions(msg: &str) -> Vec<(Option<String>, String)> {
    // @[Título](apiName) ou @[Título]
    let re = regex::Regex::new(r"@\[([^\]]+)\](?:\(([^)]+)\))?").expect("mention regex");
    let mut out = Vec::new();
    for cap in re.captures_iter(msg) {
        let title = cap.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
        if title.is_empty() {
            continue;
        }
        let api = cap
            .get(2)
            .map(|m| m.as_str().trim().to_string())
            .filter(|s| !s.is_empty());
        out.push((api, title));
    }
    out
}

fn is_mentioned(a: &Achievement, mentions: &[(Option<String>, String)]) -> bool {
    mentions.iter().any(|(api, title)| {
        if let Some(api) = api {
            if a.api_name.as_deref() == Some(api.as_str()) {
                return true;
            }
        }
        a.title.eq_ignore_ascii_case(title)
    })
}

fn user_wants_levels(user_msg: &str) -> bool {
    detect_intent(user_msg).wants_levels()
}

/// Extrai nível exigido a partir de texto (descrição Steam etc.).
fn extract_level_hint(text: &str) -> Option<String> {
    let t = text.trim();
    if t.is_empty() {
        return None;
    }
    // nível 20 / level 20 / lv 20 / nv. 15-20
    let re_main = regex::Regex::new(
        r"(?i)(?:n[ií]vel(?:es)?|level(?:s)?|lv\.?|nv\.?)\s*[:=]?\s*(\d{1,3})(?:\s*[-–~]\s*(\d{1,3}))?",
    )
    .ok()?;
    if let Some(c) = re_main.captures(t) {
        let a = c.get(1)?.as_str();
        if let Some(b) = c.get(2) {
            return Some(format!("{}-{}", a, b.as_str()));
        }
        return Some(a.to_string());
    }
    // "entre o nível 10 e 20" / "entre 10 e 20 de nível"
    let re_entre = regex::Regex::new(
        r"(?i)entre\s+(?:o\s+)?(?:n[ií]vel\s+)?(\d{1,3})\s+e\s+(?:o\s+)?(?:n[ií]vel\s+)?(\d{1,3})",
    )
    .ok()?;
    if let Some(c) = re_entre.captures(t) {
        return Some(format!("{}-{}", c.get(1)?.as_str(), c.get(2)?.as_str()));
    }
    // "alcance o nível 30" already covered by main
    // "reach level 25"
    let re_reach = regex::Regex::new(r"(?i)reach(?:es|ed)?\s+level\s+(\d{1,3})").ok()?;
    if let Some(c) = re_reach.captures(t) {
        return Some(c.get(1)?.as_str().to_string());
    }
    None
}

fn achievement_level_source(a: &Achievement) -> Option<String> {
    for text in [
        a.description.as_deref().unwrap_or(""),
        a.tips.as_deref().unwrap_or(""),
        a.title.as_str(),
    ] {
        if let Some(lv) = extract_level_hint(text) {
            return Some(lv);
        }
    }
    None
}

/// Preenche reqLevel a partir do texto local quando o usuário pede níveis.
fn fill_levels_from_local(
    patches: &mut Vec<Value>,
    achievements: &[Achievement],
    user_msg: &str,
    progress: &ProgressFn<'_>,
) -> usize {
    if !user_wants_levels(user_msg) {
        return 0;
    }
    emit(
        progress,
        "levels",
        "running",
        "Extraindo níveis das descrições…",
        None,
    );

    let mentions = extract_mentions(user_msg);
    let only_mentions = !mentions.is_empty();
    let mut filled = 0usize;

    for a in achievements {
        if only_mentions && !is_mentioned(a, &mentions) {
            continue;
        }
        let existing = a.req_level.as_deref().unwrap_or("").trim();
        // patch já com reqLevel?
        let mut patch_has = false;
        for p in patches.iter() {
            let same = match a.api_name.as_deref() {
                Some(api) => p
                    .get("apiName")
                    .or_else(|| p.get("api_name"))
                    .and_then(|v| v.as_str())
                    == Some(api),
                None => p
                    .get("title")
                    .and_then(|v| v.as_str())
                    .is_some_and(|t| t.eq_ignore_ascii_case(&a.title)),
            };
            if same {
                if p.get("reqLevel")
                    .or_else(|| p.get("req_level"))
                    .and_then(|v| v.as_str())
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false)
                {
                    patch_has = true;
                }
                break;
            }
        }
        if patch_has {
            continue;
        }
        if !existing.is_empty() && !user_msg.to_ascii_lowercase().contains("todas") && !user_msg.to_ascii_lowercase().contains("todos") {
            // já tem valor; se pedir "ajusta todas" podemos sobrescrever com fonte local
            let force = user_msg.to_ascii_lowercase().contains("ajust")
                || user_msg.to_ascii_lowercase().contains("corrig");
            if !force {
                continue;
            }
        }

        let Some(lv) = achievement_level_source(a) else {
            continue;
        };
        if existing == lv {
            continue;
        }

        let mut matched = false;
        for p in patches.iter_mut() {
            let same = match a.api_name.as_deref() {
                Some(api) => p
                    .get("apiName")
                    .or_else(|| p.get("api_name"))
                    .and_then(|v| v.as_str())
                    == Some(api),
                None => p
                    .get("title")
                    .and_then(|v| v.as_str())
                    .is_some_and(|t| t.eq_ignore_ascii_case(&a.title)),
            };
            if same {
                if let Some(obj) = p.as_object_mut() {
                    obj.insert("reqLevel".into(), json!(lv));
                }
                matched = true;
                break;
            }
        }
        if !matched {
            let mut p = json!({ "reqLevel": lv });
            if let Some(api) = a.api_name.as_ref() {
                p["apiName"] = json!(api);
            } else {
                p["title"] = json!(a.title);
            }
            patches.push(p);
        }
        filled += 1;
    }

    emit(
        progress,
        "levels",
        "done",
        if filled > 0 {
            "Níveis extraídos do texto"
        } else {
            "Nenhum nível explícito nas descrições"
        },
        if filled > 0 {
            Some(pt_count(filled, "conquista", "conquistas"))
        } else {
            None
        }
        .as_deref(),
    );
    filled
}

#[allow(dead_code)]
fn compact_catalog(achievements: &[Achievement], user_msg: &str, limit: usize) -> Vec<Value> {
    let q = user_msg.trim().to_ascii_lowercase();
    let mentions = extract_mentions(user_msg);
    let wants_video = q.contains("youtube")
        || q.contains("vídeo")
        || q.contains("video")
        || q.contains("clip");
    let wants_hard = q.contains("difícil")
        || q.contains("dificil")
        || q.contains("difíceis")
        || q.contains("dificeis")
        || q.contains("hard");
    let wants_levels = user_wants_levels(user_msg);

    let mut scored: Vec<(i32, usize, &Achievement)> = achievements
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let mut score = 0i32;
            if is_mentioned(a, &mentions) {
                score += 500;
            }
            if !q.is_empty() {
                let title = a.title.to_ascii_lowercase();
                let desc = a
                    .description
                    .as_deref()
                    .unwrap_or("")
                    .to_ascii_lowercase();
                let api = a.api_name.as_deref().unwrap_or("").to_ascii_lowercase();
                let plain = regex::Regex::new(r"@\[[^\]]+\](?:\([^)]+\))?")
                    .map(|r| r.replace_all(&q, " ").to_string())
                    .unwrap_or_else(|_| q.clone());
                if title.contains(&plain) || desc.contains(plain.trim()) || api.contains(plain.trim())
                {
                    score += 100;
                }
                for token in plain.split_whitespace().filter(|t| t.len() > 2) {
                    if title.contains(token) || desc.contains(token) || api.contains(token) {
                        score += 10;
                    }
                }
            }
            let tips_empty = a.tips.as_deref().unwrap_or("").trim().is_empty();
            if tips_empty {
                score += 1;
            }
            let difficulty = a.difficulty.as_deref().unwrap_or("").to_ascii_lowercase();
            if wants_hard && difficulty == "hard" {
                score += 40;
            }
            let video_empty = a.video_url.as_deref().unwrap_or("").trim().is_empty();
            if wants_video && video_empty {
                score += 15;
            }
            if wants_video && wants_hard && difficulty == "hard" && video_empty {
                score += 25;
            }
            let level_empty = a.req_level.as_deref().unwrap_or("").trim().is_empty();
            if wants_levels && level_empty {
                score += 40;
            }
            if wants_levels && achievement_level_source(a).is_some() {
                score += 20;
            }
            (score, i, a)
        })
        .collect();

    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    scored
        .into_iter()
        .take(limit.max(1))
        .map(|(_, _, a)| {
            let desc_limit = if wants_levels { 280 } else { 160 };
            let desc = a
                .description
                .as_deref()
                .unwrap_or("")
                .chars()
                .take(desc_limit)
                .collect::<String>();
            json!({
                "apiName": a.api_name,
                "title": a.title,
                "description": desc,
                "group": a.group,
                "hasTips": a.tips.as_deref().unwrap_or("").trim().len() > 0,
                "hasGuide": a.guide_url.as_deref().unwrap_or("").trim().len() > 0,
                "hasVideo": a.video_url.as_deref().unwrap_or("").trim().len() > 0,
                "reqLevel": a.req_level,
                "hasReqLevel": a.req_level.as_deref().unwrap_or("").trim().len() > 0,
                "difficulty": a.difficulty,
                "missable": a.missable,
                "mentioned": is_mentioned(a, &mentions),
            })
        })
        .collect()
}

fn build_chat_prompt(
    game_name: &str,
    app_id: &str,
    catalog: &[Value],
    history: &[ChatMessage],
    user_message: &str,
    plan: &IntentPlan,
) -> String {
    // Histórico mínimo em tools (poupa tokens); Ask um pouco mais
    let (hist_take, hist_chars) = match plan.primary {
        Tool::Ask => (3usize, 220usize),
        _ => (1, 160),
    };
    let hist: String = history
        .iter()
        .rev()
        .take(hist_take)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|m| {
            format!(
                "{}: {}",
                m.role,
                m.content.chars().take(hist_chars).collect::<String>()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let mentions = extract_mentions(user_message);
    let mentions_block = if mentions.is_empty() {
        String::new()
    } else {
        let block = mentions
            .iter()
            .map(|(api, title)| {
                if let Some(api) = api {
                    format!("- {title} ({api})")
                } else {
                    format!("- {title}")
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
        format!("\n@ prioridade:\n{block}\n")
    };

    let fields = plan.allowed_patch_fields().join(",");
    let focus = plan.focus_instructions();
    let web = if plan.agentic {
        "Web ok se faltar dado."
    } else {
        "Sem web neste turno."
    };
    let hist_block = if hist.trim().is_empty() {
        String::new()
    } else {
        format!("\nHist:\n{hist}\n")
    };

    // Prompt curto estilo “tool call”: só o necessário
    format!(
        r#"Questlog. Saída: JSON único.
Tool: {tool}
{focus}
{web}
Jogo: {game_name} ({app_id})
Itens ({n}):
{catalog}
{mentions_block}{hist_block}
Pedido: {user_message}

{{"reply":"frase curta pt-BR","patches":[{{"apiName":"...",campos:{fields}}}]}}
Só apiNames da lista. Só campos: {fields}. Sem travessão (—) nem --- na reply. Não copie estas instruções na reply."#,
        tool = plan.label,
        focus = focus,
        web = web,
        catalog = serde_json::to_string(catalog).unwrap_or_else(|_| "[]".into()),
        mentions_block = mentions_block,
        hist_block = hist_block,
        n = catalog.len(),
        fields = fields,
    )
}

fn user_wants_videos(user_msg: &str) -> bool {
    detect_intent(user_msg).wants_videos()
}

const CATALOG_CHUNK: usize = 20;

/// Catálogo enxuto por ferramenta (estilo grep: só campos úteis).
fn achievements_to_catalog(items: &[&Achievement], plan: &IntentPlan) -> Vec<Value> {
    items
        .iter()
        .map(|a| match plan.primary {
            Tool::Difficulty | Tool::Missable => {
                let desc = a
                    .description
                    .as_deref()
                    .unwrap_or("")
                    .chars()
                    .take(72)
                    .collect::<String>();
                let mut v = json!({
                    "apiName": a.api_name,
                    "title": a.title,
                    "description": desc,
                });
                if let Some(p) = a.global_percent {
                    v["pct"] = json!(p);
                }
                if plan.primary == Tool::Missable {
                    v["missable"] = json!(a.missable);
                }
                v
            }
            Tool::Groups => {
                let desc = a
                    .description
                    .as_deref()
                    .unwrap_or("")
                    .chars()
                    .take(56)
                    .collect::<String>();
                json!({
                    "apiName": a.api_name,
                    "title": a.title,
                    "description": desc,
                    "group": a.group,
                })
            }
            Tool::Levels => {
                let desc = a
                    .description
                    .as_deref()
                    .unwrap_or("")
                    .chars()
                    .take(100)
                    .collect::<String>();
                json!({
                    "apiName": a.api_name,
                    "title": a.title,
                    "description": desc,
                    "reqLevel": a.req_level,
                })
            }
            Tool::Videos => json!({
                "apiName": a.api_name,
                "title": a.title,
                "difficulty": a.difficulty,
            }),
            Tool::Tips => {
                let desc = a
                    .description
                    .as_deref()
                    .unwrap_or("")
                    .chars()
                    .take(90)
                    .collect::<String>();
                json!({
                    "apiName": a.api_name,
                    "title": a.title,
                    "description": desc,
                    "hasTips": a.tips.as_deref().unwrap_or("").trim().len() > 0,
                })
            }
            Tool::Ask | Tool::FullEnrich => {
                let desc = a
                    .description
                    .as_deref()
                    .unwrap_or("")
                    .chars()
                    .take(100)
                    .collect::<String>();
                json!({
                    "apiName": a.api_name,
                    "title": a.title,
                    "description": desc,
                    "group": a.group,
                    "difficulty": a.difficulty,
                    "missable": a.missable,
                    "hasTips": a.tips.as_deref().unwrap_or("").trim().len() > 0,
                    "hasVideo": a.video_url.as_deref().unwrap_or("").trim().len() > 0,
                    "reqLevel": a.req_level,
                })
            }
        })
        .collect()
}

#[allow(dead_code)]
fn order_achievements_for_full_pass<'a>(
    achievements: &'a [Achievement],
    user_msg: &str,
) -> Vec<&'a Achievement> {
    let mentions = extract_mentions(user_msg);
    let mut items: Vec<&Achievement> = achievements.iter().collect();
    items.sort_by(|a, b| {
        let am = is_mentioned(a, &mentions);
        let bm = is_mentioned(b, &mentions);
        match (am, bm) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let ra = match a.difficulty.as_deref().unwrap_or("") {
                    "hard" => 0u8,
                    "medium" => 1,
                    "easy" => 2,
                    _ => 3,
                };
                let rb = match b.difficulty.as_deref().unwrap_or("") {
                    "hard" => 0u8,
                    "medium" => 1,
                    "easy" => 2,
                    _ => 3,
                };
                ra.cmp(&rb).then_with(|| a.title.cmp(&b.title))
            }
        }
    });
    items
}

fn merge_patches(patches: Vec<Value>) -> Vec<Value> {
    use std::collections::HashMap;
    let mut by_key: HashMap<String, Value> = HashMap::new();
    let mut order: Vec<String> = Vec::new();

    for p in patches {
        let key = p
            .get("apiName")
            .or_else(|| p.get("api_name"))
            .and_then(|v| v.as_str())
            .map(|s| format!("api:{s}"))
            .or_else(|| {
                p.get("title")
                    .or_else(|| p.get("nome"))
                    .and_then(|v| v.as_str())
                    .map(|s| format!("title:{}", s.to_ascii_lowercase()))
            })
            .unwrap_or_else(|| format!("anon:{}", by_key.len()));

        if let Some(existing) = by_key.get_mut(&key) {
            if let (Some(eo), Some(po)) = (existing.as_object_mut(), p.as_object()) {
                for (k, v) in po {
                    eo.insert(k.clone(), v.clone());
                }
            }
        } else {
            order.push(key.clone());
            by_key.insert(key, p);
        }
    }

    order
        .into_iter()
        .filter_map(|k| by_key.remove(&k))
        .collect()
}

fn achievement_needs_video(a: &Achievement) -> bool {
    let u = a.video_url.as_deref().unwrap_or("").trim();
    u.is_empty() || is_youtube_search_url(u) || !is_real_video_url(u)
}

/// Quantos vídeos buscar quando o usuário pede YouTube.
fn video_fill_limit(user_msg: &str, needing: usize) -> usize {
    if needing == 0 {
        return 0;
    }
    let plan = detect_intent(user_msg);
    if plan.full_guide {
        return needing;
    }
    needing.min(plan.catalog_cap.max(1))
}

fn achievement_key(a: &Achievement) -> String {
    a.api_name
        .clone()
        .unwrap_or_else(|| format!("title:{}", a.title.to_ascii_lowercase()))
}

/// Troca links de pesquisa e preenche vídeos watch reais em lote.
/// Retorna quantos `videoUrl` watch reais entraram nos patches.
fn resolve_videos_in_patches(
    patches: &mut Vec<Value>,
    achievements: &[Achievement],
    game_name: &str,
    user_msg: &str,
    progress: &ProgressFn<'_>,
) -> usize {
    let wants = user_wants_videos(user_msg);
    let mut found_sources: Vec<ProgressSource> = Vec::new();

    let publish_videos = |status: &str, label: &str, detail: Option<&str>, query: Option<&str>, sources: &[ProgressSource]| {
        emit_event(
            progress,
            ChatProgressEvent {
                id: "videos".into(),
                status: status.into(),
                label: label.into(),
                detail: detail.map(|d| d.to_string()),
                kind: Some("search".into()),
                query: query.map(|q| q.to_string()),
                sources: sources.to_vec(),
            },
        );
    };

    publish_videos(
        "running",
        "Buscando vídeos no YouTube…",
        None,
        None,
        &found_sources,
    );

    let mut touched = 0usize;

    // 1) Normaliza videoUrl que a IA já mandou (search → watch)
    for patch in patches.iter_mut() {
        let api = patch
            .get("apiName")
            .or_else(|| patch.get("api_name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let title_hint = patch
            .get("title")
            .or_else(|| patch.get("nome"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let target = achievements.iter().find(|a| {
            if let Some(ref api) = api {
                if a.api_name.as_deref() == Some(api.as_str()) {
                    return true;
                }
            }
            if let Some(ref t) = title_hint {
                return a.title.eq_ignore_ascii_case(t);
            }
            false
        });
        let title = target
            .map(|a| a.title.as_str())
            .or(title_hint.as_deref())
            .unwrap_or("")
            .to_string();

        let raw_video = patch
            .get("videoUrl")
            .or_else(|| patch.get("video_url"))
            .or_else(|| patch.get("video"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        match raw_video {
            Some(ref url) if is_real_video_url(url) => {
                if let Some(w) = extract_watch_url(url) {
                    if let Some(obj) = patch.as_object_mut() {
                        obj.insert("videoUrl".into(), json!(w));
                    }
                    if !title.is_empty() {
                        found_sources.push(ProgressSource {
                            id: w.clone(),
                            title: title.clone(),
                            domain: Some("youtube.com".into()),
                            url: Some(w),
                        });
                        publish_videos(
                            "running",
                            "Buscando vídeos no YouTube…",
                            Some(&title),
                            None,
                            &found_sources,
                        );
                    }
                }
            }
            Some(url) => {
                let query = build_video_query(game_name, &title);
                publish_videos(
                    "running",
                    "Buscando vídeos no YouTube…",
                    Some(&title),
                    Some(&query),
                    &found_sources,
                );
                if let Some(watch) = ensure_real_video_url(&url, game_name, &title) {
                    if let Some(obj) = patch.as_object_mut() {
                        obj.insert("videoUrl".into(), json!(watch));
                    }
                    touched += 1;
                    found_sources.push(ProgressSource {
                        id: watch.clone(),
                        title: if title.is_empty() {
                            "Vídeo do YouTube".into()
                        } else {
                            title.clone()
                        },
                        domain: Some("youtube.com".into()),
                        url: Some(watch),
                    });
                    publish_videos(
                        "running",
                        "Buscando vídeos no YouTube…",
                        Some(&title),
                        Some(&query),
                        &found_sources,
                    );
                } else if let Some(obj) = patch.as_object_mut() {
                    obj.remove("videoUrl");
                    obj.remove("video_url");
                    obj.remove("video");
                }
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
            None => {}
        }
    }

    // 2) Pedido de vídeo: preenche em LOTE o que falta (não depende da lista curta da IA)
    if wants {
        let needing: Vec<&Achievement> = achievements
            .iter()
            .filter(|a| achievement_needs_video(a))
            .collect();

        // Já tem watch real neste conjunto de patches?
        let mut done: HashSet<String> = HashSet::new();
        for patch in patches.iter() {
            let ok = patch
                .get("videoUrl")
                .or_else(|| patch.get("video_url"))
                .and_then(|v| v.as_str())
                .map(is_real_video_url)
                .unwrap_or(false);
            if !ok {
                continue;
            }
            if let Some(api) = patch
                .get("apiName")
                .or_else(|| patch.get("api_name"))
                .and_then(|v| v.as_str())
            {
                done.insert(api.to_string());
            }
            if let Some(t) = patch
                .get("title")
                .or_else(|| patch.get("nome"))
                .and_then(|v| v.as_str())
            {
                done.insert(format!("title:{}", t.to_ascii_lowercase()));
            }
        }

        let mut candidates = needing;
        let mentions = extract_mentions(user_msg);
        candidates.sort_by_key(|a| {
            // mencionadas com @ sempre primeiro
            let mentioned = if is_mentioned(a, &mentions) { 0u8 } else { 1 };
            let d = a.difficulty.as_deref().unwrap_or("").to_ascii_lowercase();
            let rank = match d.as_str() {
                "hard" => 0u8,
                "medium" => 1,
                "easy" => 2,
                _ => 3,
            };
            let miss = if a.missable { 0u8 } else { 1 };
            (mentioned, rank, miss, a.title.clone())
        });

        // Se o usuário citou conquistas com @, garante todas elas no lote (sem estourar 40)
        let mut limit = video_fill_limit(user_msg, candidates.len());
        if !mentions.is_empty() {
            let need_mentions = candidates
                .iter()
                .filter(|a| is_mentioned(a, &mentions))
                .count();
            limit = limit.max(need_mentions);
        }

        let mut filled = 0usize;
        for a in candidates {
            if filled >= limit {
                break;
            }
            let key = achievement_key(a);
            if done.contains(&key) {
                continue;
            }
            if a.api_name
                .as_ref()
                .is_some_and(|api| done.contains(api.as_str()))
            {
                continue;
            }
            // Já tem watch real no banco (ex.: corrida anterior)
            let existing = a.video_url.as_deref().unwrap_or("").trim();
            if is_real_video_url(existing) {
                continue;
            }

            let query = build_video_query(game_name, &a.title);
            publish_videos(
                "running",
                "Buscando vídeos no YouTube…",
                Some(&a.title),
                Some(&query),
                &found_sources,
            );
            let Some(watch) = resolve_first_watch_url(&query) else {
                std::thread::sleep(std::time::Duration::from_millis(300));
                continue;
            };

            // Reaproveita patch existente da conquista se houver
            let mut matched = false;
            for patch in patches.iter_mut() {
                let same = match a.api_name.as_deref() {
                    Some(api) => patch
                        .get("apiName")
                        .or_else(|| patch.get("api_name"))
                        .and_then(|v| v.as_str())
                        == Some(api),
                    None => patch
                        .get("title")
                        .or_else(|| patch.get("nome"))
                        .and_then(|v| v.as_str())
                        .is_some_and(|t| t.eq_ignore_ascii_case(&a.title)),
                };
                if same {
                    if let Some(obj) = patch.as_object_mut() {
                        obj.insert("videoUrl".into(), json!(watch));
                    }
                    matched = true;
                    break;
                }
            }
            if !matched {
                let mut p = json!({ "videoUrl": watch });
                if let Some(api) = a.api_name.as_ref() {
                    p["apiName"] = json!(api);
                } else {
                    p["title"] = json!(a.title);
                }
                patches.push(p);
            }

            done.insert(key);
            touched += 1;
            filled += 1;
            found_sources.push(ProgressSource {
                id: watch.clone(),
                title: a.title.clone(),
                domain: Some("youtube.com".into()),
                url: Some(watch),
            });
            publish_videos(
                "running",
                "Buscando vídeos no YouTube…",
                Some(&a.title),
                Some(&query),
                &found_sources,
            );
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    }

    let detail = if touched > 0 {
        Some(format!("{touched} vídeo(s)"))
    } else {
        None
    };
    publish_videos(
        "done",
        if touched > 0 {
            "Vídeos encontrados"
        } else {
            "Nenhum vídeo novo"
        },
        detail.as_deref(),
        None,
        &found_sources,
    );
    touched
}

/// Limpa o “vai buscar” e fecha no passado, com contagem real.
fn is_banned_assistant_line(line: &str) -> bool {
    let l = line.to_ascii_lowercase();
    let needles = [
        "vai buscar",
        "app vai",
        "o app ",
        "aguarde",
        "em breve",
        "pesquisar na web",
        "busca na web",
        "não consegui pesquisar",
        "nao consegui pesquisar",
        "permissão",
        "permissao",
        "prefiro não inventar",
        "prefiro nao inventar",
        "não responda",
        "nao responda",
        "websearch",
        "webfetch",
        "markdown leve",
        "sem falar de ferramenta",
        "sem falar de ferramentas",
        "campos permitidos",
        "sem markdown fora",
        "ferramenta ativa",
        "só este jogo",
        "não invente conquistas",
        "nao invente conquistas",
    ];
    needles.iter().any(|n| l.contains(n))
}

fn looks_like_prompt_leak(reply: &str) -> bool {
    let t = reply.trim();
    if t.is_empty() {
        return false;
    }
    let l = t.to_ascii_lowercase();
    if l.contains("markdown leve")
        || l.contains("sem falar de ferramenta")
        || l.contains("campos permitidos")
        || l.contains("sem markdown fora do json")
        || l.contains("resumo curto do que foi feito")
        || l.contains("campos permitidos:")
    {
        return true;
    }
    // reply curta que só ecoa o schema
    t.len() < 140
        && l.contains("pt-br")
        && (l.contains("passado") || l.contains("curto"))
}

fn pt_count(n: usize, one: &str, many: &str) -> String {
    if n == 1 {
        format!("1 {one}")
    } else {
        format!("{n} {many}")
    }
}

fn is_generic_title(title: &str) -> bool {
    let t = title.trim().to_ascii_lowercase();
    t.is_empty()
        || t == "nova conquista"
        || t == "new achievement"
        || t == "untitled"
        || t == "sem título"
        || t == "sem titulo"
}

fn is_generic_group(name: &str) -> bool {
    let g = name.trim().to_ascii_lowercase();
    g.is_empty()
        || g == "outras"
        || g == "outras conquistas"
        || g == "outros"
        || g == "diversos"
        || g == "geral"
        || g == "misc"
        || g == "variados"
        || g == "sem categoria"
        || g == "sem grupo"
}

fn looks_like_markdown(reply: &str) -> bool {
    reply.contains('\n')
        || reply.contains("##")
        || reply.contains("**")
        || reply.contains("- ")
        || reply.contains("* ")
        || reply.contains("1. ")
        || reply.contains('>')
}

fn summarize_groups_reply(patches: &[Value], updated: usize, fallback: &str) -> String {
    if updated == 0 {
        return fallback.to_string();
    }
    let mut names: Vec<String> = Vec::new();
    for p in patches {
        let Some(g) = p
            .get("group")
            .or_else(|| p.get("grupo"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        if is_generic_group(g) {
            continue;
        }
        if !names.iter().any(|n| n.eq_ignore_ascii_case(g)) {
            names.push(g.to_string());
        }
    }
    names.sort();
    if names.is_empty() {
        let low = fallback.to_ascii_lowercase();
        if low.contains("outras") || low.contains("diversos") || low.contains("geral") || fallback.trim().is_empty()
        {
            return format!(
                "Organizei **{}** em grupos. Revise os nomes se quiser algo mais específico.",
                pt_count(updated, "conquista", "conquistas")
            );
        }
        return fallback.to_string();
    }
    if names.len() == 1 {
        format!(
            "Agrupei **{}** em **{}**.",
            pt_count(updated, "conquista", "conquistas"),
            names[0]
        )
    } else {
        format!(
            "Agrupei **{}** em {} grupos: **{}**.",
            pt_count(updated, "conquista", "conquistas"),
            names.len(),
            names.join("**, **")
        )
    }
}

fn summarize_missable_reply(
    patches: &[Value],
    achievements: &[Achievement],
    considered: usize,
    fallback: &str,
) -> String {
    let mut yes_titles: Vec<String> = Vec::new();
    let mut marked = 0usize;
    for p in patches {
        let Some(flag) = p.get("missable").and_then(|v| v.as_bool()) else {
            continue;
        };
        marked += 1;
        if !flag {
            continue;
        }
        let title = p
            .get("title")
            .or_else(|| p.get("nome"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .or_else(|| {
                let api = p
                    .get("apiName")
                    .or_else(|| p.get("api_name"))
                    .and_then(|v| v.as_str())?;
                achievements
                    .iter()
                    .find(|a| a.api_name.as_deref() == Some(api))
                    .map(|a| a.title.clone())
            });
        if let Some(t) = title {
            if !yes_titles.iter().any(|n| n.eq_ignore_ascii_case(&t)) {
                yes_titles.push(t);
            }
        }
    }

    let n = considered.max(marked);
    if yes_titles.is_empty() {
        if n == 0 && fallback.trim().is_empty() {
            return "Não achei conquistas para classificar como perdíveis.".into();
        }
        if n == 0 {
            return fallback.to_string();
        }
        return format!(
            "Revisei **{}**: nenhuma é perdível. Costumam ficar acessíveis (mundo aberto / sem ponto de não retorno).",
            pt_count(n, "conquista", "conquistas")
        );
    }

    yes_titles.sort();
    let shown = yes_titles.iter().take(6).cloned().collect::<Vec<_>>();
    let extra = yes_titles.len().saturating_sub(shown.len());
    let list = if extra > 0 {
        format!("{}** e mais {}**", shown.join("**, **"), extra)
    } else {
        shown.join("**, **")
    };
    format!(
        "Marquei **{}** como perdíveis: **{}**. As demais não são.",
        yes_titles.len(),
        list
    )
}

fn summarize_difficulty_reply(patches: &[Value], considered: usize, fallback: &str) -> String {
    let mut easy = 0usize;
    let mut medium = 0usize;
    let mut hard = 0usize;
    for p in patches {
        let Some(d) = p
            .get("difficulty")
            .or_else(|| p.get("dificuldade"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_ascii_lowercase())
        else {
            continue;
        };
        match d.as_str() {
            "easy" | "fácil" | "facil" => easy += 1,
            "medium" | "médio" | "medio" => medium += 1,
            "hard" | "difícil" | "dificil" => hard += 1,
            _ => {}
        }
    }
    let classified = easy + medium + hard;
    if classified == 0 {
        return if fallback.trim().is_empty() {
            format!(
                "Revisei **{}**, mas não apliquei classificações novas.",
                pt_count(considered.max(1), "conquista", "conquistas")
            )
        } else {
            fallback.to_string()
        };
    }
    let mut parts = Vec::new();
    if easy > 0 {
        parts.push(format!("{easy} fáceis"));
    }
    if medium > 0 {
        parts.push(format!("{medium} médias"));
    }
    if hard > 0 {
        parts.push(format!("{hard} difíceis"));
    }
    format!(
        "Classifiquei **{}**: {}.",
        pt_count(classified, "conquista", "conquistas"),
        parts.join(", ")
    )
}

fn sanitize_pt_dashes(text: &str) -> String {
    // BR: ninguém usa travessão tipográfico; troca por ponto/vírgula
    let mut out = text.replace(" — ", ". ").replace(" – ", ". ");
    out = out.replace('—', ". ").replace('–', "-");
    while out.contains("---") {
        out = out.replace("---", ". ");
    }
    while out.contains(". .") {
        out = out.replace(". .", ".");
    }
    while out.contains("  ") {
        out = out.replace("  ", " ");
    }
    out.trim().to_string()
}

fn coerce_patch_scalars(patches: &mut [Value]) {
    for p in patches.iter_mut() {
        let Some(obj) = p.as_object_mut() else {
            continue;
        };
        for key in ["reqLevel", "req_level"] {
            if let Some(v) = obj.get(key).cloned() {
                if let Some(n) = v.as_number() {
                    obj.insert(key.into(), json!(n.to_string()));
                }
            }
        }
    }
}

/// Níveis só valem se o texto da conquista citar o nível. Remove invenção do modelo.
fn scrub_invented_level_patches(patches: &mut Vec<Value>, achievements: &[Achievement]) {
    let mut kept = Vec::with_capacity(patches.len());
    for mut p in patches.drain(..) {
        let api = p
            .get("apiName")
            .or_else(|| p.get("api_name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let title = p
            .get("title")
            .or_else(|| p.get("nome"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let target = achievements.iter().find(|a| {
            if let Some(ref api) = api {
                if a.api_name.as_deref() == Some(api.as_str()) {
                    return true;
                }
            }
            if let Some(ref t) = title {
                return a.title.eq_ignore_ascii_case(t);
            }
            false
        });

        let Some(a) = target else {
            continue;
        };

        let has_req = p
            .get("reqLevel")
            .or_else(|| p.get("req_level"))
            .map(|v| match v {
                Value::String(s) => !s.trim().is_empty(),
                Value::Number(_) => true,
                _ => false,
            })
            .unwrap_or(false);

        if has_req {
            if let Some(lv) = achievement_level_source(a) {
                if let Some(obj) = p.as_object_mut() {
                    obj.insert("reqLevel".into(), json!(lv));
                    obj.remove("req_level");
                }
            } else if let Some(obj) = p.as_object_mut() {
                obj.remove("reqLevel");
                obj.remove("req_level");
            }
        }

        let useful = p
            .as_object()
            .map(|obj| {
                obj.keys().any(|k| {
                    !matches!(
                        k.as_str(),
                        "apiName" | "api_name" | "title" | "nome" | "displayName"
                    )
                })
            })
            .unwrap_or(false);
        if useful {
            kept.push(p);
        }
    }
    *patches = kept;
}

fn polish_assistant_reply(reply: &str, updated: usize, videos: usize, wants_video: bool) -> String {
    if looks_like_prompt_leak(reply) {
        return if updated > 0 {
            format!("Pronto. Atualizei **{}**.", pt_count(updated, "conquista", "conquistas"))
        } else if wants_video && videos > 0 {
            format!("Adicionei **{}** do YouTube.", pt_count(videos, "vídeo", "vídeos"))
        } else {
            "Pronto.".into()
        };
    }

    let mut out = if looks_like_markdown(reply) {
        reply
            .lines()
            .filter(|line| !is_banned_assistant_line(line))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    } else {
        // texto plano: filtra frases problemáticas sem destruir o conteúdo inteiro
        reply
            .split(|c| c == '.' || c == '!' || c == '?')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .filter(|s| !is_banned_assistant_line(s))
            .collect::<Vec<_>>()
            .join(". ")
            .trim()
            .trim_end_matches('.')
            .to_string()
    };

    if looks_like_prompt_leak(&out) {
        out.clear();
    }

    if wants_video && videos > 0 {
        let suffix = format!(
            "Adicionei **{}** do YouTube nas conquistas.",
            pt_count(videos, "vídeo", "vídeos")
        );
        if out.is_empty() {
            out = suffix;
        } else {
            let low = out.to_ascii_lowercase();
            if !low.contains("adicionei") && !low.contains("vídeo") && !low.contains("video") {
                out = format!("{out}\n\n{suffix}");
            }
        }
    } else if wants_video && videos == 0 && out.is_empty() {
        out = "Não consegui achar vídeos watch do YouTube agora. Tente de novo.".into();
    } else if out.is_empty() && updated > 0 {
        out = format!("Pronto. Atualizei **{}**.", pt_count(updated, "conquista", "conquistas"));
    } else if out.is_empty() {
        out = "Não consegui aplicar mudanças. Reformule o pedido.".into();
    }

    out = sanitize_pt_dashes(&out);

    // não força ponto final em markdown (títulos/listas)
    if !looks_like_markdown(&out)
        && !out.ends_with('.')
        && !out.ends_with('!')
        && !out.ends_with('?')
    {
        out.push('.');
    }
    out
}

fn has_video(a: &Achievement) -> bool {
    a.video_url.as_deref().unwrap_or("").trim().len() > 0
}

fn has_group_set(a: &Achievement) -> bool {
    !is_placeholder_group(a.group.as_deref().unwrap_or(""))
}

fn coverage_footer(
    achievements: &[Achievement],
    updated: usize,
    videos: usize,
    primary: Tool,
    user_msg: &str,
    full_pass: bool,
) -> Option<String> {
    let total = achievements.len();
    if total == 0 {
        return None;
    }

    // Cobertura é o resumo padrão das tools de guia
    let relevant = matches!(
        primary,
        Tool::Tips
            | Tool::Levels
            | Tool::Videos
            | Tool::Groups
            | Tool::Missable
            | Tool::Difficulty
            | Tool::FullEnrich
    );
    if !relevant {
        return None;
    }
    if matches!(primary, Tool::Tips | Tool::Levels | Tool::FullEnrich) && !full_pass {
        return None;
    }

    let mut lines = vec![
        "---".into(),
        "".into(),
        "### Cobertura".into(),
        "".into(),
        format!("- **Alteradas nesta rodada:** {updated} de {total}"),
    ];

    match primary {
        Tool::Videos => {
            let with_video = achievements.iter().filter(|a| has_video(a)).count();
            let without = total.saturating_sub(with_video);
            lines.push(format!("- **Com vídeo:** {with_video} de {total}"));
            if videos > 0 && videos != updated {
                lines.push(format!("- **Vídeos ligados agora:** {videos}"));
            }
            if without > 0 {
                lines.push("".into());
                lines.push(format!(
                    "Ainda faltam **{without}** sem vídeo. Peça *completa os vídeos que faltam* para outra passada só nos vazios."
                ));
            }
        }
        Tool::Levels => {
            let with_level = achievements
                .iter()
                .filter(|a| a.req_level.as_deref().unwrap_or("").trim().len() > 0)
                .count();
            let without_level = total.saturating_sub(with_level);
            lines.push(format!("- **Com nível:** {with_level} de {total}"));
            if without_level > 0 {
                lines.push(format!(
                    "- **Sem nível:** {without_level} (sem zona/dado fixo, gestão de tribo, ou já deliberadamente vazias)"
                ));
                lines.push("".into());
                if updated > 0 {
                    lines.push(
                        "Peça *completa os níveis que faltam* se quiser outra passada só nos vazios."
                            .into(),
                    );
                } else if with_level == 0 {
                    lines.push(
                        "Neste guia não há nível explícito no texto das conquistas; outra passada não vai inventar valores."
                            .into(),
                    );
                }
            }
        }
        Tool::Groups => {
            let with_group = achievements.iter().filter(|a| has_group_set(a)).count();
            lines.push(format!("- **Com grupo:** {with_group} de {total}"));
        }
        Tool::Missable => {
            let missable = achievements.iter().filter(|a| a.missable).count();
            lines.push(format!("- **Marcadas perdíveis:** {missable} de {total}"));
        }
        Tool::Difficulty => {
            let with_diff = achievements
                .iter()
                .filter(|a| {
                    matches!(
                        a.difficulty.as_deref().map(|s| s.trim()),
                        Some("easy" | "medium" | "hard")
                    )
                })
                .count();
            lines.push(format!("- **Com dificuldade:** {with_diff} de {total}"));
        }
        Tool::Tips | Tool::FullEnrich => {
            if user_wants_levels(user_msg) && primary == Tool::FullEnrich {
                let with_level = achievements
                    .iter()
                    .filter(|a| a.req_level.as_deref().unwrap_or("").trim().len() > 0)
                    .count();
                let without_level = total.saturating_sub(with_level);
                lines.push(format!("- **Com nível:** {with_level} de {total}"));
                if without_level > 0 {
                    lines.push(format!("- **Sem nível:** {without_level}"));
                    lines.push("".into());
                    lines.push(
                        "Peça *completa os níveis que faltam* se quiser outra passada só nos vazios."
                            .into(),
                    );
                }
            } else {
                let with_tips = achievements
                    .iter()
                    .filter(|a| a.tips.as_deref().unwrap_or("").trim().len() > 0)
                    .count();
                let without_tips = total.saturating_sub(with_tips);
                lines.push(format!("- **Com dicas:** {with_tips} de {total}"));
                if without_tips > 0 {
                    lines.push("".into());
                    lines.push(format!(
                        "Ainda faltam **{without_tips}** sem dica. Peça *completa as dicas que faltam* para outra passada só nos vazios."
                    ));
                }
            }
        }
        _ => {}
    }

    Some(lines.join("\n"))
}

fn extract_chat_object(text: &str) -> AppResult<(String, Vec<Value>)> {
    let trimmed = text.trim();

    let try_obj = |raw: &str| -> Option<(String, Vec<Value>)> {
        let v: Value = serde_json::from_str(raw).ok()?;
        let reply = v
            .get("reply")
            .or_else(|| v.get("message"))
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let patches = v
            .get("patches")
            .or_else(|| v.get("updates"))
            .and_then(|x| x.as_array())
            .cloned()
            .unwrap_or_default();
        Some((reply, patches))
    };

    if let Some(out) = try_obj(trimmed) {
        return Ok(out);
    }

    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end > start {
                if let Some(out) = try_obj(&trimmed[start..=end]) {
                    return Ok(out);
                }
            }
        }
    }

    if let Ok(arr) = extract_json_array(trimmed) {
        return Ok((
            format!("Atualizei {}.", pt_count(arr.len(), "conquista", "conquistas")),
            arr,
        ));
    }

    Ok((trimmed.chars().take(800).collect(), Vec::new()))
}

pub fn chat_turn(
    settings: &AiSettings,
    provider: AiProvider,
    model_override: Option<&str>,
    app_id: &str,
    game_name: &str,
    mut achievements: Vec<Achievement>,
    history: &[ChatMessage],
    user_message: &str,
    api_key: &str,
    progress: &ProgressFn<'_>,
    app_data: &std::path::Path,
    job: Option<&crate::ai::cancel::AiJobControl>,
) -> AppResult<ChatTurnResult> {
    let msg = user_message.trim();
    if msg.is_empty() {
        return Err(AppError::Message("Digite uma mensagem.".into()));
    }
    if job.map(|j| j.cancelled()).unwrap_or(false) {
        return Err(AppError::Message(crate::ai::cancel::CANCELLED_MSG.into()));
    }

    emit(
        progress,
        "context",
        "running",
        "Revisando o jogo…",
        Some(game_name),
    );

    let model = model_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| provider_model(settings, provider));

    emit(
        progress,
        "context",
        "done",
        "Contexto do jogo",
        Some(&format!(
            "{game_name} · {} conquistas",
            achievements.len()
        )),
    );

    emit_event(
        progress,
        ChatProgressEvent {
            id: "intent".into(),
            status: "running".into(),
            label: "Identificando o pedido…".into(),
            detail: None,
            kind: Some("tool".into()),
            query: None,
            sources: Vec::new(),
        },
    );

    // Histórico recente: “completa o que falta” herda a última Cobertura (vídeo/dica/nível…).
    let recent_context: String = history
        .iter()
        .rev()
        .take(6)
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    let mut plan = detect_intent_with_context(msg, &recent_context);
    // Pedido genérico sem pista no histórico: completa o maior buraco do guia (ex.: vídeos).
    if plan.primary == Tool::Ask {
        let ql = msg.trim().to_ascii_lowercase();
        let looks_gap = ql.contains("o que falta")
            || ql.contains("que faltam")
            || (ql.contains("completa") && (ql.contains("falta") || ql.contains("vazio")));
        if looks_gap {
            if let Some(tool) = suggest_gap_tool(&achievements) {
                let seed = match tool {
                    Tool::Videos => "completa os vídeos que faltam",
                    Tool::Tips => "completa as dicas que faltam",
                    Tool::Levels => "completa os níveis que faltam",
                    Tool::Groups => "completa os grupos que faltam",
                    _ => "completa as dicas que faltam",
                };
                plan = detect_intent(seed);
            }
        }
    }
    emit_event(
        progress,
        ChatProgressEvent {
            id: "intent".into(),
            status: "done".into(),
            label: format!("Ferramenta: {}", plan.label),
            detail: Some(plan.detail.clone()),
            kind: Some("tool".into()),
            query: None,
            sources: Vec::new(),
        },
    );

    emit(
        progress,
        "catalog",
        "running",
        "Selecionando conquistas da ferramenta…",
        None,
    );

    let full_pass = plan.full_guide;
    let total = achievements.len();
    let ordered = select_targets(&achievements, msg, &plan);
    let chunk_size = plan.chunk_size.max(1).min(CATALOG_CHUNK);
    let chunks: Vec<&[&Achievement]> = if ordered.len() > chunk_size {
        ordered.chunks(chunk_size).collect()
    } else {
        vec![ordered.as_slice()]
    };

    emit(
        progress,
        "catalog",
        "done",
        if ordered.is_empty() {
            "Nada pendente para esta ferramenta"
        } else if full_pass {
            "Vou cobrir o guia em grupos"
        } else {
            "Contexto filtrado pela ferramenta"
        },
        Some(&format!(
            "{total} no jogo · {} no pedido · {} lote(s)",
            ordered.len(),
            if ordered.is_empty() { 0 } else { chunks.len() }
        )),
    );

    let mut all_patches: Vec<Value> = Vec::new();
    let mut replies: Vec<String> = Vec::new();
    let chunk_total = chunks.len();

    if ordered.is_empty() {
        let empty_msg = match plan.primary {
            Tool::Videos => "Todas as conquistas relevantes já têm vídeo.".to_string(),
            Tool::Groups => "Não achei conquistas sem grupo. Peça para *refazer os grupos* se quiser reorganizar.".to_string(),
            Tool::Levels => "Nenhuma conquista sem nível para preencher.".to_string(),
            Tool::Tips => "Não achei conquistas sem dica neste recorte.".to_string(),
            Tool::Difficulty => "Não achei conquistas sem dificuldade.".to_string(),
            _ => "Nada a alterar com este pedido.".to_string(),
        };
        replies.push(empty_msg);
        emit(
            progress,
            "cli",
            "done",
            "Sem trabalho pendente",
            Some(plan.label),
        );
    } else if plan.skip_model {
        emit(
            progress,
            "cli",
            "done",
            "Sem modelo (ferramenta local)",
            Some(plan.label),
        );
    } else {
        emit(progress, "cli", "running", "Conectando ao assistente…", None);
        let (_p, bin) = match resolve_cli_bin(settings, provider) {
            Ok(v) => v,
            Err(cli_err) => {
                emit(
                    progress,
                    "cli",
                    "error",
                    "Não achei o Claude Code",
                    Some(&format!("{cli_err}")),
                );
                return Err(cli_err);
            }
        };
        emit(progress, "cli", "done", "Assistente pronto", Some(&bin));

        let effort = plan.effort;
        for (i, chunk) in chunks.iter().enumerate() {
            if job.map(|j| j.cancelled()).unwrap_or(false) {
                return Err(AppError::Message(crate::ai::cancel::CANCELLED_MSG.into()));
            }
            let n = i + 1;
            let catalog = achievements_to_catalog(chunk, &plan);
            let batch_note = if chunk_total > 1 {
                format!(
                    "\n\nLOTE {n}/{chunk_total}: há {} conquistas NESTE lote. Devolva patches\
                     para o máximo possível DESTAS (não só 5–10).\n",
                    chunk.len()
                )
            } else if full_pass {
                format!(
                    "\n\nHá {} conquistas no catálogo. Aplique patches a TODAS que puder.\n",
                    chunk.len()
                )
            } else {
                String::new()
            };
            let mut prompt = build_chat_prompt(game_name, app_id, &catalog, history, msg, &plan);
            if !batch_note.is_empty() {
                prompt.push_str(&batch_note);
            }

            let sample_titles: Vec<&str> = chunk
                .iter()
                .map(|a| a.title.as_str())
                .filter(|t| !is_generic_title(t))
                .take(3)
                .collect();
            let running_label = if chunk_total > 1 {
                format!("{} ({n}/{chunk_total})…", plan.label)
            } else {
                format!("{}…", plan.label)
            };
            let running_detail = if sample_titles.is_empty() {
                format!("{} conquistas", chunk.len())
            } else {
                format!("{} conquistas · {}", chunk.len(), sample_titles.join(" · "))
            };
            let step_id = if chunk_total > 1 {
                format!("model-{n}")
            } else {
                "model".to_string()
            };
            emit_event(
                progress,
                ChatProgressEvent {
                    id: step_id.clone(),
                    status: "running".into(),
                    label: running_label.clone(),
                    detail: Some(running_detail.clone()),
                    kind: Some("step".into()),
                    query: None,
                    sources: Vec::new(),
                },
            );

            let tick_label = running_label.clone();
            let tick_detail = running_detail.clone();
            let tick_id = step_id.clone();
            let stdout = match run_cli_with_options(
                &provider,
                &bin,
                &model,
                &prompt,
                api_key,
                CliRunOptions {
                    agentic: plan.agentic,
                    effort,
                },
                job,
                Some(&|secs: u64| {
                    if secs < 3 {
                        return;
                    }
                    let label = format!(
                        "{} · {}s",
                        tick_label.trim_end_matches(['…', '.']).trim_end(),
                        secs
                    );
                    emit(
                        progress,
                        tick_id.as_str(),
                        "running",
                        &label,
                        Some(tick_detail.as_str()),
                    );
                }),
            ) {
                Ok(s) => s,
                Err(e) => {
                    if crate::ai::cancel::is_cancelled_msg(&e.to_string()) {
                        return Err(e);
                    }
                    if i == 0 {
                        emit(
                            progress,
                            step_id.as_str(),
                            "error",
                            "Não consegui falar com o modelo",
                            Some(&format!("{e}")),
                        );
                        return Err(e);
                    }
                    emit(
                        progress,
                        step_id.as_str(),
                        "error",
                        &format!("Lote {n} falhou; uso o que já tiver"),
                        Some(&format!("{e}")),
                    );
                    continue;
                }
            };

            let (reply_part, patches_part) = extract_chat_object(&stdout)?;
            if !reply_part.trim().is_empty() {
                replies.push(reply_part);
            }
            all_patches.extend(patches_part);

            let done_label = if chunk_total > 1 {
                format!("Grupo {n}/{chunk_total} concluído")
            } else {
                format!("{} concluído", plan.label)
            };
            let done_detail = pt_count(all_patches.len(), "alteração", "alterações");
            emit(
                progress,
                step_id.as_str(),
                "done",
                done_label.as_str(),
                Some(done_detail.as_str()),
            );
        }
    }

    emit(progress, "parse", "running", "Organizando o que alterar…", None);
    let mut patches = merge_patches(all_patches);
    // Não despejar “Lote 1/5…” no chat — tools montam um resumo limpo depois
    let reply = if replies.is_empty() {
        String::new()
    } else if replies.len() == 1 {
        replies.remove(0)
    } else {
        replies
            .iter()
            .filter(|r| !r.trim().is_empty())
            .min_by_key(|r| r.chars().count())
            .cloned()
            .unwrap_or_default()
    };
    let considered = ordered.len();
    let parse_detail = if patches.is_empty() {
        None
    } else {
        Some(pt_count(patches.len(), "item", "itens"))
    };
    emit(
        progress,
        "parse",
        "done",
        if patches.is_empty() {
            "Só conversa, sem mudanças no guia"
        } else {
            "Montei as alterações"
        },
        parse_detail.as_deref(),
    );

    let needs_video_pass = plan.wants_videos()
        || patches.iter().any(|p| {
            p.get("videoUrl")
                .or_else(|| p.get("video_url"))
                .or_else(|| p.get("video"))
                .and_then(|v| v.as_str())
                .map(|u| !u.trim().is_empty())
                .unwrap_or(false)
        });
    let videos_resolved = if needs_video_pass {
        resolve_videos_in_patches(&mut patches, &achievements, game_name, msg, progress)
    } else {
        0
    };

    coerce_patch_scalars(&mut patches);
    let _levels = if plan.wants_levels() {
        fill_levels_from_local(&mut patches, &achievements, msg, progress)
    } else {
        0
    };
    if plan.primary == Tool::Levels {
        scrub_invented_level_patches(&mut patches, &achievements);
    }

    if !patches.is_empty() {
        emit(
            progress,
            "apply",
            "running",
            "Atualizando o guia…",
            None,
        );
    }
    let mut updated = 0usize;
    let mut videos_applied = 0usize;
    for patch in &patches {
        let api = patch
            .get("apiName")
            .or_else(|| patch.get("api_name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let title = patch
            .get("title")
            .or_else(|| patch.get("nome"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let has_video = patch
            .get("videoUrl")
            .or_else(|| patch.get("video_url"))
            .and_then(|v| v.as_str())
            .map(|u| is_real_video_url(u))
            .unwrap_or(false);

        let Some(target) = achievements.iter_mut().find(|a| {
            if let Some(ref api) = api {
                if a.api_name.as_deref() == Some(api.as_str()) {
                    return true;
                }
            }
            if let Some(ref t) = title {
                return a.title.eq_ignore_ascii_case(t);
            }
            false
        }) else {
            continue;
        };

        if apply_patch(target, patch) {
            materialize_tips_images(target, app_data, app_id);
            updated += 1;
            if has_video {
                videos_applied += 1;
            }
        }
    }
    if !patches.is_empty() {
        let apply_detail = if updated > 0 {
            Some(pt_count(updated, "conquista", "conquistas"))
        } else {
            None
        };
        emit(
            progress,
            "apply",
            "done",
            if updated > 0 {
                "Guia atualizado"
            } else {
                "Nada precisava mudar"
            },
            apply_detail.as_deref(),
        );
    }

    let videos = videos_applied.max(if plan.wants_videos() {
        videos_resolved.min(updated.max(videos_resolved))
    } else {
        videos_applied
    });

    let mut reply = polish_assistant_reply(&reply, updated, videos, plan.wants_videos());
    match plan.primary {
        Tool::Groups => {
            reply = summarize_groups_reply(&patches, updated, &reply);
        }
        Tool::Missable => {
            reply = summarize_missable_reply(&patches, &achievements, considered, &reply);
        }
        Tool::Difficulty => {
            reply = summarize_difficulty_reply(&patches, considered, &reply);
        }
        Tool::Levels if updated == 0 => {
            reply = "Não achei nível explícito nas descrições destas conquistas. Neste jogo isso costuma ficar vazio (sem inventar progressão típica).".into();
        }
        _ => {}
    }
    reply = sanitize_pt_dashes(&reply);
    if let Some(footer) =
        coverage_footer(&achievements, updated, videos, plan.primary, msg, full_pass)
    {
        reply = format!("{reply}\n\n{footer}");
    }

    Ok(ChatTurnResult {
        reply,
        updated,
        videos,
        provider: provider.as_str().into(),
        achievements,
    })
}
