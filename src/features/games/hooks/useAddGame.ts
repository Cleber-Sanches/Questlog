import { useCallback, useState } from 'react'
import { steamApi } from '@/features/steam/api'
import { gamesApi } from '@/features/games/api'
import { achievementsApi } from '@/features/achievements/api'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import type { Game } from '@/types/game'
import type { Achievement } from '@/types/achievement'
import type { SteamSearchItem } from '@/types/steam'
import { ACH_KEYS } from '@/features/achievements/utils/keys'
import { isStoreCoverUrl } from '@/lib/gameImages'

export function useAddGame() {
  const { upsertGameLocal, setAchievementsLocal, setActiveGame, refresh } = useAppData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const addGame = useCallback(
    async (item: SteamSearchItem) => {
      setBusy(true)
      try {
        const art = await steamApi.clientIcon(item.appId)
        const cover = art.cover || (isStoreCoverUrl(item.image) ? item.image : '') || art.image
        const game: Game = {
          appId: item.appId,
          name: item.name,
          image: cover,
          icon: art.icon || null,
          clienticon: art.clienticon || null,
          archived: false,
          links: [],
        }
        await gamesApi.upsert(game)
        upsertGameLocal(game)

        const imported = await steamApi.achievements(item.appId)
        if (imported.error) throw new Error(imported.error)
        const achievements: Achievement[] = (imported.achievements || []).map((a) => ({
          id: a.id,
          apiName: a.apiName,
          title: a.title,
          description: a.description,
          titleEn: a.titleEn || '',
          descriptionEn: a.descriptionEn || '',
          icon: a.icon,
          globalPercent: a.globalPercent,
          group: a.group || ACH_KEYS.GROUP_NONE,
          dlc: a.dlc || ACH_KEYS.DLC_BASE,
          tips: a.tips || '',
          videoUrl: a.videoUrl || '',
          guideUrl: a.guideUrl || '',
          completed: false,
          missable: false,
        }))
        await achievementsApi.setAll(item.appId, achievements)
        setAchievementsLocal(item.appId, achievements)
        await setActiveGame(item.appId)
        toast(`${item.name} adicionado`, 'success')
        await refresh()
        return true
      } catch (err) {
        toast(String(err), 'error')
        return false
      } finally {
        setBusy(false)
      }
    },
    [upsertGameLocal, setAchievementsLocal, setActiveGame, refresh, toast],
  )

  return { addGame, busy }
}
