import { useMemo, type ReactElement, type ReactNode } from 'react'
import { GameSwitcher } from '@/features/games/components/GameSwitcher'
import { useProfileBackup } from '@/features/backup/hooks/useProfileBackup'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useRouter } from '@/app/router'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { countByStatus } from '@/features/achievements/utils/filter'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from '@/features/sidebar/SidebarCollapseContext'
import { SidebarCollapseToggle } from '@/features/sidebar/components/SidebarCollapseToggle'
import type { MessageKey } from '@/i18n'
import type { StatusFilter } from '@/types/achievement'

const STATUS_NAV: Array<{
  id: StatusFilter
  labelKey: MessageKey
  icon: string
}> = [
  { id: 'all', labelKey: 'nav.all', icon: 'ph-duotone ph-squares-four' },
  { id: 'completed', labelKey: 'nav.completed', icon: 'ph-duotone ph-check-circle' },
  { id: 'pending', labelKey: 'nav.pending', icon: 'ph-duotone ph-circle-dashed' },
]

function SidebarTip({
  collapsed,
  label,
  detail,
  children,
}: {
  collapsed: boolean
  label: string
  detail?: string
  children: ReactElement
}) {
  if (!collapsed) return children
  return (
    <Tooltip
      side="right"
      delay={80}
      wrapperClassName="sidebarTipWrap"
      className="sidebarTipBubble"
      content={
        <span className="sidebarTip">
          <span className="sidebarTipTitle">{label}</span>
          {detail ? <span className="sidebarTipDetail">{detail}</span> : null}
        </span>
      }
    >
      {children}
    </Tooltip>
  )
}

export function AppShell({
  children,
  status,
  setStatus,
}: {
  children: ReactNode
  status: StatusFilter
  setStatus: (s: StatusFilter) => void
}) {
  return (
    <SidebarCollapseProvider>
      <AppShellInner status={status} setStatus={setStatus}>
        {children}
      </AppShellInner>
    </SidebarCollapseProvider>
  )
}

function AppShellInner({
  children,
  status,
  setStatus,
}: {
  children: ReactNode
  status: StatusFilter
  setStatus: (s: StatusFilter) => void
}) {
  const { achievements, games } = useAppData()
  const { navigate, route } = useRouter()
  const { exportProfile } = useProfileBackup()
  const t = useT()
  const counts = useMemo(() => countByStatus(achievements), [achievements])
  const archivedCount = useMemo(() => games.filter((g) => g.archived).length, [games])
  const libraryCount = useMemo(() => games.filter((g) => !g.archived).length, [games])
  const { bind } = useWindowDrag()
  const libraryActive = route === 'library'
  const archivedActive = route === 'archived'
  const settingsActive = route === 'settings'
  const onGuide = route === 'guide'
  const { collapsed } = useSidebarCollapse()
  const showSidebarCollapseBtn = collapsed

  return (
    <div className={`app-shell${collapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside
        {...bind({
          className: `sidebar${collapsed ? ' is-collapsed' : ''}`,
        })}
      >
        <div className="sidebar-topBlock">
          <GameSwitcher collapsed={collapsed} />
          {showSidebarCollapseBtn ? (
            <SidebarTip collapsed={collapsed} label={collapsed ? t('nav.expand') : t('nav.collapse')}>
              <SidebarCollapseToggle variant="sidebar" />
            </SidebarTip>
          ) : null}
        </div>

        <div className="sidebar-section">
          {!collapsed ? (
            <div className="sidebar-sectionLabel">{t('nav.section.achievements')}</div>
          ) : null}
          <nav className="sidebar-nav" aria-label={t('nav.filterAchievements')}>
            {STATUS_NAV.map((item) => {
              const label = t(item.labelKey)
              return (
                <SidebarTip
                  key={item.id}
                  collapsed={collapsed}
                  label={label}
                  detail={t('nav.count.achievements', { n: counts[item.id] })}
                >
                  <button
                    type="button"
                    className={`sidebar-navItem${onGuide && status === item.id ? ' isActive' : ''}`}
                    aria-label={label}
                    onClick={() => setStatus(item.id)}
                  >
                    <i className={item.icon} aria-hidden />
                    <span className="sidebar-navLabel">{label}</span>
                    <span className="sidebar-navCount">{counts[item.id]}</span>
                  </button>
                </SidebarTip>
              )
            })}
          </nav>
        </div>

        <div className="sidebar-section sidebar-sectionSpaced">
          {!collapsed ? (
            <div className="sidebar-sectionLabel">{t('nav.section.library')}</div>
          ) : null}
          <nav className="sidebar-nav" aria-label={t('nav.section.library')}>
            <SidebarTip
              collapsed={collapsed}
              label={t('nav.library')}
              detail={
                libraryCount > 0
                  ? `${libraryCount} ${libraryCount === 1 ? t('nav.count.game') : t('nav.count.games')}`
                  : t('nav.library.empty')
              }
            >
              <button
                type="button"
                className={`sidebar-navItem${libraryActive ? ' isActive' : ''}`}
                aria-label={t('nav.library')}
                onClick={() => navigate('library')}
              >
                <i className="ph-duotone ph-game-controller" aria-hidden />
                <span className="sidebar-navLabel">{t('nav.library')}</span>
                {libraryCount > 0 ? (
                  <span className="sidebar-navCount">{libraryCount}</span>
                ) : null}
              </button>
            </SidebarTip>
            <SidebarTip
              collapsed={collapsed}
              label={t('nav.archived')}
              detail={
                archivedCount > 0
                  ? `${archivedCount} ${archivedCount === 1 ? t('nav.count.game') : t('nav.count.games')}`
                  : t('nav.archived.empty')
              }
            >
              <button
                type="button"
                className={`sidebar-navItem${archivedActive ? ' isActive' : ''}`}
                aria-label={t('nav.archived')}
                onClick={() => navigate('archived')}
              >
                <i className="ph-duotone ph-archive" aria-hidden />
                <span className="sidebar-navLabel">{t('nav.archived')}</span>
                {archivedCount > 0 ? (
                  <span className="sidebar-navCount">{archivedCount}</span>
                ) : null}
              </button>
            </SidebarTip>
          </nav>
        </div>

        <div className="sidebar-footer">
          <SidebarTip collapsed={collapsed} label={t('nav.settings')}>
            <button
              type="button"
              className={`sidebar-navItem sidebar-footerItem${settingsActive ? ' isActive' : ''}`}
              aria-label={t('nav.settings')}
              onClick={() => navigate('settings')}
            >
              <i className="ph-duotone ph-gear-six" aria-hidden />
              <span className="sidebar-navLabel">{t('nav.settings')}</span>
            </button>
          </SidebarTip>
          <SidebarTip collapsed={collapsed} label={t('nav.exportBackup')}>
            <button
              type="button"
              className="sidebar-navItem sidebar-footerItem"
              aria-label={t('nav.exportBackup')}
              onClick={() => void exportProfile()}
            >
              <i className="ph-duotone ph-cloud-arrow-down" aria-hidden />
              <span className="sidebar-navLabel">{t('nav.exportBackup')}</span>
            </button>
          </SidebarTip>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  )
}
