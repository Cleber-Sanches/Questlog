import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowClockwiseIcon } from '@/components/icons/raycast'
import { useT } from '@/app/providers/LocaleProvider'
import type { MessageKey } from '@/i18n'
import type { AchievementSort, GroupBy } from '@/types/achievement'
import { ACHIEVEMENT_SORT_OPTIONS, GROUP_BY_OPTIONS } from '@/types/achievement'
import {
  EMPTY_FACETS,
  countActiveFacets,
  toggleFacetValue,
  type FacetFilters,
  type FacetOption,
} from '@/features/achievements/utils/filter'
import { Tooltip } from '@/components/ui/Tooltip'
import { DifficultyIcon } from './DifficultyIcon'
import { ACH_KEYS, isBaseDlc } from '@/features/achievements/utils/keys'

const GROUP_BY_LABEL_KEYS: Record<GroupBy, MessageKey> = {
  queue: 'guide.groupBy.queue',
  flat: 'guide.groupBy.flat',
  group: 'guide.groupBy.group',
  dlc: 'guide.filters.dlc',
  difficulty: 'guide.filters.difficulty',
  reqLevel: 'guide.filters.level',
}

const SORT_LABEL_KEYS: Record<AchievementSort, MessageKey> = {
  steam: 'guide.sort.steam',
  rarityCommon: 'guide.sort.rarityCommon',
  rarityRare: 'guide.sort.rarityRare',
  progress: 'guide.sort.progress',
  az: 'guide.sort.az',
  unlocked: 'guide.sort.unlocked',
}

function shortDlcLabel(label: string, baseLabel: string) {
  if (label === ACH_KEYS.DLC_BASE || isBaseDlc(label)) return baseLabel
  const parts = label.split(/\s*[–—-]\s*/)
  if (parts.length > 1) return parts[parts.length - 1].trim()
  return label
}

function facetLabel(
  opt: FacetOption,
  variant: 'default' | 'difficulty' | 'levels' | 'dlc',
  baseDlcLabel: string,
  t: ReturnType<typeof useT>,
) {
  if (variant === 'dlc') return shortDlcLabel(opt.label, baseDlcLabel)
  if (variant === 'levels' && (opt.value === 'none' || opt.label === ACH_KEYS.LEVEL_NONE)) {
    return t('guide.level.none')
  }
  if (variant === 'difficulty') {
    if (opt.value === 'easy' || opt.value === 'medium' || opt.value === 'hard' || opt.value === 'none') {
      return t(
        (
          {
            easy: 'difficulty.easy',
            medium: 'difficulty.medium',
            hard: 'difficulty.hard',
            none: 'difficulty.none',
          } as const
        )[opt.value],
      )
    }
  }
  return opt.label
}

function diffChipIcon(value: string) {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return <DifficultyIcon kind={value} />
  }
  return <i className="ph ph-circle-dashed" aria-hidden />
}

