/** Chaves internas estáveis — rótulos vêm do i18n ou dos dados da conquista. */
export const ACH_KEYS = {
  DLC_BASE: '__dlc_base__',
  GROUP_NONE: '__group_none__',
  GROUP_OTHER: '__group_other__',
  LIST: '__list__',
  DIFF_MISSABLE: '__diff_missable__',
  LEVEL_NONE: '__level_none__',
} as const

const LEGACY_DLC_BASE = 'Jogo base'
const LEGACY_GROUP_NONE = 'Sem Grupo'

/** Detecta chaves internas `__foo__` que nunca devem aparecer na UI. */
export function isInternalAchKey(value?: string | null): boolean {
  const v = String(value || '').trim()
  return /^__[a-z0-9_]+__$/i.test(v)
}

export function isBaseDlc(value?: string | null): boolean {
  const v = String(value || '').trim()
  return !v || v === ACH_KEYS.DLC_BASE || v === LEGACY_DLC_BASE
}

export function dlcKey(value?: string | null): string {
  const v = String(value || '').trim()
  if (!v || v === LEGACY_DLC_BASE || v === ACH_KEYS.DLC_BASE) return ACH_KEYS.DLC_BASE
  return v
}

export function groupKey(value?: string | null): string {
  const v = String(value || '').trim()
  if (!v || v === LEGACY_GROUP_NONE || v === ACH_KEYS.GROUP_NONE) return ACH_KEYS.GROUP_NONE
  return v
}

export function isPlaceholderGroup(value?: string | null): boolean {
  const v = String(value || '').trim()
  return !v || v === ACH_KEYS.GROUP_NONE || v === LEGACY_GROUP_NONE
}

/** Valor amigável para inputs (esconde chaves internas). */
export function displayGroupInput(value?: string | null): string {
  if (isPlaceholderGroup(value) || isInternalAchKey(value)) return ''
  return String(value || '').trim()
}

export function displayDlcInput(value?: string | null): string {
  if (isBaseDlc(value) || isInternalAchKey(value)) return ''
  return String(value || '').trim()
}
