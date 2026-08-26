import { invoke } from '@/lib/invoke'
import type {
  AiAuthResult,
  AiChatMessage,
  AiDetectResult,
  AiModelsResult,
  AiProvider,
  AiSettings,
  ChatTurnResult,
  EnrichResult,
} from '@/types/ai'

export const aiApi = {
  getSettings: () => invoke<AiSettings>('ai_get_settings'),
  saveSettings: (settings: AiSettings) => invoke<AiSettings>('ai_save_settings', { settings }),
  detect: (provider: AiProvider, cliPath?: string) =>
    invoke<AiDetectResult>('ai_detect_cli', { provider, cliPath: cliPath || null }),
  testAuth: (provider: AiProvider, cliPath?: string) =>
    invoke<AiAuthResult>('ai_test_auth', {
      provider,
      cliPath: cliPath?.trim() ? cliPath : null,
    }),
  cliLogin: (provider: AiProvider, cliPath?: string) =>
    invoke<AiAuthResult>('ai_cli_login', {
      provider,
      cliPath: cliPath?.trim() ? cliPath : null,
    }),
  listModels: (provider: AiProvider) =>
    invoke<AiModelsResult>('ai_list_models', { provider }),
  chatTurn: (
    appId: string,
    message: string,
    history: AiChatMessage[],
    provider?: AiProvider | null,
    model?: string | null,
  ) =>
    invoke<ChatTurnResult>('ai_chat_turn', {
      appId,
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      provider: provider ?? null,
      model: model?.trim() ? model.trim() : null,
    }),
  cancelChat: () => invoke<void>('ai_chat_cancel'),
  enrichGuide: (appId: string, opts?: { onlyMissing?: boolean; limit?: number }) =>
    invoke<EnrichResult>('ai_enrich_guide', {
      appId,
      onlyMissing: opts?.onlyMissing ?? true,
      limit: opts?.limit ?? 12,
    }),
}
