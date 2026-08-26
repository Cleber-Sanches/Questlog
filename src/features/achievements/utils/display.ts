import type { Achievement } from '@/types/achievement'
import type { Locale } from '@/i18n/locales'
import { isPlaceholderGroup } from '@/features/achievements/utils/keys'

export function achievementTitle(a: Achievement, locale: Locale): string {
  if (locale === 'en') {
    const en = a.titleEn?.trim()
    if (en) return en
  }
  return a.title
}

export function achievementDescription(a: Achievement, locale: Locale): string {
  if (locale === 'en') {
    const en = a.descriptionEn?.trim()
    if (en) return en
  }
  return a.description || ''
}

export function achievementGroup(a: Achievement, locale: Locale): string {
  if (isPlaceholderGroup(a.group)) return ''
  const group = a.group?.trim() || ''
  if (locale === 'en') {
    const en = a.groupEn?.trim()
    if (en && !isPlaceholderGroup(en)) return en
  }
  return group
}
