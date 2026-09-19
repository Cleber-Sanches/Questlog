import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SettingsSectionId } from '@/features/settings/sections'

export type Route = 'guide' | 'library' | 'settings' | 'archived'

type NavigateOpts = {
  settingsSection?: SettingsSectionId
}

interface RouterContextValue {
  route: Route
  settingsSection: SettingsSectionId
  navigate: (route: Route, opts?: NavigateOpts) => void
  setSettingsSection: (id: SettingsSectionId) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>('library')
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('ai')
  const navigate = useCallback((next: Route, opts?: NavigateOpts) => {
    setRoute(next)
    if (opts?.settingsSection) setSettingsSection(opts.settingsSection)
  }, [])
  const value = useMemo(
    () => ({ route, settingsSection, navigate, setSettingsSection }),
    [route, settingsSection, navigate],
  )
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter fora do RouterProvider')
  return ctx
}
