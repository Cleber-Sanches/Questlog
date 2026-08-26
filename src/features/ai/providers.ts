import type { AiProvider } from '@/types/ai'
import type { MessageKey } from '@/i18n'

export type ProviderAuthMode = 'browser' | 'terminal'

export type ProviderCatalogItem = {
  id: AiProvider
  name: string
  brand: string
  logo: string
  blurbKey: MessageKey
  cliPlaceholder: string
  modelPlaceholder: string
  auth: ProviderAuthMode
  authHelpKey?: MessageKey
}

export const AI_PROVIDERS: ProviderCatalogItem[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    brand: 'Anthropic',
    logo: '/providers/claude-code.svg',
    blurbKey: 'settings.ai.provider.claude.blurb',
    cliPlaceholder: 'claude',
    modelPlaceholder: 'sonnet',
    auth: 'browser',
    authHelpKey: 'settings.ai.auth.hint',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    brand: 'OpenCode',
    logo: '/providers/opencode-mark.svg',
    blurbKey: 'settings.ai.provider.opencode.blurb',
    cliPlaceholder: 'opencode',
    modelPlaceholder: 'opencode/big-pickle',
    auth: 'terminal',
    authHelpKey: 'settings.ai.auth.opencode',
  },
]

export function findProvider(id: AiProvider | null | undefined) {
  return AI_PROVIDERS.find((p) => p.id === id)
}

export type AiModelOption = {
  value: string
  label: string
  provider?: string
}

export const CLAUDE_MODELS: AiModelOption[] = [
  { value: 'sonnet', label: 'Sonnet 5', provider: 'anthropic' },
  { value: 'opus', label: 'Opus 5', provider: 'anthropic' },
  { value: 'haiku', label: 'Haiku 4.5', provider: 'anthropic' },
  { value: 'fable', label: 'Fable 5', provider: 'anthropic' },
]

/** Fallback só com modelos grátis do OpenCode (sem Anthropic — isso fica no Claude Code). */
export const OPENCODE_MODELS: AiModelOption[] = [
  { value: 'opencode/big-pickle', label: 'Big Pickle', provider: 'opencode' },
  { value: 'opencode/hy3-free', label: 'Hy3 Free', provider: 'opencode' },
  { value: 'opencode/mimo-v2.5-free', label: 'Mimo V2.5 Free', provider: 'opencode' },
  { value: 'opencode/nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free', provider: 'opencode' },
  {
    value: 'opencode/nemotron-3.5-lightning-free',
    label: 'Nemotron 3.5 Lightning Free',
    provider: 'opencode',
  },
]

export function fallbackModelsForProvider(provider: AiProvider | null | undefined) {
  if (provider === 'opencode') return OPENCODE_MODELS
  if (provider === 'claude-code') return CLAUDE_MODELS
  return []
}

export function modelsForProvider(provider: AiProvider | null | undefined): AiModelOption[] {
  return fallbackModelsForProvider(provider)
}

export function modelLabel(
  provider: AiProvider | null | undefined,
  value: string,
  models = modelsForProvider(provider),
) {
  const hit = models.find((m) => m.value === value.trim())
  return hit?.label ?? value.trim()
}

export function normalizeProviderModel(
  provider: AiProvider | null | undefined,
  value: string,
  models = modelsForProvider(provider),
) {
  const trimmed = value.trim()
  if (!models.length) return trimmed
  if (!trimmed) return models[0].value
  const exact = models.find((m) => m.value === trimmed)
  if (exact) return exact.value
  const byLabel = models.find((m) => m.label.toLowerCase() === trimmed.toLowerCase())
  return byLabel?.value ?? trimmed
}
