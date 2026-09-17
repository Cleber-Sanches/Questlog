import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Route = 'guide' | 'library' | 'settings' | 'archived'

interface RouterContextValue {
  route: Route
  navigate: (route: Route) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>('library')
  const value = useMemo(() => ({ route, navigate: setRoute }), [route])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter fora do RouterProvider')
  return ctx
}
