import { useEffect, useMemo, useState } from 'react'
import type { Achievement, AchievementSort, GroupBy, StatusFilter } from '@/types/achievement'
import { isAchievementSort } from '@/types/achievement'
import { useLocale } from '@/app/providers/LocaleProvider'
import {
  EMPTY_FACETS,
  collectFacetOptions,
  countActiveFacets,
  countByStatus,
  filterAchievements,
  groupAchievements,
  type FacetFilters,
} from '../utils/filter'
import { sortAchievements } from '../utils/sort'
import { buildHuntQueue, HUNT_QUEUE_LIMIT, type HuntQueue } from '../utils/queue'

const SORT_STORAGE_KEY = 'guia.achievementSort'

const EMPTY_HUNT: HuntQueue = {
  classified: true,
  groups: [],
  hidden: 0,
  totalPending: 0,
}

function readSort(): AchievementSort {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    if (isAchievementSort(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'steam'
}

export function useAchievementFilters(items: Achievement[], revealHidden = false) {
  const { locale, bcp47 } = useLocale()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('flat')
  const [sort, setSort] = useState<AchievementSort>(readSort)
  const [facets, setFacets] = useState<FacetFilters>(EMPTY_FACETS)

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, sort)
    } catch {
      /* ignore */
    }
  }, [sort])

  const filtered = useMemo(
    () => filterAchievements(items, status, search, facets, revealHidden),
    [items, status, search, facets, revealHidden],
  )
  const hunt = useMemo(() => {
    if (groupBy !== 'queue') return EMPTY_HUNT
    const pending = filterAchievements(items, 'pending', search, facets, revealHidden)
    return buildHuntQueue(pending, HUNT_QUEUE_LIMIT)
  }, [groupBy, items, search, facets, revealHidden])
  const sorted = useMemo(
    () => (groupBy === 'queue' ? filtered : sortAchievements(filtered, sort, locale, bcp47)),
    [filtered, groupBy, sort, locale, bcp47],
  )
  const groups = useMemo(
    () => (groupBy === 'queue' ? hunt.groups : groupAchievements(sorted, groupBy)),
    [groupBy, hunt.groups, sorted],
  )
  const counts = useMemo(() => countByStatus(items), [items])
  const facetOptions = useMemo(() => collectFacetOptions(items), [items])
  const activeFacetCount = useMemo(() => countActiveFacets(facets), [facets])

  return {
    status,
    setStatus,
    search,
    setSearch,
    groupBy,
    setGroupBy,
    sort,
    setSort,
    facets,
    setFacets,
    filtered,
    groups,
    hunt,
    counts,
    facetOptions,
    activeFacetCount,
  }
}
