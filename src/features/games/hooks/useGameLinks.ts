import { useCallback } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { gamesApi } from '@/features/games/api'
import { defaultGameLinks, mergePresetLinks } from '@/features/games/utils/links'
import { normalizeExternalUrl } from '@/lib/url'
import type { Game, GameLink } from '@/types/game'

export function useGameLinks(game: Game | null) {
  const { upsertGameLocal } = useAppData()
  const { toast } = useToast()
  const t = useT()

  const save = useCallback(
    async (links: GameLink[]) => {
      if (!game) return false
      const incomplete = links.some((l) => {
        const label = l.label.trim()
        const url = normalizeExternalUrl(l.url)
        return Boolean(label) !== Boolean(url)
      })
      if (incomplete) {
        toast(t('game.links.invalid'), 'error')
        return false
      }
      const cleaned = links
        .map((l) => ({
          ...l,
          label: l.label.trim(),
          url: normalizeExternalUrl(l.url),
        }))
        .filter((l) => l.label && l.url)
      const next = { ...game, links: cleaned }
      try {
        await gamesApi.upsert(next)
        upsertGameLocal(next)
        toast(t('game.links.saved'), 'success')
        return true
      } catch (err) {
        toast(String(err), 'error')
        return false
      }
    },
    [game, toast, t, upsertGameLocal],
  )

  const seedDefaults = useCallback(async () => {
    if (!game) return false
    return save(mergePresetLinks(game.links ?? [], defaultGameLinks(game.appId)))
  }, [game, save])

  return { save, seedDefaults, links: game?.links ?? [] }
}
