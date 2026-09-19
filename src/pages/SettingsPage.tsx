import { useEffect, useState } from 'react'
import { useRouter } from '@/app/router'
import { useT } from '@/app/providers/LocaleProvider'
import { AppShell } from '@/layouts/AppShell'
import { ChromeActions } from '@/layouts/ChromeActions'
import { SidebarCollapseToggle } from '@/features/sidebar/components/SidebarCollapseToggle'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import {
  SETTINGS_ITEMS,
  groupSettingsItems,
  type SettingsSectionId,
} from '@/features/settings/sections'
import { BackupSettingsPanel } from '@/features/settings/panels/BackupSettingsPanel'
import { AiSettingsPanel } from '@/features/settings/panels/AiSettingsPanel'
import { SteamSettingsPanel } from '@/features/settings/panels/SteamSettingsPanel'
import { LanguageSettingsPanel } from '@/features/settings/panels/LanguageSettingsPanel'
import { UpdateSettingsPanel } from '@/features/settings/panels/UpdateSettingsPanel'
import { HelpSettingsPanel } from '@/features/settings/panels/HelpSettingsPanel'
import type { StatusFilter } from '@/types/achievement'

function renderPanel(id: SettingsSectionId) {
  switch (id) {
    case 'update':
      return <UpdateSettingsPanel />
    case 'backup':
      return <BackupSettingsPanel />
    case 'ai':
      return <AiSettingsPanel />
    case 'steam':
      return <SteamSettingsPanel />
    case 'language':
      return <LanguageSettingsPanel />
    case 'help':
      return <HelpSettingsPanel />
    default:
      return null
  }
}

const groups = groupSettingsItems(SETTINGS_ITEMS)

export function SettingsPage() {
  const { navigate, settingsSection, setSettingsSection } = useRouter()
  const { bind } = useWindowDrag()
  const t = useT()
  const [status, setStatus] = useState<StatusFilter>('all')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('guide')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <AppShell
      status={status}
      setStatus={(s) => {
        setStatus(s)
        navigate('guide')
      }}
    >
      <div className="settings-layout">
        <section className="settings-pane" aria-label={t('settings.nav.aria')}>
          <header className="settingsHero">
            <SidebarCollapseToggle variant="toolbar" />
            <div {...bind({ className: 'settingsHeroDrag' })} aria-hidden />
            <ChromeActions />
          </header>

          <div className="settingsBody">
            <nav className="settingsNav" aria-label={t('settings.nav.aria')}>
              {groups.map((group) => (
                <div key={group.groupKey} className="settingsNavGroup">
                  <div className="settingsNavGroupLabel">{t(group.groupKey)}</div>
                  {group.items.map((item) => {
                    const active = settingsSection === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`settingsNavItem${active ? ' is-active' : ''}`}
                        onClick={() => setSettingsSection(item.id)}
                        aria-current={active ? 'page' : undefined}
                      >
                        <i className={item.icon} aria-hidden />
                        <span className="settingsNavItemLabel">{t(item.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>

            <div className="settingsMain" key={settingsSection}>
              {renderPanel(settingsSection)}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
