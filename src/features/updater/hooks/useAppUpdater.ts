import { useCallback, useEffect, useRef, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'

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
          if (!silent) toast(t('settings.update.availableToast', { version: update.version }), 'info')
          return update
        }
        updateRef.current = null
        setAvailableVersion(null)
        setNotes(null)
        setPhase('upToDate')
        if (!silent) toast(t('settings.update.upToDate'), 'success')
        return null
      } catch (err) {
        updateRef.current = null
        const msg = String(err)
        setError(msg)
        setPhase('error')
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

    setPhase('downloading')
    setProgress(0)
    setError(null)
    try {
      let downloaded = 0
      let total = 0
      await target.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          if (total > 0) setProgress(Math.min(100, Math.round((downloaded / total) * 100)))
        } else if (event.event === 'Finished') {
          setProgress(100)
          setPhase('installing')
        }
      })
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
    checkForUpdates,
    installUpdate,
  }
}
