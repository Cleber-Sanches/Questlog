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
      setAchievementsLocal(appId, items)
      await achievementsApi.setAll(appId, items)
    },
    [appId, setAchievementsLocal],
  )

  const create = useCallback(
    async (partial?: Partial<Achievement>) => {
      if (!appId) return null
      const id = Math.max(0, ...achievements.map((a) => a.id)) + 1
      const item: Achievement = {
        id,
        title: partial?.title || t('achievement.new'),
        description: partial?.description || '',
        apiName: partial?.apiName || `custom_${id}`,
        icon: partial?.icon || '',
        group: partial?.group || ACH_KEYS.GROUP_NONE,
        dlc: partial?.dlc || ACH_KEYS.DLC_BASE,
        tips: '',
        videoUrl: '',
        guideUrl: '',
        completed: false,
        missable: false,
        ...partial,
      }
      const next = [...achievements, item]
      setAchievementsLocal(appId, next)
      await achievementsApi.insert(appId, item)
      return item
    },
    [appId, achievements, setAchievementsLocal, t],
  )

  const remove = useCallback(
    async (id: number) => {
      if (!appId) return
      const next = achievements.filter((a) => a.id !== id)
      setAchievementsLocal(appId, next)
      await achievementsApi.remove(appId, id)
    },
    [appId, achievements, setAchievementsLocal],
  )

  return { achievements, patch, toggleCompleted, replaceAll, create, remove }
}
