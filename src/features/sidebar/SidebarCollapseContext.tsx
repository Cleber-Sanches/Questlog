import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const SIDEBAR_COLLAPSED_KEY = 'guia.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

type SidebarCollapseContextValue = {
  collapsed: boolean
  toggleCollapsed: () => void
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null)

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => !v)
  }, [])

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed],
  )

  return (
    <SidebarCollapseContext.Provider value={value}>
      {children}
    </SidebarCollapseContext.Provider>
  )
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext)
  if (!ctx) {
    throw new Error('useSidebarCollapse must be used within SidebarCollapseProvider')
  }
  return ctx
}
