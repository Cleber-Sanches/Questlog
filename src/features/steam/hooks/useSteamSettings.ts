import { useCallback, useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { steamApi } from '@/features/steam/api'
import type { SteamSettingsStatus } from '@/types/steam'
import { useToast } from '@/app/providers/ToastProvider'

export function useSteamSettings() {
  const { toast } = useToast()
  const [status, setStatus] = useState<SteamSettingsStatus>({})
  const [ready, setReady] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await steamApi.settings())
    } catch {
      /* ignore in web preview */
    }
  }, [])

  useEffect(() => {
    void refreshStatus().finally(() => setReady(true))
  }, [refreshStatus])

  const chooseInstallDir = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (!selected || Array.isArray(selected)) return
      await steamApi.setInstallDir(selected)
      toast('Pasta da Steam configurada', 'success')
      await refreshStatus()
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [toast, refreshStatus])

  const clearInstallDir = useCallback(async () => {
    try {
      await steamApi.setInstallDir('')
      await refreshStatus()
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [toast, refreshStatus])

  return { status, ready, chooseInstallDir, clearInstallDir, refreshStatus }
}
