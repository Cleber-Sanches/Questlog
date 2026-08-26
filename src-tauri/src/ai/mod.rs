pub mod cancel;
pub mod chat;
pub mod cli;
pub mod enrich;
pub mod intent;
pub mod models;
pub mod settings;
pub mod youtube;

pub use chat::{chat_turn, ChatMessage, ChatProgressEvent, ChatTurnResult};
pub use enrich::{enrich_guide_with_data, EnrichResult};
pub use models::{list_provider_models, AiModelsResult};
pub use settings::{
    check_claude_cli_auth, detect_provider, effective_provider, get_ai_settings, provider_cli_path,
    resolve_api_key, save_ai_settings, start_claude_cli_login, AiAuthResult, AiDetectResult,
    AiProvider, AiSettings,
};
