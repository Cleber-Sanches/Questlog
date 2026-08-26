use crate::ai::settings::{provider_model, resolve_cli_bin, AiProvider, AiSettings};
use crate::steam::keys::{is_base_dlc, DLC_BASE};
use crate::db::repos::Achievement;
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichResult {
    pub updated: usize,
    pub considered: usize,
    pub provider: String,
    pub raw_preview: String,
    #[serde(skip)]
    pub achievements: Vec<Achievement>,
}

#[derive(Debug, Deserialize)]
struct AiPatch {
    #[serde(default, alias = "api_name", alias = "apiName")]
    api_name: Option<String>,
    #[serde(default, alias = "nome", alias = "displayName")]
    title: Option<String>,
    #[serde(default, alias = "grupo", alias = "category", alias = "categoria", alias = "group")]
    group: Option<String>,
    #[serde(default, alias = "groupEn", alias = "group_en", alias = "grupoEn")]
    group_en: Option<String>,
    #[serde(default)]
    dlc: Option<String>,
    #[serde(
        default,
        alias = "dicas",
        alias = "comoDesbloquear",
        alias = "howTo",
        alias = "howto",
        alias = "tips"
    )]
    tips: Option<String>,
    #[serde(
        default,
        alias = "guideUrl",
        alias = "linkGuia",
        alias = "guia",
        alias = "guide"
    )]
    guide_url: Option<String>,
    #[serde(default, alias = "videoUrl", alias = "linkVideo", alias = "video")]
    video_url: Option<String>,
    #[serde(default, alias = "dificuldade", alias = "diff")]
    difficulty: Option<String>,
    #[serde(default)]
    missable: Option<bool>,
    #[serde(
        default,
        alias = "reqLevel",
        alias = "nivel",
        alias = "nível",
        deserialize_with = "deserialize_opt_stringish"
    )]
    req_level: Option<String>,
}

/// Aceita `"20"`, `20` ou `20.0` (o modelo costuma mandar número e o patch morria no parse).
fn deserialize_opt_stringish<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let v = Option::<Value>::deserialize(deserializer)?;
    Ok(match v {
        None | Some(Value::Null) => None,
        Some(Value::String(s)) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
        Some(Value::Number(n)) => Some(n.to_string()),
        Some(other) => {
            let s = other.to_string().trim_matches('"').trim().to_string();
            if s.is_empty() || s == "null" {
                None
            } else {
                Some(s)
            }
        }
    })
}

fn needs_enrichment(a: &Achievement) -> bool {
    let tips_empty = a.tips.as_deref().unwrap_or("").trim().is_empty();
    let guide_empty = a.guide_url.as_deref().unwrap_or("").trim().is_empty();
    let video_empty = a.video_url.as_deref().unwrap_or("").trim().is_empty();
    tips_empty || guide_empty || video_empty
}

fn build_prompt(game_name: &str, app_id: &str, items: &[Value]) -> String {
    format!(
        r#"Você está enriquecendo um guia local de conquistas Steam.

Jogo: {game_name}
AppID: {app_id}

Receba a lista JSON de conquistas (já existentes no app). Para CADA item, devolva um overlay
com dicas práticas em português (pt-BR), links úteis e metadados.

Regras:
- Identifique por apiName (obrigatório).
- Preencha só o que fizer sentido: group, tips, guideUrl, videoUrl, difficulty (easy|medium|hard), missable, reqLevel, dlc.
- tips: como desbloquear; HTML leve (p, ul, li, strong) e <img src="https://url-direta-da-imagem"> se ajudar.
  O app baixa as imagens e salva localmente. Sem data/base64.
- guideUrl: URL http(s) de guia confiável (Steam Guide, wiki, PowerPyx, etc.) ou omita.
- videoUrl: URL de um vídeo único do YouTube (watch?v=) ou Vimeo. Nunca use /results nem search_query. Se não souber o vídeo real, omita.
- difficulty: easy|medium|hard quando souber.
- missable: true se for perdível.
- reqLevel: texto tipo "20" ou "15-50" se aplicável.
- NÃO invente apiName. NÃO altere progresso/completed.
- Responda APENAS com um JSON array válido, sem markdown, sem comentários.

Conquistas:
{items}
"#,
        items = serde_json::to_string_pretty(items).unwrap_or_else(|_| "[]".into())
    )
}

pub(crate) fn extract_json_array(text: &str) -> AppResult<Vec<Value>> {
    let trimmed = text.trim();
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        if let Some(arr) = v.as_array() {
            return Ok(arr.clone());
        }
        if let Some(arr) = v.get("achievements").and_then(|x| x.as_array()) {
            return Ok(arr.clone());
        }
        if let Some(arr) = v.get("items").and_then(|x| x.as_array()) {
            return Ok(arr.clone());
        }
    }

    if let Some(start) = trimmed.find('[') {
        if let Some(end) = trimmed.rfind(']') {
            if end > start {
                let slice = &trimmed[start..=end];
                if let Ok(arr) = serde_json::from_str::<Vec<Value>>(slice) {
                    return Ok(arr);
                }
            }
        }
    }

    if let Some(fence) = trimmed.find("```") {
        let after = &trimmed[fence + 3..];
        let body = after.strip_prefix("json").unwrap_or(after).trim_start();
        if let Some(close) = body.find("```") {
            let inner = body[..close].trim();
            if let Ok(arr) = serde_json::from_str::<Vec<Value>>(inner) {
                return Ok(arr);
            }
        }
    }

    Err(AppError::Message(
        "A IA não retornou um JSON array válido. Tente de novo ou revise o modelo/CLI.".into(),
    ))
}

