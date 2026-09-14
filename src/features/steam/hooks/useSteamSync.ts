import { useCallback, useEffect, useRef } from 'react'
import { steamApi } from '@/features/steam/api'
import { useAchievements } from '@/features/achievements/hooks/useAchievements'
import { extractIconHash } from '@/features/achievements/utils/filter'
import { useToast } from '@/app/providers/ToastProvider'
import { useNotifications } from '@/app/providers/NotificationProvider'
import { useWindowFocus } from '@/hooks/useWindowFocus'
import type { Achievement } from '@/types/achievement'
import type { SteamProgressAchievement } from '@/types/steam'

type UnlockedItem = {
  id: number
  title: string
  icon?: string | null
  unlockedAt?: string | null
}

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

function announceUnlocks(
  unlocked: UnlockedItem[],
  source: string | undefined,
  toast: (message: string, kind?: 'info' | 'error' | 'success') => void,
  push: (input: {
    id?: string
    title: string
    body?: string
    icon?: string | null
    createdAt?: number
  }) => void,
) {
  if (unlocked.length === 0) return
  const via = source === 'community' ? ' (perfil Steam)' : ''
  for (const item of unlocked) {
    const createdAt = item.unlockedAt ? Date.parse(item.unlockedAt) : Date.now()
    push({
      id: `unlock-${item.id}`,
      title: item.title || 'Conquista desbloqueada',
      body: `Conquista liberada${via}`,
      icon: item.icon,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    })
  }
  toast(
    unlocked.length === 1
      ? `Conquista salva: ${unlocked[0].title}${via}`
      : `${unlocked.length} conquistas desbloqueadas salvas${via}`,
    'success',
  )
}

export function useSteamSync(appId?: string | null) {
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

  const sync = useCallback(async () => {
    if (!appId || busy.current) {
      return { unlocked: [] as UnlockedItem[], source: '' }
    }

    const current = achievementsRef.current
    // Evita “queimar” o fingerprint com lista vazia (corrida no boot).
    if (current.length === 0) {
      return { unlocked: [] as UnlockedItem[], source: '' }
    }

    busy.current = true
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
      const fingerprint = `${progress.source || 'local'}:${unlockedApis.join('|')}#${progressParts.join('|')}`

      if (
        fingerprint === lastFingerprint.current &&
        progress.mtimeMs &&
        progress.mtimeMs === lastMtime.current
      ) {
        return { unlocked: [] as UnlockedItem[], source: progress.source || 'local' }
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
      const next: Achievement[] = current.map((a) => {
        const hit = findSteamMatch(a, byApi, byHash, byTitle)
        if (!hit) return a

        let updated: Achievement = a
        let rowChanged = false

        if (
          (!a.apiName || a.apiName.startsWith('guia_') || a.apiName.startsWith('unknown_')) &&
          hit.api
        ) {
          updated = { ...updated, apiName: hit.api }
          rowChanged = true
        }

        if (hit.row.completed) {
          if (!a.completed) {
            const unlockedAt = hit.row.unlockedAt || a.unlockedAt || new Date().toISOString()
            unlocked.push({
              id: a.id,
              title: a.title,
              icon: a.icon,
              unlockedAt,
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
          if (a.progress !== cur || a.progressMax !== max) {
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

      return { unlocked, source: progress.source || 'local' }
    } catch {
      return { unlocked: [] as UnlockedItem[], source: '' }
    } finally {
      busy.current = false
    }
  }, [appId, replaceAll])

  const runAndAnnounce = useCallback(() => {
    void sync().then((result) =>
      announceUnlocks(result.unlocked, result.source, toastRef.current, pushRef.current),
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
