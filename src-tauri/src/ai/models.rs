use crate::ai::cli::{apply_no_window, build_cli_command, null_stdio};
use crate::ai::settings::{
    resolve_api_key, resolve_cli_bin, AiProvider, AiSettings,
};
use crate::error::{AppError, AppResult};
use crate::steam::paths::http_client;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelItem {
    pub id: String,
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelsResult {
    pub models: Vec<AiModelItem>,
    pub source: String,
}

fn run_cli_capture(bin: &str, args: &[&str]) -> AppResult<(i32, String, String)> {
    let mut cmd = build_cli_command(bin, args);
    null_stdio(&mut cmd);
    apply_no_window(&mut cmd);

    let output = cmd
        .output()
        .map_err(|e| AppError::Message(format!("Falha ao executar {bin}: {e}")))?;
    let code = output.status.code().unwrap_or(1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok((code, stdout, stderr))
}

fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' {
            if chars.next_if(|&c| c == '[').is_some() {
                while let Some(c) = chars.next() {
                    if c.is_ascii_alphabetic() || c == '@' {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(ch);
    }
    out
}

fn title_case_token(token: &str) -> String {
    let mut chars = token.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn label_from_model_id(id: &str) -> String {
    let model_part = id.split('/').nth(1).unwrap_or(id);
    model_part
        .split(['-', '_'])
        .filter(|part| !part.is_empty())
        .map(title_case_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn extract_json_object(lines: &[&str], start: usize) -> Option<(String, usize)> {
    if start >= lines.len() || !lines[start].trim_start().starts_with('{') {
        return None;
    }
    let mut depth = 0i32;
    let mut json_buf = String::new();
    let mut i = start;
    while i < lines.len() {
        let line = lines[i];
        for ch in line.chars() {
            match ch {
                '{' => depth += 1,
                '}' => depth -= 1,
                _ => {}
            }
        }
        json_buf.push_str(line);
        json_buf.push('\n');
        i += 1;
        if depth <= 0 {
            return Some((json_buf, i));
        }
    }
    None
}

fn is_opencode_free_model(item: &AiModelItem, cost_free: bool) -> bool {
    if cost_free {
        return true;
    }
    let id = item.id.to_ascii_lowercase();
    let provider = item.provider.to_ascii_lowercase();
    provider == "opencode"
        || id.contains("-free")
        || id.ends_with("/free")
        || item.name.to_ascii_lowercase().contains("free")
}

fn is_anthropic_or_claude(item: &AiModelItem) -> bool {
    let provider = item.provider.to_ascii_lowercase();
    let id = item.id.to_ascii_lowercase();
    provider == "anthropic" || id.contains("claude") || id.starts_with("anthropic/")
}

fn parse_opencode_models_verbose(raw: &str) -> Vec<AiModelItem> {
    let text = strip_ansi(raw);
    let mut models = Vec::new();
    let lines: Vec<&str> = text.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();
        if line.is_empty() || !line.contains('/') {
            i += 1;
            continue;
        }

        let id = line.to_string();
        i += 1;

        if let Some((json_buf, next)) = extract_json_object(&lines, i) {
            i = next;
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json_buf) {
                let fallback_name = label_from_model_id(&id);
                let name = value
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(str::trim)
                    .filter(|v| !v.is_empty())
                    .unwrap_or(fallback_name.as_str())
                    .to_string();
                let provider = value
                    .get("providerID")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
                    .unwrap_or_else(|| {
                        id.split('/')
                            .next()
                            .unwrap_or("opencode")
                            .to_string()
                    });
                let cost_free = value
                    .pointer("/cost/input")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0)
                    == 0.0
                    && value
                        .pointer("/cost/output")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(1.0)
                        == 0.0;

                let item = AiModelItem {
                    id,
                    name,
                    provider,
                };
                if !is_anthropic_or_claude(&item) && is_opencode_free_model(&item, cost_free) {
                    models.push(item);
                }
                continue;
            }
        }

        let item = AiModelItem {
            id: id.clone(),
            name: label_from_model_id(&id),
            provider: id.split('/').next().unwrap_or("opencode").to_string(),
        };
        if !is_anthropic_or_claude(&item) && is_opencode_free_model(&item, false) {
            models.push(item);
        }
    }

    models
}

fn parse_opencode_models_plain(raw: &str) -> Vec<AiModelItem> {
    strip_ansi(raw)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && line.contains('/'))
        .map(|line| AiModelItem {
            id: line.to_string(),
            name: label_from_model_id(line),
            provider: line.split('/').next().unwrap_or("opencode").to_string(),
        })
        .filter(|item| !is_anthropic_or_claude(item) && is_opencode_free_model(item, false))
        .collect()
}

fn list_opencode_models(settings: &AiSettings) -> AppResult<AiModelsResult> {
    let (_provider, bin) = resolve_cli_bin(settings, AiProvider::Opencode)?;
    let (code, stdout, stderr) = run_cli_capture(&bin, &["models", "--verbose"])?;
    let text = if !stdout.trim().is_empty() {
        stdout
    } else {
        stderr
    };

    if code != 0 && text.trim().is_empty() {
        return Err(AppError::Message(format!(
            "OpenCode não retornou modelos (exit {code})."
        )));
    }

    let mut models = parse_opencode_models_verbose(&text);
    if models.is_empty() {
        let (plain_code, plain_out, plain_err) = run_cli_capture(&bin, &["models"])?;
        let plain_text = if !plain_out.trim().is_empty() {
            plain_out
        } else {
            plain_err
        };
        if plain_code != 0 && plain_text.trim().is_empty() {
            return Err(AppError::Message(
                "Não foi possível listar modelos do OpenCode.".into(),
            ));
        }
        models = parse_opencode_models_plain(&plain_text);
    }

    if models.is_empty() {
        return Err(AppError::Message(
            "OpenCode não retornou modelos gratuitos.".into(),
        ));
    }

    Ok(AiModelsResult {
        models,
        source: "cli".into(),
    })
}

#[derive(Debug, Deserialize)]
struct AnthropicModelsResponse {
    data: Vec<AnthropicModelEntry>,
}

#[derive(Debug, Deserialize)]
struct AnthropicModelEntry {
    id: String,
    display_name: Option<String>,
}

fn fetch_anthropic_models(api_key: &str) -> AppResult<Vec<AiModelItem>> {
    let client = http_client()?;
    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .map_err(|e| AppError::Message(format!("Falha ao contactar Anthropic: {e}")))?;

    if !res.status().is_success() {
        return Err(AppError::Message(format!(
            "Anthropic recusou listar modelos ({})",
            res.status()
        )));
    }

    let body: AnthropicModelsResponse = res
        .json()
        .map_err(|e| AppError::Message(format!("Resposta inválida da Anthropic: {e}")))?;

    let models: Vec<AiModelItem> = body
        .data
        .into_iter()
        .map(|entry| {
            let name = entry
                .display_name
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| label_from_model_id(&entry.id));
            AiModelItem {
                id: entry.id.clone(),
                name,
                provider: "anthropic".into(),
            }
        })
        .collect();

    if models.is_empty() {
        return Err(AppError::Message(
            "Anthropic não retornou modelos disponíveis.".into(),
        ));
    }

    Ok(models)
}

fn claude_alias_models() -> Vec<AiModelItem> {
    // Aliases do Claude Code (`--model sonnet`) sempre apontam para a versão atual.
    // Labels curtos: o provedor já diz "Claude Code".
    [
        ("sonnet", "Sonnet 5"),
        ("opus", "Opus 5"),
        ("haiku", "Haiku 4.5"),
        ("fable", "Fable 5"),
    ]
    .into_iter()
    .map(|(id, name)| AiModelItem {
        id: id.into(),
        name: name.into(),
        provider: "anthropic".into(),
    })
    .collect()
}

fn list_claude_models(settings: &AiSettings, conn: &Connection) -> AppResult<AiModelsResult> {
    let api_key = resolve_api_key(conn, settings).unwrap_or_default();
    if !api_key.trim().is_empty() {
        if let Ok(models) = fetch_anthropic_models(api_key.trim()) {
            return Ok(AiModelsResult {
                models,
                source: "api".into(),
            });
        }
    }

    let _ = resolve_cli_bin(settings, AiProvider::ClaudeCode);

    Ok(AiModelsResult {
        models: claude_alias_models(),
        source: "cli-aliases".into(),
    })
}

pub fn list_provider_models(
    settings: &AiSettings,
    conn: &Connection,
    provider: AiProvider,
) -> AppResult<AiModelsResult> {
    match provider {
        AiProvider::Opencode => list_opencode_models(settings),
        AiProvider::ClaudeCode => list_claude_models(settings, conn),
    }
}
