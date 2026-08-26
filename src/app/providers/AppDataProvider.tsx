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
  setAchievementsLocal: (appId: string, items: Achievement[]) => void
  setSetting: (key: string, value: string) => Promise<void>
  upsertGameLocal: (game: Game) => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<Game[]>([])
  const [activeGameAppId, setActiveGameAppId] = useState<string | null>(null)
  const [achievementsByAppId, setAchievementsByAppId] = useState<Record<string, Achievement[]>>({})
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [settings, setSettings] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    const data = await invoke<Bootstrap>('db_get_bootstrap')
    setGames(data.games ?? [])
    setActiveGameAppId(data.activeGameAppId ?? null)
    setAchievementsByAppId(data.achievementsByAppId ?? {})
    setCollapsedSections(data.collapsedSections ?? {})
    setSettings(data.settings ?? {})
  }, [])

  useEffect(() => {
    refresh()
      .catch((err: unknown) => toast(String(err), 'error'))
      .finally(() => setLoading(false))
  }, [refresh, toast])

  const setActiveGame = useCallback(
    async (appId: string) => {
      await gamesApi.setActive(appId)
      setActiveGameAppId(appId)
    },
    [],
  )

  const setAchievementsLocal = useCallback((appId: string, items: Achievement[]) => {
    setAchievementsByAppId((prev) => ({ ...prev, [appId]: items }))
  }, [])

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
