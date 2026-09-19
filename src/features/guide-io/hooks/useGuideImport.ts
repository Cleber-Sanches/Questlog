import { createElement, useCallback } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useRouter } from '@/app/router'
import { useModal } from '@/app/providers/ModalProvider'
import { achievementsApi } from '@/features/achievements/api'
import { steamApi } from '@/features/steam/api'
import { gamesApi } from '@/features/games/api'
import { achievementsFromGuidePack, applyGuideEntries } from '../utils/normalize'
import { parseGuidePack, summarizeGuidePack } from '../utils/parsePack'
import { readClipboard } from '@/lib/clipboard'
import { GuideImportPreview } from '../components/GuideImportPreview'
import type { GuidePack } from '@/types/backup'

export function useGuideImport() {
  const { activeGame, achievements, upsertGameLocal, setActiveGame, setAchievementsLocal, refresh } =
    useAppData()
  const { toast } = useToast()
  const { navigate } = useRouter()
  const { openModal } = useModal()
  const t = useT()

  const applyGuidePack = useCallback(
    async (pack: GuidePack) => {
      const appId = String(pack.game?.appId || activeGame?.appId || '')
      if (!appId) throw new Error('no-app')

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
          hidden: Boolean(a.hidden),
        }))
      }

      const entries = pack.achievements || []
      const merged = current.length
        ? applyGuideEntries(current, entries, appId)
        : achievementsFromGuidePack(appId, entries)

      if (!merged.length) throw new Error('empty')

      setAchievementsLocal(appId, merged)
      await achievementsApi.setAll(appId, merged)
      await refresh()
      navigate('guide')
      toast(t('toast.guide.imported', { n: merged.length }), 'success')
    },
    [
      activeGame,
      achievements,
      upsertGameLocal,
      setActiveGame,
      setAchievementsLocal,
      refresh,
      navigate,
      toast,
      t,
    ],
  )

  const showImportError = useCallback(
    (err: unknown) => {
      const code = err instanceof Error ? err.message : ''
      if (code === 'invalid') toast(t('toast.guide.invalid'), 'error')
      else if (code === 'no-app') toast(t('toast.guide.noAppId'), 'error')
      else if (code === 'empty') toast(t('toast.guide.empty'), 'error')
      else toast(String(err), 'error')
    },
    [t, toast],
  )

  const importGuideText = useCallback(
    (text: string) => {
      try {
        const pack = parseGuidePack(text)
        const appId = String(pack.game?.appId || activeGame?.appId || '')
        if (!appId) throw new Error('no-app')
        if (!(pack.achievements || []).length) throw new Error('empty')
        const summary = summarizeGuidePack(pack, activeGame?.appId)
        openModal(
          createElement(GuideImportPreview, {
            summary,
            onConfirm: async () => {
              try {
                await applyGuidePack(pack)
              } catch (err) {
                showImportError(err)
                throw err
              }
            },
          }),
        )
      } catch (err) {
        showImportError(err)
      }
    },
    [activeGame?.appId, applyGuidePack, openModal, showImportError],
  )

  const importGuide = useCallback(
    async (file: File) => {
      const text = await file.text()
      importGuideText(text)
    },
    [importGuideText],
  )

  const importGuideFromClipboard = useCallback(async () => {
    try {
      const text = await readClipboard()
      if (!text.trim()) {
        toast(t('toast.guide.clipboardEmpty'), 'error')
        return
      }
      importGuideText(text)
    } catch {
      toast(t('toast.guide.clipboardFail'), 'error')
    }
  }, [importGuideText, t, toast])

  return { importGuide, importGuideText, importGuideFromClipboard }
}
