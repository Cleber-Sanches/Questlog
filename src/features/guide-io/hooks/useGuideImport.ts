import { useCallback } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { achievementsApi } from '@/features/achievements/api'
import { steamApi } from '@/features/steam/api'
import { gamesApi } from '@/features/games/api'
import { achievementsFromGuidePack, applyGuideEntries } from '../utils/normalize'
import { isGuidePackType } from '@/features/backup/packTypes'
import type { GuidePack } from '@/types/backup'

export function useGuideImport() {
  const { activeGame, achievements, upsertGameLocal, setActiveGame, setAchievementsLocal, refresh } =
    useAppData()
  const { toast } = useToast()

  const importGuide = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const pack = JSON.parse(text) as GuidePack
        if (!isGuidePackType(pack.type)) {
          throw new Error('Arquivo não é um guia válido')
        }
        const appId = String(pack.game?.appId || activeGame?.appId || '')
        if (!appId) throw new Error('Guia sem appId')

        let game = activeGame
        if (!game || game.appId !== appId) {
          const icon = await steamApi.clientIcon(appId)
          game = {
            appId,
            name: pack.game.name || icon.name || appId,
            image: icon.image,
            icon: icon.icon,
            clienticon: icon.clienticon,
            archived: false,
            links: (pack.game.links || []).map((l, i) => ({
              id: `link_${i}`,
              label: l.label,
              url: l.url,
            })),
          }
          await gamesApi.upsert(game)
          upsertGameLocal(game)
          await setActiveGame(appId)
        } else if (game && (pack.game.links || []).length) {
          const current = game
          const next = {
            ...current,
            links: (pack.game.links || []).map((l, i) => ({
              id: current.links?.[i]?.id ?? `link_${i}`,
              label: l.label,
              url: l.url,
            })),
          }
          await gamesApi.upsert(next)
          upsertGameLocal(next)
        }

        let current = activeGame?.appId === appId ? achievements : []
        if (!current.length) {
          const imported = await steamApi.achievements(appId).catch(() => null)
          current = (imported?.achievements || []).map((a) => ({
            id: a.id,
            apiName: a.apiName,
            title: a.title,
            description: a.description,
            icon: a.icon,
            globalPercent: a.globalPercent,
            group: a.group,
            dlc: a.dlc,
            tips: a.tips,
            videoUrl: a.videoUrl,
            guideUrl: a.guideUrl,
            completed: false,
          }))
        }

        const entries = pack.achievements || []
        const merged = current.length
          ? applyGuideEntries(current, entries, appId)
          : achievementsFromGuidePack(appId, entries)

        if (!merged.length) throw new Error('O guia não contém conquistas')

        setAchievementsLocal(appId, merged)
        await achievementsApi.setAll(appId, merged)
        await refresh()
        toast(`Guia importado (${merged.length} conquistas)`, 'success')
      } catch (err) {
        toast(String(err), 'error')
      }
    },
    [
      activeGame,
      achievements,
      upsertGameLocal,
      setActiveGame,
      setAchievementsLocal,
      refresh,
      toast,
    ],
  )

  return { importGuide }
}
