import type { Achievement } from '@/types/achievement'
import { ACH_KEYS } from './keys'

export const HUNT_QUEUE_LIMIT = 10
const ALMOST_FULL = 0.8

export type HuntQueueGroup = { key: string; items: Achievement[] }

export type HuntQueue = {
  classified: boolean
  groups: HuntQueueGroup[]
  hidden: number
  totalPending: number
}

function hasProgressBar(item: Achievement) {
  return (
    typeof item.progressMax === 'number' &&
    item.progressMax > 0 &&
    typeof item.progress === 'number' &&
    Number.isFinite(item.progress)
  )
}

function progressRatio(item: Achievement) {
  if (!hasProgressBar(item) || item.progressMax == null || item.progress == null) return null
  return item.progress / item.progressMax
}

function isClassified(item: Achievement) {
  return (
    !!item.missable ||
    item.difficulty === 'easy' ||
    item.difficulty === 'medium' ||
    item.difficulty === 'hard'
  )
}

function isEasyNow(item: Achievement) {
  if (item.difficulty !== 'easy') return false
  const ratio = progressRatio(item)
  return ratio == null || ratio >= ALMOST_FULL
}

function rarity(item: Achievement) {
  return typeof item.globalPercent === 'number' && Number.isFinite(item.globalPercent)
    ? item.globalPercent
    : null
}

function compareRarity(a: Achievement, b: Achievement) {
  const ra = rarity(a)
  const rb = rarity(b)
  if (ra == null && rb == null) return 0
  if (ra == null) return 1
  if (rb == null) return -1
  return rb - ra
}

function huntRank(item: Achievement) {
  if (item.missable) return 0
  if (isEasyNow(item)) return 1
  return 2
}

function huntKey(item: Achievement) {
  const rank = huntRank(item)
  if (rank === 0) return ACH_KEYS.QUEUE_MISSABLE
  if (rank === 1) return ACH_KEYS.QUEUE_EASY
  return ACH_KEYS.QUEUE_REST
}

export function buildHuntQueue(pending: Achievement[], limit = HUNT_QUEUE_LIMIT): HuntQueue {
  const totalPending = pending.length
  if (totalPending === 0) {
    return { classified: true, groups: [], hidden: 0, totalPending }
  }
  if (!pending.some(isClassified)) {
    return { classified: false, groups: [], hidden: 0, totalPending }
  }

  const ranked = pending
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byTier = huntRank(a.item) - huntRank(b.item)
      if (byTier) return byTier
      if (huntRank(a.item) === 1) {
        const ra = progressRatio(a.item) ?? -1
        const rb = progressRatio(b.item) ?? -1
        if (ra !== rb) return rb - ra
      }
      return compareRarity(a.item, b.item) || a.index - b.index
    })
    .map((entry) => entry.item)

  const sliced = ranked.slice(0, Math.max(1, limit))
  const map = new Map<string, Achievement[]>()
  for (const item of sliced) {
    const key = huntKey(item)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }

  const order = [ACH_KEYS.QUEUE_MISSABLE, ACH_KEYS.QUEUE_EASY, ACH_KEYS.QUEUE_REST]
  const groups = order
    .filter((key) => map.has(key))
    .map((key) => ({ key, items: map.get(key)! }))

  return {
    classified: true,
    groups,
    hidden: Math.max(0, totalPending - sliced.length),
    totalPending,
  }
}
