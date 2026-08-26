import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AppNotification = {
  id: string
  title: string
  body?: string
  icon?: string | null
  createdAt: number
  read: boolean
}

export type UnlockHistoryInput = {
  id: string
  title: string
  body?: string
  icon?: string | null
  createdAt: number
}

type NotificationContextValue = {
  items: AppNotification[]
  unreadCount: number
  push: (
    input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
      id?: string
      createdAt?: number
    },
  ) => void
  /** Mescla conquistas liberadas no histórico (não marca como não lidas). */
  mergeUnlockHistory: (entries: UnlockHistoryInput[]) => void
  markAllRead: () => void
  clearAll: () => void
}

const STORAGE_KEY = 'guia.notifications.v1'
const MAX_ITEMS = 80

const NotificationContext = createContext<NotificationContextValue | null>(null)

function loadStored(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AppNotification[]
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

function persist(items: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* ignore quota */
  }
}

function sortByDate(items: AppNotification[]) {
  return [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ITEMS)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>(() => loadStored())

  const push = useCallback(
    (
      input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
        id?: string
        createdAt?: number
      },
    ) => {
      const id = input.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setItems((prev) => {
        const without = prev.filter((n) => n.id !== id)
        const nextItem: AppNotification = {
          id,
          title: input.title,
          body: input.body,
          icon: input.icon,
          createdAt: input.createdAt ?? Date.now(),
          read: false,
        }
        const next = sortByDate([nextItem, ...without])
        persist(next)
        return next
      })
    },
    [],
  )

  const mergeUnlockHistory = useCallback((entries: UnlockHistoryInput[]) => {
    if (entries.length === 0) return
    setItems((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]))
      let changed = false
      for (const entry of entries) {
        const existing = map.get(entry.id)
        if (existing) {
          const createdAt = entry.createdAt || existing.createdAt
          if (
            existing.title !== entry.title ||
            existing.icon !== entry.icon ||
            existing.body !== entry.body ||
            existing.createdAt !== createdAt
          ) {
            map.set(entry.id, {
              ...existing,
              title: entry.title,
              body: entry.body ?? existing.body,
              icon: entry.icon ?? existing.icon,
              createdAt,
            })
            changed = true
          }
        } else {
          map.set(entry.id, {
            id: entry.id,
            title: entry.title,
            body: entry.body,
            icon: entry.icon,
            createdAt: entry.createdAt || Date.now(),
            read: true,
          })
          changed = true
        }
      }
      if (!changed) return prev
      const next = sortByDate([...map.values()])
      persist(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      if (prev.every((n) => n.read)) return prev
      const next = prev.map((n) => (n.read ? n : { ...n, read: true }))
      persist(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    persist([])
  }, [])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  const value = useMemo(
    () => ({ items, unreadCount, push, mergeUnlockHistory, markAllRead, clearAll }),
    [items, unreadCount, push, mergeUnlockHistory, markAllRead, clearAll],
  )

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
