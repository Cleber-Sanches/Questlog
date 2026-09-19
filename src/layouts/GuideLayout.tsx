import type { ReactNode, RefObject } from 'react'
import { useT } from '@/app/providers/LocaleProvider'
import { SearchField } from '@/components/ui/SearchField'
import { Button } from '@/components/ui/Button'
import { GuideShareMenu } from '@/features/guide-io/components/GuideShareMenu'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { HelpButton } from '@/features/settings/components/HelpButton'
import { GameLinksMenu } from '@/features/games/components/GameLinksMenu'
import { ListControls } from '@/features/achievements/components/ListControls'
import { GuideAiChat } from '@/features/ai/components/GuideAiChat'
import { WindowControls } from '@/components/WindowControls'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { SidebarCollapseToggle } from '@/features/sidebar/components/SidebarCollapseToggle'
import type { AchievementSort, GroupBy } from '@/types/achievement'
import type { FacetFilters, FacetOption } from '@/features/achievements/utils/filter'

export function GuideLayout({
  search,
  setSearch,
  searchRef,
  groupBy,
  setGroupBy,
  sort,
  setSort,
  facets,
  setFacets,
  facetOptions,
  onNew,
  children,
}: {
  search: string
  setSearch: (v: string) => void
  searchRef?: RefObject<HTMLInputElement | null>
  onNew?: () => void
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
  children: ReactNode
}) {
  const t = useT()
  const { bind } = useWindowDrag()

  return (
    <div className="guide-layout">
      <section className="guide-main-pane" aria-label={t('guide.pane.aria')}>
        <div className="list-pane-toolbar">
          <div className="list-pane-toolbarTop">
            <div {...bind({ className: 'list-pane-toolbarDrag' })} aria-hidden />
            <div className="list-pane-sidebarToggle">
              <SidebarCollapseToggle variant="toolbar" />
            </div>
            <div className="list-pane-searchSlot">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={t('guide.search.placeholder')}
                inputRef={searchRef}
              />
            </div>
            <WindowControls inline />
          </div>

          <div className="list-pane-toolbarBottom">
            <div className="list-pane-toolbarLeft">
              <ListControls
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                sort={sort}
                setSort={setSort}
                facets={facets}
                setFacets={setFacets}
                facetOptions={facetOptions}
                compact
              />
            </div>
            <div className="list-pane-toolbarRight">
              {onNew ? (
                <Button variant="primary" size="md" onClick={onNew}>
                  {t('guide.newAchievement')}
                </Button>
              ) : null}
              <div className="list-pane-toolbarIcons">
                <GameLinksMenu />
                <HelpButton />
                <NotificationBell />
                <GuideShareMenu />
              </div>
            </div>
          </div>
        </div>

        <div className="list-pane-scroll">{children}</div>
      </section>
      <GuideAiChat />
    </div>
  )
}