pub(crate) fn run_cli(
    provider: &AiProvider,
    bin: &str,
    model: &str,
    prompt: &str,
    api_key: &str,
) -> AppResult<String> {
    run_cli_with_options(
        provider,
        bin,
        model,
        prompt,
        api_key,
        CliRunOptions::default(),
        None,
        None,
    )
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct CliRunOptions {
    /// Permite WebSearch/WebFetch e roda sem pedir confirmação (estilo Claude Code).
    pub agentic: bool,
    /// low | medium | high — só Claude Code
    pub effort: &'static str,
}

impl Default for CliRunOptions {
    fn default() -> Self {
        Self {
            agentic: false,
            effort: "medium",
        }
    }
}

pub(crate) fn run_cli_with_options(
    provider: &AiProvider,
    bin: &str,
    model: &str,
    prompt: &str,
    api_key: &str,
    opts: CliRunOptions,
    job: Option<&crate::ai::cancel::AiJobControl>,
    on_tick: Option<&dyn Fn(u64)>,
) -> AppResult<String> {
    use crate::ai::cli::run_cli_with_prompt_file_job_tick;

    let mut args: Vec<String> = Vec::new();
    match provider {
        AiProvider::ClaudeCode => {
            args.push("-p".into());
            args.push("--output-format".into());
            args.push("text".into());
            if !model.trim().is_empty() {
                args.push("--model".into());
                args.push(model.trim().into());
            }
            if opts.agentic {
                // Como no Claude Code interativo: pesquisa web, sem Bash/Edit no PC do usuário.
                args.push("--tools".into());
                args.push("WebSearch,WebFetch".into());
                args.push("--allowedTools".into());
                args.push("WebSearch,WebFetch".into());
                args.push("--permission-mode".into());
                args.push("dontAsk".into());
                args.push("--effort".into());
                args.push(opts.effort.into());
                // Evita reaproveitar sessão antiga cheia de contexto de código
                args.push("--no-session-persistence".into());
            }
        }
        AiProvider::Opencode => {
            args.push("run".into());
            if !model.trim().is_empty() {
                args.push("--model".into());
                args.push(model.trim().into());
            }
        }
    }

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let (code, stdout, stderr) =
        run_cli_with_prompt_file_job_tick(bin, &arg_refs, prompt, api_key, job, on_tick)
            .map_err(AppError::Message)?;

    if code != 0 && stdout.trim().is_empty() {
        let detail = if stderr.trim().is_empty() {
            format!("exit {code}")
        } else {
            stderr.chars().take(500).collect()
        };
        return Err(AppError::Message(format!("CLI {bin} falhou: {detail}")));
    }

    if stdout.trim().is_empty() {
        return Err(AppError::Message(
            "CLI retornou saída vazia. Confirme a autenticação (Conectar) nas Configurações."
                .into(),
        ));
    }

    Ok(stdout)
}

fn run_anthropic_api(api_key: &str, model: &str, prompt: &str) -> AppResult<String> {
    use crate::steam::paths::http_client;

    let model = if model.trim().is_empty() {
        "claude-sonnet-4-20250514"
    } else {
        model.trim()
    };

    let body = json!({
        "model": model,
        "max_tokens": 8192,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    });

    let client = http_client()?;
    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.trim())
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| AppError::Message(format!("Falha Anthropic API: {e}")))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().unwrap_or_default();
        let snippet: String = text.chars().take(300).collect();
        return Err(AppError::Message(format!(
            "Anthropic API {status}: {snippet}"
        )));
    }

    let data: Value = res
        .json()
        .map_err(|e| AppError::Message(format!("JSON Anthropic inválido: {e}")))?;

    let mut out = String::new();
    if let Some(arr) = data.get("content").and_then(|v| v.as_array()) {
        for block in arr {
            if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                    out.push_str(t);
                }
            }
        }
    }
    if out.trim().is_empty() {
        return Err(AppError::Message(
            "Anthropic retornou resposta sem texto.".into(),
        ));
    }
    Ok(out)
}

fn normalize_url(value: &str) -> String {
    let raw = value.trim();
    if raw.is_empty() {
        return String::new();
    }
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    }
}

