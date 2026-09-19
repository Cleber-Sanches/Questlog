import type { Achievement } from '@/types/achievement'
import type { Locale } from '@/i18n/locales'
import { isInternalAchKey, isPlaceholderGroup } from '@/features/achievements/utils/keys'

export function achievementTitle(a: Achievement, locale: Locale): string {
  if (locale === 'en') {
    const en = a.titleEn?.trim()
    if (en) return en
  }
  return a.title
}

export function achievementDescription(a: Achievement, locale: Locale): string {
  const pt = a.description?.trim() || ''
  const en = a.descriptionEn?.trim() || ''
  if (locale === 'en') return en || pt
  return pt || en
}

export function achievementGroup(a: Achievement, locale: Locale): string {
  if (isPlaceholderGroup(a.group) || isInternalAchKey(a.group)) return ''
  const group = a.group?.trim() || ''
  if (locale === 'en') {
    const en = a.groupEn?.trim()
    if (en && !isPlaceholderGroup(en) && !isInternalAchKey(en)) return en
  }
  if (isInternalAchKey(group)) return ''
  return group
}
