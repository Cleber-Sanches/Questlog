import { useMemo, useState } from 'react'
import type { Achievement, GroupBy, StatusFilter } from '@/types/achievement'
import {
  EMPTY_FACETS,
  collectFacetOptions,
  countActiveFacets,
  countByStatus,
  filterAchievements,
  groupAchievements,
  type FacetFilters,
} from '../utils/filter'

export function useAchievementFilters(items: Achievement[]) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('flat')
  const [facets, setFacets] = useState<FacetFilters>(EMPTY_FACETS)

  const filtered = useMemo(
    () => filterAchievements(items, status, search, facets),
    [items, status, search, facets],
  )
  const groups = useMemo(() => groupAchievements(filtered, groupBy), [filtered, groupBy])
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
    facets,
    setFacets,
    filtered,
    groups,
    counts,
    facetOptions,
    activeFacetCount,
  }
}
