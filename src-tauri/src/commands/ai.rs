use crate::ai::{
    chat_turn, check_claude_cli_auth, detect_provider, effective_provider, enrich_guide_with_data,
    get_ai_settings, list_provider_models, provider_cli_path, resolve_api_key, save_ai_settings,
    start_claude_cli_login, AiAuthResult, AiDetectResult, AiModelsResult, AiProvider, AiSettings,
    ChatMessage, ChatTurnResult, EnrichResult,
};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use std::sync::Arc;

#[tauri::command]
pub fn ai_get_settings(state: tauri::State<'_, Arc<AppState>>) -> AppResult<AiSettings> {
    let conn = state.db.lock();
    get_ai_settings(&conn)
}

#[tauri::command]
pub fn ai_save_settings(
    state: tauri::State<'_, Arc<AppState>>,
    settings: AiSettings,
) -> AppResult<AiSettings> {
    let conn = state.db.lock();
    save_ai_settings(&conn, &settings)?;
    get_ai_settings(&conn)
}

#[tauri::command]
pub fn ai_detect_cli(provider: String, cli_path: Option<String>) -> AppResult<AiDetectResult> {
    let provider = AiProvider::parse(&provider)
        .ok_or_else(|| AppError::Message("Provedor inválido.".into()))?;
    Ok(detect_provider(
        provider,
        cli_path.as_deref().unwrap_or(""),
    ))
}

fn with_provider_cli(
    mut settings: AiSettings,
    provider: AiProvider,
    cli_path: Option<String>,
) -> AiSettings {
    if let Some(path) = cli_path {
        if !path.trim().is_empty() {
            settings.providers.get_mut(provider).cli_path = path;
        }
    }
    settings
}

#[tauri::command]
pub fn ai_test_auth(
    state: tauri::State<'_, Arc<AppState>>,
    provider: String,
    cli_path: Option<String>,
) -> AppResult<AiAuthResult> {
    let provider = AiProvider::parse(&provider)
        .ok_or_else(|| AppError::Message("Provedor inválido.".into()))?;
    let conn = state.db.lock();
    let settings = with_provider_cli(get_ai_settings(&conn)?, provider, cli_path);
    drop(conn);

    match provider {
        AiProvider::ClaudeCode => check_claude_cli_auth(&settings, provider),
        AiProvider::Opencode => {
            let detect = detect_provider(provider, &provider_cli_path(&settings, provider));
            Ok(AiAuthResult {
                ok: detect.found,
                mode: "cli".into(),
                detail: if detect.found {
                    format!(
                        "OpenCode detectado{}.",
                        detect
                            .path
                            .map(|p| format!(" em {p}"))
                            .unwrap_or_default()
                    )
                } else {
                    detect
                        .error
                        .unwrap_or_else(|| "OpenCode não encontrado.".into())
                },
            })
        }
    }
}

#[tauri::command]
pub fn ai_cli_login(
    state: tauri::State<'_, Arc<AppState>>,
    provider: String,
    cli_path: Option<String>,
) -> AppResult<AiAuthResult> {
    let provider = AiProvider::parse(&provider)
        .ok_or_else(|| AppError::Message("Provedor inválido.".into()))?;
    let conn = state.db.lock();
    let settings = with_provider_cli(get_ai_settings(&conn)?, provider, cli_path);
    drop(conn);
    if provider != AiProvider::ClaudeCode {
        return Err(AppError::Message(
            "Conectar via CLI só está disponível para Claude Code.".into(),
        ));
    }
    start_claude_cli_login(&settings, provider)
}

#[tauri::command]
pub fn ai_list_models(
    state: tauri::State<'_, Arc<AppState>>,
    provider: String,
) -> AppResult<AiModelsResult> {
    let provider = AiProvider::parse(&provider)
        .ok_or_else(|| AppError::Message("Provedor inválido.".into()))?;
    let conn = state.db.lock();
    let settings = get_ai_settings(&conn)?;
    list_provider_models(&settings, &conn, provider)
}

