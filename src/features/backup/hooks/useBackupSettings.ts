import { useCallback, useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { backupApi } from '@/features/backup/api'
import type { BackupStatus } from '@/types/backup'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'

export function useBackupSettings() {
  const { toast } = useToast()
  const t = useT()
  const [status, setStatus] = useState<BackupStatus>({})

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await backupApi.status())
    } catch {
      /* ignore in web preview */
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const backupNow = useCallback(async () => {
    try {
      const info = await backupApi.now()
      toast(t('settings.backup.local.saved', { path: info.path }), 'success')
      await refreshStatus()
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [t, toast, refreshStatus])

  const chooseExternalDir = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (!selected || Array.isArray(selected)) return
      await backupApi.setExternalDir(selected)
      toast(t('settings.backup.external.saved'), 'success')
      await refreshStatus()
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [t, toast, refreshStatus])

  const clearExternalDir = useCallback(async () => {
    await backupApi.setExternalDir('')
    await refreshStatus()
  }, [refreshStatus])

  const restoreSqlite = useCallback(async () => {
    const selected = await open({
      filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }],
      multiple: false,
    })
    if (!selected || Array.isArray(selected)) return

    await backupApi.restoreSqlite(selected)
    toast(t('settings.backup.restore.success'), 'success')
    window.location.reload()
  }, [t, toast])

  return {
    status,
    backupNow,
    chooseExternalDir,
    clearExternalDir,
    restoreSqlite,
    refreshStatus,
  }
}
