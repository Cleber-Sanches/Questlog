import type { Achievement } from '@/types/achievement'
import type { Game } from '@/types/game'

export type GameHuntStats = {
  total: number
  completed: number
  pending: number
  percent: number
  platinum: boolean
  inProgress: boolean
}

export function gameHuntStats(items: Achievement[]): GameHuntStats {
  const total = items.length
  const completed = items.filter((a) => a.completed).length
  const pending = Math.max(0, total - completed)
  const platinum = total > 0 && completed === total
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return {
    total,
    completed,
    pending,
    percent,
    platinum,
    inProgress: total > 0 && !platinum,
  }
}

export function compareGamesByName(a: Game, b: Game, locale: string) {
  return a.name.localeCompare(b.name, locale, { sensitivity: 'base' })
}

/** Em andamento primeiro (mais perto da platina), depois platinados, depois sem conquistas. */
export function compareGamesByHunt(
  a: Game,
  b: Game,
  statsA: GameHuntStats,
  statsB: GameHuntStats,
  locale: string,
) {
  const rank = (s: GameHuntStats) => (s.inProgress ? 0 : s.platinum ? 1 : 2)
  const byRank = rank(statsA) - rank(statsB)
  if (byRank) return byRank
  if (statsA.inProgress && statsA.percent !== statsB.percent) {
    return statsB.percent - statsA.percent
  }
  return compareGamesByName(a, b, locale)
}
