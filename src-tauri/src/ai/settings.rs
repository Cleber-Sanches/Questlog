use crate::ai::cli::{
    apply_new_console, apply_no_window, build_cli_command, normalize_cli_bin, null_stdio,
};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::steam::paths::http_client;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AiProvider {
    ClaudeCode,
    Opencode,
}

impl AiProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude-code",
            Self::Opencode => "opencode",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "claude-code" | "claude" | "claude_code" => Some(Self::ClaudeCode),
            "opencode" | "open-code" | "open_code" => Some(Self::Opencode),
            _ => None,
        }
    }

    pub fn default_bin(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude",
            Self::Opencode => "opencode",
        }
    }

    pub fn all() -> [Self; 2] {
        [Self::ClaudeCode, Self::Opencode]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub cli_path: String,
    pub model: String,
    pub connected: bool,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

impl Default for AiProviderConfig {
    fn default() -> Self {
        Self {
            cli_path: String::new(),
            model: String::new(),
            connected: false,
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AiProvidersConfig {
    #[serde(rename = "claude-code", default)]
    pub claude_code: AiProviderConfig,
    #[serde(default)]
    pub opencode: AiProviderConfig,
}

impl AiProvidersConfig {
    pub fn get(&self, provider: AiProvider) -> &AiProviderConfig {
        match provider {
            AiProvider::ClaudeCode => &self.claude_code,
            AiProvider::Opencode => &self.opencode,
        }
    }

    pub fn get_mut(&mut self, provider: AiProvider) -> &mut AiProviderConfig {
        match provider {
            AiProvider::ClaudeCode => &mut self.claude_code,
            AiProvider::Opencode => &mut self.opencode,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub enabled: bool,
    pub active_provider: Option<AiProvider>,
    pub providers: AiProvidersConfig,
    /// Só preenchido no save; no get sempre vem vazio.
    #[serde(default)]
    pub api_key: String,
    /// true se já existe chave salva no SQLite.
    #[serde(default)]
    pub has_api_key: bool,
    /// Se true no save, apaga a chave salva.
    #[serde(default)]
    pub clear_api_key: bool,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            active_provider: None,
            providers: AiProvidersConfig::default(),
            api_key: String::new(),
            has_api_key: false,
            clear_api_key: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDetectResult {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAuthResult {
    pub ok: bool,
    pub mode: String,
    pub detail: String,
}

fn stored_api_key(conn: &Connection) -> AppResult<String> {
    Ok(repos::get_setting(conn, "ai_api_key")?.unwrap_or_default())
}

fn migrate_legacy_providers(conn: &Connection) -> AppResult<AiProvidersConfig> {
    let mut providers = AiProvidersConfig::default();
    let legacy_provider = repos::get_setting(conn, "ai_provider")?
        .as_deref()
        .and_then(AiProvider::parse);
    let cli_path = repos::get_setting(conn, "ai_cli_path")?.unwrap_or_default();
    let model = repos::get_setting(conn, "ai_model")?.unwrap_or_default();

    if let Some(p) = legacy_provider {
        let cfg = providers.get_mut(p);
        cfg.cli_path = normalize_cli_bin(&cli_path);
        cfg.model = model.trim().to_string();
        cfg.connected = !cfg.cli_path.is_empty() || !cfg.model.is_empty();
        cfg.enabled = true;
    }

    Ok(providers)
}

fn read_providers(conn: &Connection) -> AppResult<AiProvidersConfig> {
    if let Some(raw) = repos::get_setting(conn, "ai_providers_json")? {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return serde_json::from_str(trimmed)
                .map_err(|e| AppError::Message(format!("Configuração de IA inválida: {e}")));
        }
    }
    migrate_legacy_providers(conn)
}

pub fn get_ai_settings(conn: &Connection) -> AppResult<AiSettings> {
    let enabled = repos::get_setting(conn, "ai_enabled")?
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let active_provider = repos::get_setting(conn, "ai_active_provider")?
        .as_deref()
        .and_then(AiProvider::parse);
    let providers = read_providers(conn)?;
    let key = stored_api_key(conn)?;
    Ok(AiSettings {
        enabled,
        active_provider,
        providers,
        api_key: String::new(),
        has_api_key: !key.trim().is_empty(),
        clear_api_key: false,
    })
}

pub fn save_ai_settings(conn: &Connection, settings: &AiSettings) -> AppResult<()> {
    repos::set_setting(conn, "ai_enabled", if settings.enabled { "1" } else { "0" })?;
    repos::set_setting(
        conn,
        "ai_active_provider",
        settings
            .active_provider
            .as_ref()
            .map(|p| p.as_str())
            .unwrap_or(""),
    )?;
    let json = serde_json::to_string(&settings.providers)
        .map_err(|e| AppError::Message(format!("Falha ao serializar IA: {e}")))?;
    repos::set_setting(conn, "ai_providers_json", &json)?;

    if settings.clear_api_key {
        repos::set_setting(conn, "ai_api_key", "")?;
    } else {
        let incoming = settings.api_key.trim();
        if !incoming.is_empty() {
            repos::set_setting(conn, "ai_api_key", incoming)?;
        }
    }
    Ok(())
}

pub fn resolve_api_key(conn: &Connection, settings: &AiSettings) -> AppResult<String> {
    let incoming = settings.api_key.trim();
    if !incoming.is_empty() {
        return Ok(incoming.to_string());
    }
    Ok(stored_api_key(conn)?.trim().to_string())
}

pub fn effective_provider(
    settings: &AiSettings,
    override_provider: Option<AiProvider>,
) -> AppResult<AiProvider> {
    if let Some(p) = override_provider {
        return Ok(p);
    }
    if let Some(p) = settings.active_provider {
        return Ok(p);
    }
    for p in AiProvider::all() {
        let cfg = settings.providers.get(p);
        if cfg.connected && cfg.enabled {
            return Ok(p);
        }
    }
    Err(AppError::Message(
        "Conecte um provedor de IA nas Configurações.".into(),
    ))
}

pub fn provider_cli_path(settings: &AiSettings, provider: AiProvider) -> String {
    normalize_cli_bin(settings.providers.get(provider).cli_path.trim())
}

pub fn provider_model(settings: &AiSettings, provider: AiProvider) -> String {
    settings.providers.get(provider).model.trim().to_string()
}

fn try_run_version(bin: &str) -> Option<(String, String)> {
    let mut cmd = build_cli_command(bin, &["--version"]);
    null_stdio(&mut cmd);
    apply_no_window(&mut cmd);
    let output = cmd.output().ok()?;
    if !output.status.success() && output.stdout.is_empty() && output.stderr.is_empty() {
        return None;
    }
    let text = if !output.stdout.is_empty() {
        String::from_utf8_lossy(&output.stdout)
    } else {
        String::from_utf8_lossy(&output.stderr)
    };
    let version = text.lines().next().unwrap_or("").trim().to_string();
    let path = normalize_cli_bin(bin);
    if version.is_empty() {
        Some((path, "ok".into()))
    } else {
        Some((path, version))
    }
}

pub fn detect_provider(provider: AiProvider, cli_path: &str) -> AiDetectResult {
    let candidates: Vec<String> = {
        let mut list = Vec::new();
        let custom = normalize_cli_bin(cli_path.trim());
        if !custom.is_empty() {
            list.push(custom);
        }
        list.push(provider.default_bin().to_string());
        if cfg!(windows) {
            match provider {
                AiProvider::ClaudeCode => {
                    list.push("claude.exe".into());
                    list.push("claude.cmd".into());
                }
                AiProvider::Opencode => {
                    list.push("opencode.exe".into());
                    list.push("opencode.cmd".into());
                }
            }
        }
        list
    };

    for bin in candidates {
        if let Some((path, version)) = try_run_version(&bin) {
            return AiDetectResult {
                found: true,
                path: Some(path),
                version: Some(version),
                error: None,
            };
        }
    }

    AiDetectResult {
        found: false,
        path: None,
        version: None,
        error: Some(format!(
            "Não encontrei o CLI de {}. Instale e/ou informe o caminho completo.",
            provider.as_str()
        )),
    }
}

pub fn resolve_cli_bin(settings: &AiSettings, provider: AiProvider) -> AppResult<(AiProvider, String)> {
    let cli_path = provider_cli_path(settings, provider);
    let detect = detect_provider(provider, &cli_path);
    if !detect.found {
        return Err(AppError::Message(
            detect
                .error
                .unwrap_or_else(|| "CLI de IA não encontrado.".into()),
        ));
    }
    let bin = detect
        .path
        .unwrap_or_else(|| provider.default_bin().into());
    Ok((provider, normalize_cli_bin(&bin)))
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

/// Verifica login do Claude Code CLI (`claude auth status`).
pub fn check_claude_cli_auth(settings: &AiSettings, provider: AiProvider) -> AppResult<AiAuthResult> {
    let (_provider, bin) = resolve_cli_bin(settings, provider)?;
    let (code, stdout, stderr) = run_cli_capture(&bin, &["auth", "status"])?;
    let text = if !stdout.trim().is_empty() {
        stdout
    } else {
        stderr
    };

    if code == 0 {
        let detail =
            parse_claude_auth_detail(&text).unwrap_or_else(|| "Claude Code conectado.".into());
        return Ok(AiAuthResult {
            ok: true,
            mode: "cli".into(),
            detail,
        });
    }

    let snippet: String = text.chars().take(200).collect();
    Ok(AiAuthResult {
        ok: false,
        mode: "cli".into(),
        detail: if snippet.trim().is_empty() {
            "Claude Code não está logado. Clique em Conectar.".into()
        } else {
            format!("Não conectado: {snippet}")
        },
    })
}

fn parse_claude_auth_detail(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
        let email = v
            .pointer("/account/email")
            .or_else(|| v.get("email"))
            .and_then(|x| x.as_str());
        let org = v
            .pointer("/account/organization")
            .or_else(|| v.get("organization"))
            .and_then(|x| x.as_str());
        let sub = v
            .get("subscriptionType")
            .or_else(|| v.get("subscription"))
            .and_then(|x| x.as_str());
        let mut parts = Vec::new();
        if let Some(e) = email {
            parts.push(e.to_string());
        }
        if let Some(o) = org {
            parts.push(o.to_string());
        }
        if let Some(s) = sub {
            parts.push(s.to_string());
        }
        if !parts.is_empty() {
            return Some(format!("Conectado · {}", parts.join(" · ")));
        }
        return Some("Claude Code conectado.".into());
    }
    let line = trimmed.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

/// Abre o login do Claude Code numa consola nova (`claude auth login`).
pub fn start_claude_cli_login(settings: &AiSettings, provider: AiProvider) -> AppResult<AiAuthResult> {
    let (_provider, bin) = resolve_cli_bin(settings, provider)?;

    let mut cmd = build_cli_command(&bin, &["auth", "login"]);
    cmd.stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());
    apply_new_console(&mut cmd);

    cmd.spawn()
        .map_err(|e| AppError::Message(format!("Falha ao abrir login ({bin}): {e}")))?;

    Ok(AiAuthResult {
        ok: true,
        mode: "cli-login".into(),
        detail: "Login aberto no terminal. Depois de autenticar, clique em Verificar.".into(),
    })
}

/// Valida a API key Anthropic (opcional / fallback).
#[allow(dead_code)]
pub fn test_claude_api_key(api_key: &str) -> AppResult<AiAuthResult> {
    let key = api_key.trim();
    if key.is_empty() {
        return Ok(AiAuthResult {
            ok: false,
            mode: "api-key".into(),
            detail: "Informe a Anthropic API key.".into(),
        });
    }
    if !(key.starts_with("sk-ant-") || key.starts_with("sk-")) {
        return Ok(AiAuthResult {
            ok: false,
            mode: "api-key".into(),
            detail: "A chave não parece uma Anthropic API key (sk-ant-…).".into(),
        });
    }

    let client = http_client()?;
    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .map_err(|e| AppError::Message(format!("Falha ao contactar Anthropic: {e}")))?;

    if res.status().is_success() {
        return Ok(AiAuthResult {
            ok: true,
            mode: "api-key".into(),
            detail: "Anthropic API key válida.".into(),
        });
    }

    let status = res.status();
    let body = res.text().unwrap_or_default();
    let snippet: String = body.chars().take(180).collect();
    Ok(AiAuthResult {
        ok: false,
        mode: "api-key".into(),
        detail: format!("Anthropic recusou a chave ({status}): {snippet}"),
    })
}
