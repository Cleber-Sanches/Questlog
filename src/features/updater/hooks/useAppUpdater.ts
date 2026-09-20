import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t)
}

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'upToDate' | 'error'

export function useAppUpdater(options?: { autoCheck?: boolean }) {
  const { toast } = useToast()
  const t = useT()
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [currentVersion, setCurrentVersion] = useState('')
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)
  const updateRef = useRef<Update | null>(null)
  const autoChecked = useRef(false)

  useEffect(() => {
    void getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion('0.2.1'))
  }, [])

  const checkForUpdates = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false
      if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
        setPhase('idle')
        return null
      }
      setPhase('checking')
      setError(null)
      try {
        const update = await check()
        if (update) {
          updateRef.current = update
          setAvailableVersion(update.version)
          setNotes(update.body ?? null)
          setPhase('available')
          setLastCheckedAt(Date.now())
          if (!silent) toast(t('settings.update.availableToast', { version: update.version }), 'info')
          return update
        }
        updateRef.current = null
        setAvailableVersion(null)
        setNotes(null)
        setPhase('upToDate')
        setLastCheckedAt(Date.now())
        if (!silent) toast(t('settings.update.upToDate'), 'success')
        return null
      } catch (err) {
        updateRef.current = null
        const msg = String(err)
        setError(msg)
        setPhase('error')
        setLastCheckedAt(Date.now())
        if (!silent) toast(t('settings.update.checkError'), 'error')
        return null
      }
    },
    [t, toast],
  )

  const installUpdate = useCallback(async () => {
    let target = updateRef.current
    if (!target) {
      target = await checkForUpdates({ silent: true })
    }
    if (!target) return

    flushSync(() => {
      setPhase('downloading')
      setProgress(6)
      setError(null)
    })
    await waitForPaint()

    const startedAt = performance.now()
    const MIN_BAR_MS = 900
    let downloaded = 0
    let total = 0
    let actual = 6

    const paintProgress = (value: number) => {
      actual = Math.min(100, Math.max(actual, value))
      setProgress(Math.round(actual))
    }

    try {
      await target.download((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          if (total > 0) {
            paintProgress(Math.min(99, (downloaded / total) * 100))
          } else {
            paintProgress(Math.min(90, actual + 4))
          }
        } else if (event.event === 'Finished') {
          paintProgress(100)
        }
      })

      const elapsed = performance.now() - startedAt
      if (elapsed < MIN_BAR_MS || actual < 100) {
        const from = actual
        const duration = Math.max(280, MIN_BAR_MS - elapsed)
        await new Promise<void>((resolve) => {
          const begin = performance.now()
          const step = (now: number) => {
            const t = Math.min(1, (now - begin) / duration)
            paintProgress(from + (100 - from) * easeOut(t))
            if (t < 1) requestAnimationFrame(step)
            else resolve()
          }
          requestAnimationFrame(step)
        })
      }

      flushSync(() => {
        setProgress(92)
        setPhase('installing')
      })
      await waitForPaint()

      // NSIS roda em /S (quiet) — progresso só na UI do app, como no Setup.
      const installStarted = performance.now()
      const INSTALL_UI_MS = 2800
      const installTick = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - installStarted) / INSTALL_UI_MS)
        paintProgress(92 + easeOut(t) * 7)
      }, 40)

      try {
        await target.install()
      } finally {
        window.clearInterval(installTick)
      }

      paintProgress(100)
      toast(t('settings.update.installed'), 'success')
      await relaunch()
    } catch (err) {
      setError(String(err))
      setPhase('error')
      toast(t('settings.update.installError'), 'error')
    }
  }, [checkForUpdates, t, toast])

  useEffect(() => {
    if (!options?.autoCheck || autoChecked.current) return
    autoChecked.current = true
    const timer = window.setTimeout(() => {
      void checkForUpdates({ silent: true })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [options?.autoCheck, checkForUpdates])

  return {
    phase,
    currentVersion,
    availableVersion,
    notes,
    progress,
    error,
    lastCheckedAt,
    checkForUpdates,
    installUpdate,
  }
}
