import { useCallback } from 'react'
import { achievementsApi } from '@/features/achievements/api'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'
import type { Achievement } from '@/types/achievement'
import { ACH_KEYS } from '@/features/achievements/utils/keys'

export function useAchievements(appId?: string | null) {
  const { achievements, setAchievementsLocal, refresh } = useAppData()
  const { toast } = useToast()
  const t = useT()

  const patch = useCallback(
    async (achievement: Achievement) => {
      if (!appId) return
      const next = achievements.map((a) => (a.id === achievement.id ? achievement : a))
      setAchievementsLocal(appId, next)
      try {
        await achievementsApi.patch(appId, achievement)
      } catch (err) {
        toast(String(err), 'error')
        await refresh()
      }
    },
    [appId, achievements, setAchievementsLocal, toast, refresh],
  )

  const toggleCompleted = useCallback(
    async (achievement: Achievement) => {
      const completed = !achievement.completed
      await patch({
        ...achievement,
        completed,
        completedManual: completed ? true : achievement.completedManual,
        unlockedAt: completed ? achievement.unlockedAt || new Date().toISOString() : null,
      })
    },
    [patch],
  )

  const replaceAll = useCallback(
    async (items: Achievement[]) => {
      if (!appId) return
      const isCustom = (a: Achievement) => {
        const api = (a.apiName || '').trim().toLowerCase()
        return api.startsWith('custom_') || api.startsWith('guia_')
      }
      let merged = items
      setAchievementsLocal(appId, (prev) => {
        const ids = new Set(items.map((i) => i.id))
        const keep = prev.filter((a) => isCustom(a) && !ids.has(a.id))
        merged = keep.length ? [...items, ...keep] : items
        return merged
      })
      await achievementsApi.setAll(appId, merged)
    },
    [appId, setAchievementsLocal],
  )

  const create = useCallback(
    async (partial?: Partial<Achievement>) => {
      if (!appId) return null
      const draft: Achievement = {
        title: partial?.title || t('achievement.new'),
        description: partial?.description || '',
        apiName: partial?.apiName || 'custom_pending',
        icon: partial?.icon || '',
        group: partial?.group || ACH_KEYS.GROUP_NONE,
        dlc: partial?.dlc || ACH_KEYS.DLC_BASE,
        tips: '',
        videoUrl: '',
        guideUrl: '',
        completed: false,
        missable: false,
        ...partial,
        // ID final vem do SQLite; 0 força insert novo (não reaproveitar id do partial).
        id: 0,
      }
      try {
        const created = await achievementsApi.insert(appId, draft)
        setAchievementsLocal(appId, (current) => {
          if (current.some((a) => a.id === created.id)) return current
          return [...current, created]
        })
        return created
      } catch (err) {
        toast(String(err), 'error')
        await refresh()
        return null
      }
    },
    [appId, setAchievementsLocal, t, toast, refresh],
  )

  const remove = useCallback(
    async (id: number) => {
      if (!appId) return
      setAchievementsLocal(appId, (current) => current.filter((a) => a.id !== id))
      try {
        await achievementsApi.remove(appId, id)
      } catch (err) {
        toast(String(err), 'error')
        await refresh()
      }
    },
    [appId, setAchievementsLocal, toast, refresh],
  )

  return { achievements, patch, toggleCompleted, replaceAll, create, remove }
}
