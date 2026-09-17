import { useCallback, useRef } from 'react'
import { AppShell } from '@/layouts/AppShell'
import { GuideLayout } from '@/layouts/GuideLayout'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useAchievements } from '@/features/achievements/hooks/useAchievements'
import { useAchievementFilters } from '@/features/achievements/hooks/useAchievementFilters'
import { AchievementList } from '@/features/achievements/components/AchievementList'
import { AchievementEditor } from '@/features/achievements/components/AchievementEditor'
import { useSteamSync } from '@/features/steam/hooks/useSteamSync'
import { useSteamLocaleTexts } from '@/features/steam/hooks/useSteamLocaleTexts'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ConfirmDialog } from '@/components/overlay/ConfirmDialog'
import { useModal } from '@/app/providers/ModalProvider'
import type { Achievement } from '@/types/achievement'

export function GuidePage() {
  const t = useT()
  const { activeGame, loading } = useAppData()
  const { achievements, toggleCompleted, patch, create, remove } = useAchievements(activeGame?.appId)
  const filters = useAchievementFilters(achievements)
  useSteamSync(activeGame?.appId)
  useSteamLocaleTexts(activeGame?.appId)
  const { openModal } = useModal()
  const searchRef = useRef<HTMLInputElement>(null)

  const handleDelete = useCallback(
    (id: number) => {
      openModal(
        <ConfirmDialog
          title={t('guide.delete.title')}
          message={t('guide.delete.message')}
          confirmLabel={t('common.delete')}
          onConfirm={() => void remove(id)}
        />,
      )
    },
    [openModal, remove, t],
  )

  const handleSave = useCallback(
    (item: Achievement) => {
      void patch(item)
    },
    [patch],
  )

  const handleNew = useCallback(async () => {
    if (!activeGame) return
    const item = await create()
    if (!item) return
    openModal(
      <AchievementEditor
        achievement={item}
        appId={activeGame.appId}
        isNew
        onSave={handleSave}
        onDelete={() => handleDelete(item.id)}
      />,
    )
  }, [activeGame, create, openModal, handleSave, handleDelete])

  useKeyboardShortcut('ctrl+k', useCallback(() => searchRef.current?.focus(), []))

  if (loading) {
    return <div className="app-loading">{t('common.loading')}</div>
  }

  return (
    <AppShell status={filters.status} setStatus={filters.setStatus}>
      {!activeGame ? (
        <EmptyState
          title={t('guide.empty.noGame.title')}
          hint={t('guide.empty.noGame.hint')}
        />
      ) : (
        <GuideLayout
          search={filters.search}
          setSearch={filters.setSearch}
          searchRef={searchRef}
          onNew={() => void handleNew()}
          groupBy={filters.groupBy}
          setGroupBy={filters.setGroupBy}
          sort={filters.sort}
          setSort={filters.setSort}
          facets={filters.facets}
          setFacets={filters.setFacets}
          facetOptions={filters.facetOptions}
          achievements={achievements}
        >
          <AchievementList
            groups={filters.groups}
            groupBy={filters.groupBy}
            hunt={filters.groupBy === 'queue' ? filters.hunt : undefined}
            onShowAll={() => {
              filters.setGroupBy('flat')
              filters.setStatus('pending')
            }}
            onToggle={(a) => void toggleCompleted(a)}
            onSave={handleSave}
            onDelete={(id) => handleDelete(id)}
          />
        </GuideLayout>
      )}
    </AppShell>
  )
}
