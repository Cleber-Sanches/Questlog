import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { invoke } from '@/lib/invoke'
import { gamesApi } from '@/features/games/api'
import type { Game } from '@/types/game'
import type { Achievement } from '@/types/achievement'
import { useToast } from './ToastProvider'

interface Bootstrap {
  games: Game[]
  activeGameAppId?: string | null
  achievementsByAppId: Record<string, Achievement[]>
  collapsedSections: Record<string, boolean>
  settings: Record<string, string>
}

interface AppDataContextValue {
  loading: boolean
  games: Game[]
  activeGame: Game | null
  achievements: Achievement[]
  achievementsByAppId: Record<string, Achievement[]>
  collapsedSections: Record<string, boolean>
  settings: Record<string, string>
  refresh: () => Promise<void>
  setActiveGame: (appId: string) => Promise<void>
  setAchievementsLocal: (
    appId: string,
    items: Achievement[] | ((prev: Achievement[]) => Achievement[]),
  ) => void
  setSetting: (key: string, value: string) => Promise<void>
  upsertGameLocal: (game: Game) => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

async function loadBootstrap(retries = 3): Promise<Bootstrap> {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      return await invoke<Bootstrap>('db_get_bootstrap')
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 200 * (i + 1)))
    }
  }
  throw lastErr
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<Game[]>([])
  const [activeGameAppId, setActiveGameAppId] = useState<string | null>(null)
  const [achievementsByAppId, setAchievementsByAppId] = useState<Record<string, Achievement[]>>({})
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [settings, setSettings] = useState<Record<string, string>>({})

  const applyBootstrap = useCallback((data: Bootstrap) => {
    setGames(data.games ?? [])
    setActiveGameAppId(data.activeGameAppId ?? null)
    setAchievementsByAppId(data.achievementsByAppId ?? {})
    setCollapsedSections(data.collapsedSections ?? {})
    setSettings(data.settings ?? {})
  }, [])

  const refresh = useCallback(async () => {
    let data = await loadBootstrap()
    // Banco vazio após update? tenta o backup automático mais recente.
    if ((data.games ?? []).length === 0) {
      try {
        const restored = await invoke<boolean>('backup_restore_latest_if_empty')
        if (restored) {
          data = await loadBootstrap()
          toast('Guias restaurados do backup automático.', 'success')
        }
      } catch {
        // ignora — usuário pode restaurar manualmente
      }
    }
    applyBootstrap(data)
  }, [applyBootstrap, toast])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refresh()
      } catch (err: unknown) {
        if (!cancelled) toast(String(err), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, toast])

  const setActiveGame = useCallback(async (appId: string) => {
    await gamesApi.setActive(appId)
    setActiveGameAppId(appId)
  }, [])

  const setAchievementsLocal = useCallback(
    (appId: string, items: Achievement[] | ((prev: Achievement[]) => Achievement[])) => {
      setAchievementsByAppId((prev) => {
        const current = prev[appId] ?? []
        const next = typeof items === 'function' ? items(current) : items
        return { ...prev, [appId]: next }
      })
    },
    [],
  )

  const setSetting = useCallback(async (key: string, value: string) => {
    await invoke<void>('db_set_setting', { key, value })
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const upsertGameLocal = useCallback((game: Game) => {
    setGames((prev) => {
      const idx = prev.findIndex((g) => g.appId === game.appId)
      if (idx === -1) return [...prev, game].sort((a, b) => a.name.localeCompare(b.name))
      const next = [...prev]
      next[idx] = game
      return next
    })
  }, [])

  const activeGame = useMemo(
    () => games.find((g) => g.appId === activeGameAppId) ?? games.find((g) => !g.archived) ?? null,
    [games, activeGameAppId],
  )

  const achievements = useMemo(
    () => (activeGame ? achievementsByAppId[activeGame.appId] ?? [] : []),
    [achievementsByAppId, activeGame],
  )

  const value = useMemo(
    () => ({
      loading,
      games,
      activeGame,
      achievements,
      achievementsByAppId,
      collapsedSections,
      settings,
      refresh,
      setActiveGame,
      setAchievementsLocal,
      setSetting,
      upsertGameLocal,
    }),
    [
      loading,
      games,
      activeGame,
      achievements,
      achievementsByAppId,
      collapsedSections,
      settings,
      refresh,
      setActiveGame,
      setAchievementsLocal,
      setSetting,
      upsertGameLocal,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData fora do AppDataProvider')
  return ctx
}
