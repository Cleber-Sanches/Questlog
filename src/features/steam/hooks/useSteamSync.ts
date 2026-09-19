import { useCallback, useEffect, useRef } from 'react'
import { steamApi } from '@/features/steam/api'
import { useAchievements } from '@/features/achievements/hooks/useAchievements'
import { extractIconHash } from '@/features/achievements/utils/filter'
import { useToast } from '@/app/providers/ToastProvider'
import { useNotifications } from '@/app/providers/NotificationProvider'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useWindowFocus } from '@/hooks/useWindowFocus'
import { showUnlockOverlay } from '@/features/overlay/showUnlockOverlay'
import {
  OVERLAY_PROGRESS_SETTING_KEY,
  OVERLAY_SETTING_KEY,
  OVERLAY_SOUND_PROGRESS_SETTING_KEY,
  OVERLAY_SOUND_SETTING_KEY,
  overlayDifficulty,
  settingEnabled,
  type OverlayChime,
} from '@/features/overlay/types'
import { looksLikeHiddenPlaceholder } from '@/features/achievements/utils/hidden'
import type { MessageKey } from '@/i18n'
import type { Achievement } from '@/types/achievement'
import type { SteamProgressAchievement } from '@/types/steam'

type UnlockedItem = {
  id: number
  title: string
  icon?: string | null
  unlockedAt?: string | null
  difficulty?: Achievement['difficulty']
  missable?: boolean
  progress?: number | null
  progressMax?: number | null
}

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

const SYNC_INTERVAL_MS = 30_000

