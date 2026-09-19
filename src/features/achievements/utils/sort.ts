import type { Achievement, AchievementSort } from '@/types/achievement'
import type { Locale } from '@/i18n/locales'
import { achievementTitle } from './display'

function rarity(item: Achievement) {
  return typeof item.globalPercent === 'number' && Number.isFinite(item.globalPercent)
    ? item.globalPercent
    : null
}

function progressRatio(item: Achievement) {
  const max = item.progressMax
  const value = item.progress
  if (max == null || max <= 0 || value == null || !Number.isFinite(max) || !Number.isFinite(value)) {
    return null
  }
  return value / max
}

function unlockTime(item: Achievement) {
  if (!item.unlockedAt) return null
  const time = Date.parse(item.unlockedAt)
  return Number.isFinite(time) ? time : null
}

function compareNullableDesc(a: number | null, b: number | null) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

function compareNullableAsc(a: number | null, b: number | null) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function compareBySort(
  a: Achievement,
  b: Achievement,
  sort: AchievementSort,
  locale: Locale,
  bcp47: string,
) {
  if (sort === 'rarityCommon') return compareNullableDesc(rarity(a), rarity(b))
  if (sort === 'rarityRare') return compareNullableAsc(rarity(a), rarity(b))
  if (sort === 'progress') return compareNullableDesc(progressRatio(a), progressRatio(b))
  if (sort === 'az') {
    return achievementTitle(a, locale).localeCompare(achievementTitle(b, locale), bcp47, {
      sensitivity: 'base',
      numeric: true,
    })
  }
  if (sort === 'unlocked') {
    const pending = Number(!a.completed) - Number(!b.completed)
    if (pending) return pending
    return compareNullableDesc(unlockTime(a), unlockTime(b))
  }
  return 0
}

export function sortAchievements(
  items: Achievement[],
  sort: AchievementSort,
  locale: Locale,
  bcp47: string,
  spoilered?: (item: Achievement) => boolean,
) {
  if (sort === 'steam' || items.length < 2) return items
  const maskedTitle = (item: Achievement) =>
    spoilered?.(item) ? '\uFFFF' : achievementTitle(item, locale)
  const compare = (a: Achievement, b: Achievement) => {
    if (sort === 'az') {
      return maskedTitle(a).localeCompare(maskedTitle(b), bcp47, {
        sensitivity: 'base',
        numeric: true,
      })
    }
    return compareBySort(a, b, sort, locale, bcp47)
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map((entry) => entry.item)
}
