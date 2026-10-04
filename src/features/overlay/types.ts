export type OverlayDifficulty = 'easy' | 'medium' | 'hard'

export type UnlockOverlayPayload = {
  kicker: string
  title: string
  subtitle: string
  icon?: string | null
  difficulty?: OverlayDifficulty | null
  missable?: boolean
  progress?: number | null
  progressMax?: number | null
}

export const OVERLAY_SETTING_KEY = 'desktop_unlock_overlay'
export const OVERLAY_PROGRESS_SETTING_KEY = 'desktop_overlay_progress'
export const OVERLAY_SOUND_SETTING_KEY = 'desktop_overlay_sound'
export const OVERLAY_SOUND_PROGRESS_SETTING_KEY = 'desktop_overlay_sound_progress'
export const TRAY_SETTING_KEY = 'minimize_to_tray'

export type OverlayChime = 'unlock' | 'progress' | 'none'

export function overlayDifficulty(value?: string | null): OverlayDifficulty | null {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value
  return null
}

export function settingEnabled(settings: Record<string, string>, key: string, fallback = true) {
  const value = settings[key]
  if (value == null || value.trim() === '') return fallback
  return value === '1' || value.toLowerCase() === 'true'
}
