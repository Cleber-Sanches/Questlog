export type CompanionItem = {
  id: number
  title: string
  description?: string | null
  tips?: string | null
  icon?: string | null
  difficulty?: string | null
  missable?: boolean
  hidden?: boolean
  progress?: number | null
  progressMax?: number | null
}

export type CompanionSnapshot = {
  locale: string
  gameName?: string | null
  gameAppId?: string | null
  completed: number
  total: number
  missing: CompanionItem[]
  showHidden: boolean
  hotkey: string
}

export const COMPANION_SETTING_KEY = 'desktop_companion_overlay'
export const COMPANION_HOTKEY_SETTING_KEY = 'desktop_companion_hotkey'
export const DEFAULT_COMPANION_HOTKEY = 'Ctrl+Shift+Q'