function normTitle(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findSteamMatch(
  achievement: Achievement,
  byApi: Map<string, { api: string; row: SteamProgressAchievement }>,
  byHash: Map<string, { api: string; row: SteamProgressAchievement }>,
  byTitle: Map<string, { api: string; row: SteamProgressAchievement }>,
) {
  const api = achievement.apiName?.trim()
  if (api) {
    const hit = byApi.get(api.toLowerCase())
    if (hit) return hit
  }
  const hash = extractIconHash(achievement.icon)
  if (hash) {
    const hit = byHash.get(hash)
    if (hit) return hit
  }
  const title = normTitle(achievement.title)
  if (title) {
    const hit = byTitle.get(title)
    if (hit) return hit
  }
  return null
}

function pickProgressTick(ticks: UnlockedItem[]) {
  if (ticks.length === 0) return null
  return ticks.reduce((best, item) => {
    const bestRatio = (best.progress ?? 0) / Math.max(1, best.progressMax ?? 1)
    const ratio = (item.progress ?? 0) / Math.max(1, item.progressMax ?? 1)
    return ratio > bestRatio ? item : best
  })
}

function announceUnlocks(
  unlocked: UnlockedItem[],
  progressTicks: UnlockedItem[],
  source: string | undefined,
  toast: (message: string, kind?: 'info' | 'error' | 'success') => void,
  push: (input: {
    id?: string
    title: string
    body?: string
    icon?: string | null
    createdAt?: number
  }) => void,
  overlay: {
    banner: boolean
    progress: boolean
    sound: boolean
    soundProgress: boolean
  },
  gameName: string,
  t: Translate,
) {
  if (unlocked.length === 0 && progressTicks.length === 0) return
  const via = source === 'community' ? ' (perfil Steam)' : ''
  for (const item of unlocked) {
    const createdAt = item.unlockedAt ? Date.parse(item.unlockedAt) : Date.now()
    push({
      id: `unlock-${item.id}`,
      title: item.title || t('achievement.fallback'),
      body: `Conquista liberada${via}`,
      icon: item.icon,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    })
  }

  if (overlay.banner) {
    if (unlocked.length > 0) {
      const first = unlocked[0]
      const chime: OverlayChime = overlay.sound ? 'unlock' : 'none'
      void showUnlockOverlay(
        unlocked.length === 1
          ? {
              kicker: t('overlay.kicker'),
              title: first.title || t('achievement.fallback'),
              subtitle: gameName,
              icon: first.icon,
              difficulty: overlayDifficulty(first.difficulty),
              missable: Boolean(first.missable),
              progress: first.progressMax ?? first.progress ?? null,
              progressMax: first.progressMax ?? null,
            }
          : {
              kicker: t('overlay.kickerMany', { n: unlocked.length }),
              title: gameName || t('overlay.kicker'),
              subtitle: t('overlay.manyHint', { n: unlocked.length }),
              icon: first.icon,
            },
        chime,
      ).then((ok) => {
        if (!ok) {
          toast(
            unlocked.length === 1
              ? `Conquista salva: ${unlocked[0].title}${via}`
              : `${unlocked.length} conquistas desbloqueadas salvas${via}`,
            'success',
          )
        }
      })
    } else if (overlay.progress) {
      const tick = pickProgressTick(progressTicks)
      if (tick) {
        const chime: OverlayChime =
          overlay.sound && overlay.soundProgress ? 'progress' : 'none'
        void showUnlockOverlay(
          {
            kicker: t('overlay.progress'),
            title: tick.title || t('achievement.fallback'),
            subtitle: gameName,
            icon: tick.icon,
            difficulty: overlayDifficulty(tick.difficulty),
            missable: Boolean(tick.missable),
            progress: tick.progress ?? 0,
            progressMax: tick.progressMax ?? null,
          },
          chime,
        )
      }
    }
  } else if (unlocked.length > 0) {
    toast(
      unlocked.length === 1
        ? `Conquista salva: ${unlocked[0].title}${via}`
        : `${unlocked.length} conquistas desbloqueadas salvas${via}`,
      'success',
    )
  }
}

export function useSteamSync(appId?: string | null) {
  const t = useT()
  const { settings, activeGame } = useAppData()
  const { achievements, replaceAll } = useAchievements(appId)
  const { toast } = useToast()
  const { push } = useNotifications()
  const busy = useRef(false)
  const lastMtime = useRef(0)
  const lastFingerprint = useRef('')
  const achievementsRef = useRef(achievements)
  achievementsRef.current = achievements
  const toastRef = useRef(toast)
  toastRef.current = toast
  const pushRef = useRef(push)
  pushRef.current = push
  const overlayOn = settingEnabled(settings, OVERLAY_SETTING_KEY, true)
  const overlayProgressOn = settingEnabled(settings, OVERLAY_PROGRESS_SETTING_KEY, true)
  const overlaySoundOn = settingEnabled(settings, OVERLAY_SOUND_SETTING_KEY, true)
  const overlaySoundProgressOn = settingEnabled(
    settings,
    OVERLAY_SOUND_PROGRESS_SETTING_KEY,
    false,
  )
  const overlayRef = useRef({
    banner: overlayOn,
    progress: overlayProgressOn,
    sound: overlaySoundOn,
    soundProgress: overlaySoundProgressOn,
  })
  overlayRef.current = {
    banner: overlayOn,
    progress: overlayProgressOn,
    sound: overlaySoundOn,
    soundProgress: overlaySoundProgressOn,
  }
  const gameNameRef = useRef(activeGame?.name ?? '')
  gameNameRef.current = activeGame?.name ?? ''
  const tRef = useRef(t)
  tRef.current = t

  const sync = useCallback(async () => {
    if (!appId || busy.current) {
      return { unlocked: [] as UnlockedItem[], progressTicks: [] as UnlockedItem[], source: '' }
    }

    const current = achievementsRef.current
    // Evita “queimar” o fingerprint com lista vazia (corrida no boot).
    if (current.length === 0) {
      return { unlocked: [] as UnlockedItem[], progressTicks: [] as UnlockedItem[], source: '' }
    }

    busy.current = true
    const skipProgressAnnounce = lastFingerprint.current === ''
    try {
      const progress = await steamApi.progress(appId)
      const unlockedApis = Object.entries(progress.achievements || {})
        .filter(([, p]) => p.completed)
        .map(([api]) => api)
        .sort()
      const progressParts = Object.entries(progress.achievements || {})
        .filter(([, p]) => typeof p.progressMax === 'number' && p.progressMax > 0)
        .map(([api, p]) => `${api}:${p.progress ?? 0}/${p.progressMax}`)
        .sort()
      const descCount = Object.values(progress.achievements || {}).filter(
        (p) => (p.description || p.descriptionEn || '').trim(),
      ).length
      const fingerprint = `${progress.source || 'local'}:${unlockedApis.join('|')}#${progressParts.join('|')}#d${descCount}`

      if (
        fingerprint === lastFingerprint.current &&
        progress.mtimeMs &&
        progress.mtimeMs === lastMtime.current
      ) {
        return {
          unlocked: [] as UnlockedItem[],
          progressTicks: [] as UnlockedItem[],
          source: progress.source || 'local',
        }
      }

      const byApi = new Map<string, { api: string; row: SteamProgressAchievement }>()
      const byHash = new Map<string, { api: string; row: SteamProgressAchievement }>()
      const byTitle = new Map<string, { api: string; row: SteamProgressAchievement }>()

      for (const [api, row] of Object.entries(progress.achievements || {})) {
        const entry = { api, row }
        byApi.set(api.toLowerCase(), entry)
        if (row.iconHash) byHash.set(row.iconHash.toLowerCase(), entry)
        const titleKey = normTitle(row.title)
        if (titleKey) byTitle.set(titleKey, entry)
      }

      let changed = false
      const unlocked: UnlockedItem[] = []
      const progressTicks: UnlockedItem[] = []
      const next: Achievement[] = current.map((a) => {
        const hit = findSteamMatch(a, byApi, byHash, byTitle)
        if (!hit) return a

        let updated: Achievement = a
        let rowChanged = false
        let justUnlocked = false

        if (
          (!a.apiName || a.apiName.startsWith('guia_') || a.apiName.startsWith('unknown_')) &&
          hit.api
        ) {
          updated = { ...updated, apiName: hit.api }
          rowChanged = true
        }

        if (typeof hit.row.hidden === 'boolean' && Boolean(a.hidden) !== hit.row.hidden) {
          updated = { ...updated, hidden: hit.row.hidden }
          rowChanged = true
        }

        const steamDesc = hit.row.description?.trim() || ''
        const steamDescEn = hit.row.descriptionEn?.trim() || ''
        const currentDesc = (updated.description || '').trim()
        if (steamDesc && (!currentDesc || looksLikeHiddenPlaceholder(currentDesc))) {
          updated = { ...updated, description: steamDesc }
          rowChanged = true
        }
        const currentDescEn = (updated.descriptionEn || '').trim()
        if (steamDescEn && (!currentDescEn || looksLikeHiddenPlaceholder(currentDescEn))) {
          updated = { ...updated, descriptionEn: steamDescEn }
          rowChanged = true
        }

        if (hit.row.completed) {
          if (!a.completed) {
            justUnlocked = true
            const unlockedAt = hit.row.unlockedAt || a.unlockedAt || new Date().toISOString()
            unlocked.push({
              id: a.id,
              title: a.title,
              icon: a.icon,
              unlockedAt,
              difficulty: a.difficulty,
              missable: a.missable,
              progress: hit.row.progressMax ?? a.progressMax ?? null,
              progressMax: hit.row.progressMax ?? a.progressMax ?? null,
            })
            updated = {
              ...updated,
              completed: true,
              completedManual: false,
              unlockedAt,
            }
            rowChanged = true
          } else if (!a.unlockedAt && hit.row.unlockedAt) {
            updated = { ...updated, unlockedAt: hit.row.unlockedAt }
            rowChanged = true
          }
        }

        const max = hit.row.progressMax
        if (typeof max === 'number' && max > 0) {
          const cur = typeof hit.row.progress === 'number' ? hit.row.progress : 0
          const prev = typeof a.progress === 'number' ? a.progress : 0
          if (a.progress !== cur || a.progressMax !== max) {
            if (
              !skipProgressAnnounce &&
              !justUnlocked &&
              !hit.row.completed &&
              cur > prev
            ) {
              progressTicks.push({
                id: a.id,
                title: a.title,
                icon: a.icon,
                difficulty: a.difficulty,
                missable: a.missable,
                progress: cur,
                progressMax: max,
              })
            }
            updated = { ...updated, progress: cur, progressMax: max }
            rowChanged = true
          }
        }

        if (rowChanged) changed = true
        return updated
      })

      lastMtime.current = progress.mtimeMs || Date.now()
      lastFingerprint.current = fingerprint

      if (changed) {
        await replaceAll(next)
      }

      return { unlocked, progressTicks, source: progress.source || 'local' }
    } catch {
      return { unlocked: [] as UnlockedItem[], progressTicks: [] as UnlockedItem[], source: '' }
    } finally {
      busy.current = false
    }
  }, [appId, replaceAll])

  const runAndAnnounce = useCallback(() => {
    void sync().then((result) =>
      announceUnlocks(
        result.unlocked,
        result.progressTicks,
        result.source,
        toastRef.current,
        pushRef.current,
        overlayRef.current,
        gameNameRef.current,
        tRef.current,
      ),
    )
  }, [sync])

  // Sync ao abrir o jogo / quando a lista de conquistas fica disponível
  useEffect(() => {
    if (!appId || achievements.length === 0) return
    lastMtime.current = 0
    lastFingerprint.current = ''
    runAndAnnounce()
    const id = window.setInterval(runAndAnnounce, SYNC_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [appId, achievements.length, runAndAnnounce])

  useWindowFocus(runAndAnnounce)
}
