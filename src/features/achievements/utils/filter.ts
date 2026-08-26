import type { Achievement, GroupBy, StatusFilter } from '@/types/achievement'
import { ACH_KEYS, dlcKey, groupKey } from './keys'

export interface FacetFilters {
  difficulties: string[]
  reqLevels: string[]
  dlcs: string[]
  /** Quando true, só conquistas perdíveis. */
  missable: boolean
}

export interface FacetOption {
  value: string
  label: string
}

export const EMPTY_FACETS: FacetFilters = {
  difficulties: [],
  reqLevels: [],
  dlcs: [],
  missable: false,
}

export function facetDifficultyKey(item: Achievement) {
  return item.difficulty === 'easy' || item.difficulty === 'medium' || item.difficulty === 'hard'
    ? item.difficulty
    : 'none'
}

export function facetReqLevelKey(item: Achievement) {
  const value = String(item.reqLevel || '').trim()
  return value || 'none'
}

export function facetDlcKey(item: Achievement) {
  return dlcKey(item.dlc)
}

export function formatReqLevelLabel(value: string) {
  if (!value || value === 'none') return ACH_KEYS.LEVEL_NONE
  return value.replace(/-/g, '–')
}

export function countActiveFacets(facets: FacetFilters) {
  return (
    facets.difficulties.length +
    facets.reqLevels.length +
    facets.dlcs.length +
    (facets.missable ? 1 : 0)
  )
}

export function filterAchievements(
  items: Achievement[],
  status: StatusFilter,
  search: string,
  facets: FacetFilters,
) {
  const q = search.trim().toLowerCase()
  return items.filter((a) => {
    if (status === 'completed' && !a.completed) return false
    if (status === 'pending' && a.completed) return false
    if (facets.missable && !a.missable) return false
    if (facets.difficulties.length && !facets.difficulties.includes(facetDifficultyKey(a))) {
      return false
    }
    if (facets.reqLevels.length && !facets.reqLevels.includes(facetReqLevelKey(a))) {
      return false
    }
    if (facets.dlcs.length && !facets.dlcs.includes(facetDlcKey(a))) {
      return false
    }
    if (!q) return true
    const hay = [
      a.title,
      a.titleEn,
      a.description,
      a.descriptionEn,
      a.apiName,
      a.group,
      a.groupEn,
      a.dlc,
      a.tips,
      a.reqLevel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function countByStatus(items: Achievement[]) {
  const completed = items.filter((a) => a.completed).length
  return {
    all: items.length,
    completed,
    pending: items.length - completed,
  }
}

function sortReqLevelLabels(a: string, b: string) {
  if (a === ACH_KEYS.LEVEL_NONE) return 1
  if (b === ACH_KEYS.LEVEL_NONE) return -1
  const na = Number(String(a).match(/\d+/)?.[0] || 0)
  const nb = Number(String(b).match(/\d+/)?.[0] || 0)
  if (na !== nb) return na - nb
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function groupAchievements(items: Achievement[], groupBy: GroupBy) {
  if (groupBy === 'flat') {
    return [{ key: ACH_KEYS.LIST, items }]
  }
  const map = new Map<string, Achievement[]>()
  for (const item of items) {
    let key: string = ACH_KEYS.GROUP_OTHER
    if (groupBy === 'group') key = groupKey(item.group)
    if (groupBy === 'dlc') key = facetDlcKey(item)
    if (groupBy === 'difficulty') {
      key = item.missable ? ACH_KEYS.DIFF_MISSABLE : facetDifficultyKey(item)
    }
    if (groupBy === 'reqLevel') {
      key = formatReqLevelLabel(facetReqLevelKey(item))
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  const entries = [...map.entries()]
  if (groupBy === 'reqLevel') {
    entries.sort(([a], [b]) => sortReqLevelLabels(a, b))
  } else if (groupBy === 'dlc') {
    entries.sort(([a], [b]) => {
      if (a === ACH_KEYS.DLC_BASE) return -1
      if (b === ACH_KEYS.DLC_BASE) return 1
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
  } else if (groupBy === 'difficulty') {
    const order = [
      ACH_KEYS.DIFF_MISSABLE,
      'easy',
      'medium',
      'hard',
      'none',
    ]
    entries.sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  } else {
    entries.sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }
  return entries.map(([key, groupItems]) => ({ key, items: groupItems }))
}

export function collectFacetOptions(items: Achievement[]) {
  const diffOpts: FacetOption[] = [
    { value: 'easy', label: 'easy' },
    { value: 'medium', label: 'medium' },
    { value: 'hard', label: 'hard' },
    { value: 'none', label: 'none' },
  ].filter((opt) => items.some((a) => facetDifficultyKey(a) === opt.value))

  const hasMissable = items.some((a) => !!a.missable)

  const levelVals = new Set(items.map(facetReqLevelKey))
  const levelOpts = [...levelVals]
    .sort((a, b) => sortReqLevelLabels(formatReqLevelLabel(a), formatReqLevelLabel(b)))
    .map((v) => ({ value: v, label: formatReqLevelLabel(v) }))

  const dlcVals = new Set(items.map(facetDlcKey))
  const dlcOpts = [...dlcVals]
    .sort((a, b) => {
      if (a === ACH_KEYS.DLC_BASE) return -1
      if (b === ACH_KEYS.DLC_BASE) return 1
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
    .map((v) => ({ value: v, label: v }))

  return { diffOpts, levelOpts, dlcOpts, hasMissable }
}

export function extractIconHash(url?: string | null) {
  const m = /([a-f0-9]{40})/i.exec(url || '')
  return m ? m[1].toLowerCase() : null
}

export function toggleFacetValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
