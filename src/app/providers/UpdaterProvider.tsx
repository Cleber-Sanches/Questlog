import { createContext, useContext, type ReactNode } from 'react'
import { useAppUpdater } from '@/features/updater/hooks/useAppUpdater'

type UpdaterApi = ReturnType<typeof useAppUpdater>

const UpdaterContext = createContext<UpdaterApi | null>(null)

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const updater = useAppUpdater({ autoCheck: true })
  return <UpdaterContext.Provider value={updater}>{children}</UpdaterContext.Provider>
}

export function useUpdater() {
  const ctx = useContext(UpdaterContext)
  if (!ctx) throw new Error('useUpdater fora do UpdaterProvider')
  return ctx
}