pub(crate) fn apply_patch(target: &mut Achievement, raw: &Value) -> bool {
    let Ok(patch) = serde_json::from_value::<AiPatch>(raw.clone()) else {
        return false;
    };

    let mut changed = false;

    if let Some(v) = patch.group {
        let v = v.trim().to_string();
        if !v.is_empty() && target.group.as_deref() != Some(v.as_str()) {
            target.group = Some(v);
            changed = true;
        }
    }

    if let Some(v) = patch.group_en {
        let v = v.trim().to_string();
        if !v.is_empty() && target.group_en.as_deref() != Some(v.as_str()) {
            target.group_en = Some(v);
            changed = true;
        }
    }

    if let Some(v) = patch.dlc {
        let normalized = if is_base_dlc(&v) {
            DLC_BASE.to_string()
        } else {
            v.trim().to_string()
        };
        if !normalized.is_empty() && target.dlc.as_deref() != Some(normalized.as_str()) {
            target.dlc = Some(normalized);
            changed = true;
        }
    }

    if let Some(v) = patch.tips {
        let v = v.trim().to_string();
        if !v.is_empty() && target.tips.as_deref() != Some(v.as_str()) {
            target.tips = Some(v);
            changed = true;
        }
    }

    if let Some(v) = patch.guide_url {
        let v = normalize_url(&v);
        if !v.is_empty() && target.guide_url.as_deref() != Some(v.as_str()) {
            target.guide_url = Some(v);
            changed = true;
        }
    }

    if let Some(v) = patch.video_url {
        let v = normalize_url(&v);
        // Não grava página de pesquisa; só video watch/vimeo embutível
        if !v.is_empty()
            && !crate::ai::youtube::is_youtube_search_url(&v)
            && crate::ai::youtube::is_real_video_url(&v)
            && target.video_url.as_deref() != Some(v.as_str())
        {
            let final_url = crate::ai::youtube::extract_watch_url(&v).unwrap_or(v);
            target.video_url = Some(final_url);
            changed = true;
        }
    }

    if let Some(v) = patch.difficulty {
        let v = v.trim().to_ascii_lowercase();
        if matches!(v.as_str(), "easy" | "medium" | "hard")
            && target.difficulty.as_deref() != Some(v.as_str())
        {
            target.difficulty = Some(v);
            changed = true;
        }
    }

    if let Some(m) = patch.missable {
        if target.missable != m {
            target.missable = m;
            changed = true;
        }
    }

    if let Some(v) = patch.req_level {
        let v = v.trim().to_string();
        if !v.is_empty() && target.req_level.as_deref() != Some(v.as_str()) {
            target.req_level = Some(v);
            changed = true;
        }
    }

    let _ = (patch.api_name, patch.title);
    changed
}

/// Baixa imagens remotas em `tips` (HTML) e grava chaves `guia-media:…`.
pub fn materialize_tips_images(target: &mut Achievement, app_data: &std::path::Path, app_id: &str) {
    let Some(tips) = target.tips.as_ref() else {
        return;
    };
    if !(tips.contains("http://") || tips.contains("https://")) {
        return;
    }
    let next = crate::commands::media::materialize_html_images(app_data, app_id, tips);
    if next != *tips {
        target.tips = Some(next);
    }
}

pub fn enrich_guide_with_data(
    settings: &AiSettings,
    provider: AiProvider,
    app_id: &str,
    game_name: &str,
    mut achievements: Vec<Achievement>,
    only_missing: bool,
    limit: usize,
    api_key: &str,
    app_data: &std::path::Path,
) -> AppResult<EnrichResult> {
    let provider = provider;

    let considered_idxs: Vec<usize> = achievements
        .iter()
        .enumerate()
        .filter(|(_, a)| !only_missing || needs_enrichment(a))
        .map(|(i, _)| i)
        .take(limit.max(1))
        .collect();

    if considered_idxs.is_empty() {
        return Ok(EnrichResult {
            updated: 0,
            considered: 0,
            provider: provider.as_str().into(),
            raw_preview: "Nada a enriquecer (tudo já preenchido).".into(),
            achievements,
        });
    }

    let payload: Vec<Value> = considered_idxs
        .iter()
        .map(|&i| {
            let a = &achievements[i];
            json!({
                "apiName": a.api_name,
                "title": a.title,
                "description": a.description,
                "group": a.group,
                "dlc": a.dlc,
                "tips": a.tips,
                "guideUrl": a.guide_url,
                "videoUrl": a.video_url,
                "difficulty": a.difficulty,
                "missable": a.missable,
                "reqLevel": a.req_level,
            })
        })
        .collect();

    let considered = payload.len();
    let prompt = build_prompt(game_name, app_id, &payload);

    // Claude Code: prioriza CLI autenticado; API key só como fallback.
    let stdout = match resolve_cli_bin(settings, provider) {
        Ok((_p, bin)) => run_cli(&provider, &bin, &provider_model(settings, provider), &prompt, api_key)?,
        Err(cli_err) => {
            if provider == AiProvider::ClaudeCode && !api_key.trim().is_empty() {
                run_anthropic_api(api_key, &provider_model(settings, provider), &prompt)?
            } else {
                return Err(cli_err);
            }
        }
    };

    let patches = extract_json_array(&stdout)?;

    let mut updated = 0usize;
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
        }
    }

    let preview: String = stdout.chars().take(280).collect();
    Ok(EnrichResult {
        updated,
        considered,
        provider: provider.as_str().into(),
        raw_preview: preview,
        achievements,
    })
}