#[tauri::command]
pub async fn ai_chat_turn(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    message: String,
    history: Option<Vec<ChatMessage>>,
    provider: Option<String>,
    model: Option<String>,
) -> AppResult<ChatTurnResult> {
    use crate::ai::ChatProgressEvent;
    use tauri::Emitter;

    let history = history.unwrap_or_default();
    let state = state.inner().clone();

    let emit_progress = move |event: ChatProgressEvent| {
        let _ = app.emit("ai-chat-progress", event);
    };

    tauri::async_runtime::spawn_blocking(move || {
        emit_progress(ChatProgressEvent {
            id: "load".into(),
            status: "running".into(),
            label: "Lendo o guia do jogo…".into(),
            detail: None,
            kind: None,
            query: None,
            sources: Vec::new(),
        });

        let override_provider = provider
            .as_deref()
            .and_then(AiProvider::parse);
        let (settings, chat_provider, api_key, game_name, achievements) = {
            let conn = state.db.lock();
            let settings = get_ai_settings(&conn)?;
            if !settings.enabled {
                emit_progress(ChatProgressEvent {
                    id: "load".into(),
                    status: "error".into(),
                    label: "Preciso da IA ativada nas Configurações".into(),
                    detail: None,
                    kind: None,
                    query: None,
                    sources: Vec::new(),
                });
                return Err(AppError::Message(
                    "Ative a integração de IA nas Configurações.".into(),
                ));
            }
            let chat_provider = effective_provider(&settings, override_provider)?;
            let api_key = resolve_api_key(&conn, &settings)?;
            let game = repos::list_games(&conn)?
                .into_iter()
                .find(|g| g.app_id == app_id)
                .ok_or_else(|| AppError::Message("Jogo não encontrado.".into()))?;
            let achievements = repos::list_achievements(&conn, &app_id)?;
            (settings, chat_provider, api_key, game.name, achievements)
        };

        emit_progress(ChatProgressEvent {
            id: "load".into(),
            status: "done".into(),
            label: "Guia carregado".into(),
            detail: Some(format!("{} conquistas", achievements.len())),
            kind: None,
            query: None,
            sources: Vec::new(),
        });

        state.ai_job.begin();
        let mut result = chat_turn(
            &settings,
            chat_provider,
            model.as_deref(),
            &app_id,
            &game_name,
            achievements,
            &history,
            &message,
            &api_key,
            &emit_progress,
            &state.app_data_dir,
            Some(&state.ai_job),
        )?;

        if result.updated > 0 {
            emit_progress(ChatProgressEvent {
                id: "save".into(),
                status: "running".into(),
                label: "Salvando no guia…".into(),
                detail: None,
                kind: None,
                query: None,
                sources: Vec::new(),
            });
            let conn = state.db.lock();
            let tx = conn.unchecked_transaction()?;
            repos::set_achievements(&tx, &app_id, &result.achievements)?;
            tx.commit()?;
            drop(conn);
            state.mark_dirty_for_backup();
            emit_progress(ChatProgressEvent {
                id: "save".into(),
                status: "done".into(),
                label: "Guia atualizado".into(),
                detail: Some(format!("{} conquista(s)", result.updated)),
                kind: None,
                query: None,
                sources: Vec::new(),
            });
        }

        emit_progress(ChatProgressEvent {
            id: "done".into(),
            status: "done".into(),
            label: "Pronto".into(),
            detail: None,
            kind: None,
            query: None,
            sources: Vec::new(),
        });

        result.achievements.clear();
        Ok(result)
    })
    .await
    .map_err(|e| AppError::Message(format!("Chat de IA interrompido: {e}")))?
}

#[tauri::command]
pub async fn ai_enrich_guide(
    state: tauri::State<'_, Arc<AppState>>,
    app_id: String,
    only_missing: Option<bool>,
    limit: Option<usize>,
) -> AppResult<EnrichResult> {
    let only_missing = only_missing.unwrap_or(true);
    let limit = limit.unwrap_or(12).clamp(1, 20);
    let state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let (settings, chat_provider, api_key, game_name, achievements) = {
            let conn = state.db.lock();
            let settings = get_ai_settings(&conn)?;
            if !settings.enabled {
                return Err(AppError::Message(
                    "Ative a integração de IA nas Configurações.".into(),
                ));
            }
            let chat_provider = effective_provider(&settings, None)?;
            let api_key = resolve_api_key(&conn, &settings)?;
            let game = repos::list_games(&conn)?
                .into_iter()
                .find(|g| g.app_id == app_id)
                .ok_or_else(|| AppError::Message("Jogo não encontrado.".into()))?;
            let achievements = repos::list_achievements(&conn, &app_id)?;
            (settings, chat_provider, api_key, game.name, achievements)
        };

        let mut result = enrich_guide_with_data(
            &settings,
            chat_provider,
            &app_id,
            &game_name,
            achievements,
            only_missing,
            limit,
            &api_key,
            &state.app_data_dir,
        )?;

        if result.updated > 0 {
            let conn = state.db.lock();
            let tx = conn.unchecked_transaction()?;
            repos::set_achievements(&tx, &app_id, &result.achievements)?;
            tx.commit()?;
            drop(conn);
            state.mark_dirty_for_backup();
        }

        result.achievements.clear();
        Ok(result)
    })
    .await
    .map_err(|e| AppError::Message(format!("Tarefa de IA interrompida: {e}")))?
}

#[tauri::command]
pub fn ai_chat_cancel(state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    state.ai_job.request_cancel();
    Ok(())
}