function ChipGroup({
  options,
  active,
  onToggle,
  variant = 'default',
  emptyLabel,
  facetLabelFn,
}: {
  options: FacetOption[]
  active: string[]
  onToggle: (value: string) => void
  variant?: 'default' | 'difficulty' | 'levels' | 'dlc'
  emptyLabel: string
  facetLabelFn: (opt: FacetOption) => string
}) {
  if (!options.length) return <span className="filtersEmpty">{emptyLabel}</span>
  return (
    <div className={`filtersChips is-${variant}`}>
      {options.map((opt) => {
        const label = facetLabelFn(opt)
        const title = variant === 'dlc' && label !== opt.label ? opt.label : undefined
        return (
          <button
            key={opt.value}
            type="button"
            className={`filterChip is-${variant}${active.includes(opt.value) ? ' is-active' : ''}${
              variant === 'difficulty' ? ` is-diff-${opt.value}` : ''
            }${variant === 'dlc' && opt.value === ACH_KEYS.DLC_BASE ? ' is-base' : ''}`}
            aria-pressed={active.includes(opt.value)}
            title={title}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(opt.value)
            }}
          >
            {variant === 'difficulty' ? (
              <span className="filterChipIcon" aria-hidden>
                {diffChipIcon(opt.value)}
              </span>
            ) : null}
            {variant === 'dlc' ? (
              <span className="filterChipIcon" aria-hidden>
                <i
                  className={
                    opt.value === ACH_KEYS.DLC_BASE
                      ? 'ph-fill ph-game-controller'
                      : 'ph-fill ph-puzzle-piece'
                  }
                />
              </span>
            ) : null}
            <span className="filterChipLabel">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="filtersSectionTitle">
      <i className={icon} aria-hidden />
      {children}
    </span>
  )
}

export function ListControls({
  groupBy,
  setGroupBy,
  sort,
  setSort,
  facets,
  setFacets,
  facetOptions,
  onSync,
  compact = false,
}: {
  groupBy: GroupBy
  setGroupBy: (v: GroupBy) => void
  sort: AchievementSort
  setSort: (v: AchievementSort) => void
  facets: FacetFilters
  setFacets: (f: FacetFilters) => void
  facetOptions: {
    diffOpts: FacetOption[]
    levelOpts: FacetOption[]
    dlcOpts: FacetOption[]
    hasMissable: boolean
  }
  onSync?: () => void
  compact?: boolean
}) {
  const t = useT()
  const [openMenu, setOpenMenu] = useState<'group' | 'sort' | 'filters' | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const activeCount = countActiveFacets(facets)
  const groupOpen = openMenu === 'group'
  const sortOpen = openMenu === 'sort'
  const filtersOpen = openMenu === 'filters'
  const groupLabel = t(GROUP_BY_LABEL_KEYS[groupBy] ?? 'guide.groupBy.flat')
  const sortLabel = t(SORT_LABEL_KEYS[sort] ?? 'guide.sort.steam')
  const emptyLabel = t('guide.filters.empty')
  const baseDlcLabel = t('guide.dlc.base')
  const labelFor = (opt: FacetOption, variant: 'levels' | 'dlc') =>
    facetLabel(opt, variant, baseDlcLabel, t)

  useEffect(() => {
    if (!openMenu) return
    const onDoc = (e: MouseEvent) => {
      if (!shellRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  return (
    <div className={`viewToggle${compact ? ' isCompact' : ''}`}>
      <div className="listControls">
        <div className="listControlShell" ref={shellRef}>
          <div className={`groupByWrap${groupOpen ? ' isOpen' : ''}`}>
            <button
              type="button"
              className="listControlBtn"
              aria-haspopup="listbox"
              aria-expanded={groupOpen}
              aria-label={`${t('guide.groupBy.aria')} ${groupLabel}`}
              onClick={() => setOpenMenu((v) => (v === 'group' ? null : 'group'))}
            >
              <span className="listControlLead" aria-hidden>
                <i
                  className={
                    groupBy === 'queue' ? 'ph-fill ph-flag-banner' : 'ph-duotone ph-rows'
                  }
                />
              </span>
              <span className="listControlText">
                {!compact ? <span className="listControlLabel">{t('guide.groupBy.label')}</span> : null}
                <span className="listControlValue">{groupLabel}</span>
              </span>
              <i className="ph-bold ph-caret-down listControlCaret" aria-hidden />
            </button>
            {groupOpen ? (
              <div className="listControlMenu" role="listbox" aria-label={t('guide.groupBy.aria')}>
                {GROUP_BY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`listControlOption${groupBy === opt.value ? ' is-active' : ''}`}
                    role="option"
                    aria-selected={groupBy === opt.value}
                    onClick={() => {
                      setGroupBy(opt.value)
                      setOpenMenu(null)
                    }}
                  >
                    <span className="listControlOptionIcon" aria-hidden>
                      <i className={opt.icon} />
                    </span>
                    <span className="listControlOptionLabel">
                      {t(GROUP_BY_LABEL_KEYS[opt.value])}
                    </span>
                    <i className="ph-bold ph-check listControlOptionCheck" aria-hidden />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {groupBy !== 'queue' ? (
            <>
              <div className="listControlDivider" aria-hidden />

              <div className={`sortWrap${sortOpen ? ' isOpen' : ''}`}>
            <button
              type="button"
              className="listControlBtn"
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              aria-label={`${t('guide.sort.aria')} ${sortLabel}`}
              onClick={() => setOpenMenu((v) => (v === 'sort' ? null : 'sort'))}
            >
              <span className="listControlLead" aria-hidden>
                <i className="ph-fill ph-arrows-down-up" />
              </span>
              <span className="listControlText">
                {!compact ? <span className="listControlLabel">{t('guide.sort.label')}</span> : null}
                <span className="listControlValue">{sortLabel}</span>
              </span>
              <i className="ph-bold ph-caret-down listControlCaret" aria-hidden />
            </button>
            {sortOpen ? (
              <div className="listControlMenu" role="listbox" aria-label={t('guide.sort.aria')}>
                {ACHIEVEMENT_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`listControlOption${sort === opt.value ? ' is-active' : ''}`}
                    role="option"
                    aria-selected={sort === opt.value}
                    onClick={() => {
                      setSort(opt.value)
                      setOpenMenu(null)
                    }}
                  >
                    <span className="listControlOptionIcon" aria-hidden>
                      <i className={opt.icon} />
                    </span>
                    <span className="listControlOptionLabel">{t(SORT_LABEL_KEYS[opt.value])}</span>
                    <i className="ph-bold ph-check listControlOptionCheck" aria-hidden />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
            </>
          ) : null}

          <div className="listControlDivider" aria-hidden />

          <div className={`filtersWrap${filtersOpen ? ' isOpen' : ''}`}>
            <button
              type="button"
              className={`listControlBtn${activeCount > 0 ? ' hasFilters' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setOpenMenu((v) => (v === 'filters' ? null : 'filters'))}
            >
              <span className="listControlLead" aria-hidden>
                <i className="ph-duotone ph-funnel" />
              </span>
              <span className="listControlLabel is-solo">{t('guide.filters.label')}</span>
              {activeCount > 0 ? <span className="filtersCount">{activeCount}</span> : null}
              <i className="ph-bold ph-caret-down listControlCaret" aria-hidden />
            </button>
          </div>

          {filtersOpen ? (
            <div className="filtersPanel" role="dialog" aria-label={t('guide.filters.aria')}>
              <div className="filtersPanelHead">
                <span className="filtersPanelHeadTitle">
                  <i className="ph-duotone ph-funnel" aria-hidden />
                  {t('guide.filters.label')}
                </span>
                <button
                  type="button"
                  className="filtersClearBtn"
                  disabled={activeCount === 0}
                  onClick={() => setFacets(EMPTY_FACETS)}
                >
                  {t('guide.filters.clear')}
                </button>
              </div>
              <div className="filtersPanelBody">
                <div className="filtersSection">
                  <SectionTitle icon="ph-duotone ph-gauge">
                    {t('guide.filters.difficulty')}
                  </SectionTitle>
                  <div className="filtersChips is-difficulty">
                    {facetOptions.hasMissable ? (
                      <button
                        type="button"
                        className={`filterChip is-difficulty is-diff-missable${facets.missable ? ' is-active' : ''}`}
                        aria-pressed={facets.missable}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFacets({ ...facets, missable: !facets.missable })
                        }}
                      >
                        <span className="filterChipIcon" aria-hidden>
                          <DifficultyIcon kind="missable" />
                        </span>
                        <span className="filterChipLabel">{t('guide.filters.missable')}</span>
                      </button>
                    ) : null}
                    {facetOptions.diffOpts.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`filterChip is-difficulty is-diff-${opt.value}${
                          facets.difficulties.includes(opt.value) ? ' is-active' : ''
                        }`}
                        aria-pressed={facets.difficulties.includes(opt.value)}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFacets({
                            ...facets,
                            difficulties: toggleFacetValue(facets.difficulties, opt.value),
                          })
                        }}
                      >
                        <span className="filterChipIcon" aria-hidden>
                          {diffChipIcon(opt.value)}
                        </span>
                        <span className="filterChipLabel">
                          {opt.value === 'easy' ||
                          opt.value === 'medium' ||
                          opt.value === 'hard' ||
                          opt.value === 'none'
                            ? t(
                                (
                                  {
                                    easy: 'difficulty.easy',
                                    medium: 'difficulty.medium',
                                    hard: 'difficulty.hard',
                                    none: 'difficulty.none',
                                  } as const
                                )[opt.value],
                              )
                            : opt.label}
                        </span>
                      </button>
                    ))}
                    {!facetOptions.hasMissable && !facetOptions.diffOpts.length ? (
                      <span className="filtersEmpty">{emptyLabel}</span>
                    ) : null}
                  </div>
                </div>
                <div className="filtersSection filtersSectionLevels">
                  <SectionTitle icon="ph-duotone ph-stairs">{t('guide.filters.level')}</SectionTitle>
                  <ChipGroup
                    variant="levels"
                    options={facetOptions.levelOpts}
                    active={facets.reqLevels}
                    emptyLabel={emptyLabel}
                    facetLabelFn={(opt) => labelFor(opt, 'levels')}
                    onToggle={(v) =>
                      setFacets({
                        ...facets,
                        reqLevels: toggleFacetValue(facets.reqLevels, v),
                      })
                    }
                  />
                </div>
                <div className="filtersSection">
                  <SectionTitle icon="ph-fill ph-puzzle-piece">{t('guide.filters.dlc')}</SectionTitle>
                  <ChipGroup
                    variant="dlc"
                    options={facetOptions.dlcOpts}
                    active={facets.dlcs}
                    emptyLabel={emptyLabel}
                    facetLabelFn={(opt) => labelFor(opt, 'dlc')}
                    onToggle={(v) =>
                      setFacets({
                        ...facets,
                        dlcs: toggleFacetValue(facets.dlcs, v),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {onSync ? (
        <div className="syncCluster">
          <Tooltip content={t('guide.sync.tip')} side="bottom">
            <button type="button" className="syncBtn" onClick={onSync} aria-label={t('guide.sync.aria')}>
              <ArrowClockwiseIcon width={16} height={16} aria-hidden />
            </button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  )
}
