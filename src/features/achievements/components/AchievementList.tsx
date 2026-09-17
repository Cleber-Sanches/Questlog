import { useState } from 'react'
import type { Achievement, GroupBy } from '@/types/achievement'
import { AchievementRow } from './AchievementRow'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { DifficultyIcon } from './DifficultyIcon'
import { useLocale, useT } from '@/app/providers/LocaleProvider'
import type { MessageKey } from '@/i18n'
import { achievementGroup } from '@/features/achievements/utils/display'
import { ACH_KEYS, isInternalAchKey } from '@/features/achievements/utils/keys'
import { openGuideChat } from '@/features/ai/openChat'

const SECTION_LABEL_KEYS: Record<string, MessageKey> = {
  [ACH_KEYS.DLC_BASE]: 'guide.dlc.base',
  [ACH_KEYS.GROUP_NONE]: 'group.ungrouped',
  [ACH_KEYS.GROUP_OTHER]: 'group.others',
  [ACH_KEYS.DIFF_MISSABLE]: 'group.missable',
  [ACH_KEYS.QUEUE_MISSABLE]: 'guide.queue.missable',
  [ACH_KEYS.QUEUE_EASY]: 'guide.queue.easy',
  [ACH_KEYS.QUEUE_REST]: 'guide.queue.rest',
  [ACH_KEYS.LEVEL_NONE]: 'guide.level.none',
  easy: 'difficulty.easy',
  medium: 'difficulty.medium',
  hard: 'difficulty.hard',
  none: 'difficulty.none',
}

function sectionHeaderClass(groupBy: GroupBy, key: string) {
  const parts = ['groupHeader']
  if (groupBy === 'dlc' && key !== ACH_KEYS.DLC_BASE) parts.push('dlcHeader')
  if (groupBy === 'dlc' && key === ACH_KEYS.DLC_BASE) parts.push('baseGameHeader')
  if (groupBy === 'difficulty') {
    parts.push('levelHeader')
    if (key === ACH_KEYS.DIFF_MISSABLE) parts.push('is-missable')
    else if (key === 'easy') parts.push('is-easy')
    else if (key === 'medium') parts.push('is-medium')
    else if (key === 'hard') parts.push('is-hard')
  }
  if (groupBy === 'queue') {
    parts.push('levelHeader')
    if (key === ACH_KEYS.QUEUE_MISSABLE) parts.push('is-missable')
    else if (key === ACH_KEYS.QUEUE_EASY) parts.push('is-easy')
  }
  if (groupBy === 'reqLevel') parts.push('reqLevelHeader')
  return parts.join(' ')
}

function SectionTitleIcon({ groupBy, sectionKey }: { groupBy: GroupBy; sectionKey: string }) {
  if (groupBy === 'dlc' && sectionKey === ACH_KEYS.DLC_BASE) {
    return <i className="ph-fill ph-game-controller" aria-hidden />
  }
  if (groupBy === 'dlc' && sectionKey !== ACH_KEYS.DLC_BASE) {
    return <i className="ph-fill ph-puzzle-piece" aria-hidden />
  }
  if (groupBy === 'difficulty') {
    if (sectionKey === ACH_KEYS.DIFF_MISSABLE) return <DifficultyIcon kind="missable" />
    if (sectionKey === 'easy') return <DifficultyIcon kind="easy" />
    if (sectionKey === 'medium') return <DifficultyIcon kind="medium" />
    if (sectionKey === 'hard') return <DifficultyIcon kind="hard" />
  }
  if (groupBy === 'queue') {
    if (sectionKey === ACH_KEYS.QUEUE_MISSABLE) return <DifficultyIcon kind="missable" />
    if (sectionKey === ACH_KEYS.QUEUE_EASY) return <DifficultyIcon kind="easy" />
    return <i className="ph-fill ph-chart-bar" aria-hidden />
  }
  if (groupBy === 'reqLevel') {
    return <i className="ph-duotone ph-stairs" aria-hidden />
  }
  return null
}

export function AchievementList({
  groups,
  groupBy,
  selectedId,
  onSelect,
  compact = false,
  hunt,
  onShowAll,
  onToggle,
  onSave,
  onDelete,
}: {
  groups: Array<{ key: string; items: Achievement[] }>
  groupBy: GroupBy
  selectedId?: number | null
  onSelect?: (a: Achievement) => void
  compact?: boolean
  hunt?: { classified: boolean; hidden: number; totalPending: number }
  onShowAll?: () => void
  onToggle: (a: Achievement) => void
  onSave: (a: Achievement) => void
  onDelete: (id: number) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (groupBy === 'queue' && hunt && !hunt.classified) {
    return (
      <div className="huntQueueEmpty">
        <p className="huntQueueEmptyTitle">{t('guide.queue.empty.title')}</p>
        <p className="huntQueueEmptyHint">{t('guide.queue.empty.hint')}</p>
        <div className="huntQueueEmptyActions">
          <Button variant="primary" size="md" onClick={() => openGuideChat()}>
            {t('guide.queue.empty.chat')}
          </Button>
          {onShowAll ? (
            <Button variant="ghost" size="md" onClick={onShowAll}>
              {t('guide.queue.empty.list')}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (!groups.length || groups.every((g) => g.items.length === 0)) {
    return (
      <EmptyState title={t('guide.list.empty.title')} hint={t('guide.list.empty.hint')} />
    )
  }

  const showHeaders = groupBy !== 'flat'
  const sectionLabel = (key: string, items: Achievement[]) => {
    const msgKey = SECTION_LABEL_KEYS[key]
    if (msgKey) return t(msgKey)
    if (isInternalAchKey(key)) return t('group.ungrouped')
    if (groupBy === 'group' && items[0]) return achievementGroup(items[0], locale) || t('group.ungrouped')
    return key
  }

  return (
    <div id="achievementList" className={compact ? 'isCompact' : ''}>
      {groups.map((group) => {
        const collapseKey = `${groupBy}:${group.key}`
        const isCollapsed = !!collapsed[collapseKey]
        const done = group.items.filter((a) => a.completed).length
        const total = group.items.length

        return (
          <div key={group.key} className="achievementGroup">
            {showHeaders ? (
              <button
                type="button"
                className={`${sectionHeaderClass(groupBy, group.key)}${isCollapsed ? ' is-collapsed' : ''}`}
                aria-expanded={!isCollapsed}
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [collapseKey]: !prev[collapseKey],
                  }))
                }
              >
                <h3>
                  <SectionTitleIcon groupBy={groupBy} sectionKey={group.key} />
                  {sectionLabel(group.key, group.items)}
                </h3>
                <span className="groupCount">
                  {groupBy === 'queue' ? total : `${done}/${total}`}
                </span>
                <i className="ph-bold ph-caret-down groupCollapseIcon" aria-hidden />
              </button>
            ) : null}

            <div className={`groupSection${isCollapsed ? ' is-collapsed' : ''}`}>
              <div className="groupSectionInner">
                {group.items.map((a) => (
                  <AchievementRow
                    key={a.id}
                    achievement={a}
                    groupBy={groupBy}
                    compact={compact}
                    selected={selectedId === a.id}
                    onSelect={onSelect ? () => onSelect(a) : undefined}
                    onToggle={() => onToggle(a)}
                    onSave={onSave}
                    onDelete={() => onDelete(a.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })}
      {groupBy === 'queue' && hunt && hunt.hidden > 0 && onShowAll ? (
        <div className="huntQueueMore">
          <Button variant="ghost" size="md" onClick={onShowAll}>
            {t('guide.queue.more', { n: hunt.totalPending })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
