export type AiProvider = 'claude-code' | 'opencode'

export interface AiProviderConfig {
  cliPath: string
  model: string
  connected: boolean
  enabled: boolean
}

export type AiProvidersConfig = Record<AiProvider, AiProviderConfig>

export interface AiSettings {
  enabled: boolean
  activeProvider: AiProvider | null
  providers: AiProvidersConfig
  /** Só enviado no save; nunca retorna preenchido do backend. */
  apiKey: string
  hasApiKey: boolean
  clearApiKey: boolean
}

export interface AiDetectResult {
  found: boolean
  path?: string | null
  version?: string | null
  error?: string | null
}

export interface AiAuthResult {
  ok: boolean
  mode: string
  detail: string
}

export interface EnrichResult {
  updated: number
  considered: number
  provider: string
  rawPreview: string
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatTurnResult {
  reply: string
  updated: number
  videos: number
  provider: string
}

export interface AiModelItem {
  id: string
  name: string
  provider: string
}

export interface AiModelsResult {
  models: AiModelItem[]
  source: string
}

export const EMPTY_PROVIDER_CONFIG: AiProviderConfig = {
  cliPath: '',
  model: '',
  connected: false,
  enabled: true,
}

export const EMPTY_PROVIDERS: AiProvidersConfig = {
  'claude-code': { ...EMPTY_PROVIDER_CONFIG },
  opencode: { ...EMPTY_PROVIDER_CONFIG },
}

export const EMPTY_AI_SETTINGS: AiSettings = {
  enabled: false,
  activeProvider: null,
  providers: EMPTY_PROVIDERS,
  apiKey: '',
  hasApiKey: false,
  clearApiKey: false,
}

export function connectedProviders(settings: AiSettings): AiProvider[] {
  return (Object.entries(settings.providers) as [AiProvider, AiProviderConfig][])
    .filter(([, cfg]) => cfg.connected && cfg.enabled)
    .map(([id]) => id)
}
