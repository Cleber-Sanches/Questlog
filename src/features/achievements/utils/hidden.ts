import type { Achievement } from '@/types/achievement'
import { settingEnabled } from '@/features/overlay/types'

export const SHOW_HIDDEN_SETTING_KEY = 'show_hidden_achievements'

export function showHiddenAchievements(settings: Record<string, string>) {
  return settingEnabled(settings, SHOW_HIDDEN_SETTING_KEY, false)
}

export function isAchievementSpoilered(achievement: Achievement, reveal: boolean) {
  return Boolean(achievement.hidden) && !achievement.completed && !reveal
}

export function looksLikeHiddenPlaceholder(text?: string | null) {
  const value = (text || '').trim().toLowerCase()
  if (!value) return false
  return (
    value === 'hidden achievement' ||
    value === 'hidden achievements' ||
    value === 'conquista oculta' ||
    value === 'hidden' ||
    value.includes('hidden achievement') ||
    value.includes('conquista oculta') ||
    value.includes('continue playing to unlock this hidden')
  )
}
