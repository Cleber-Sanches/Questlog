import { useCallback } from 'react'
import { backupApi } from '@/features/backup/api'
import { downloadJson } from '@/lib/downloadJson'
import { useToast } from '@/app/providers/ToastProvider'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { isProfilePackType } from '@/features/backup/packTypes'
import type { ProfilePack } from '@/types/backup'

export function useProfileBackup() {
  const { toast } = useToast()
  const { refresh } = useAppData()
  const t = useT()

  const exportProfile = useCallback(async () => {
    try {
      const pack = await backupApi.exportProfile()
      const count = pack.games?.length ?? 0
      const saved = await downloadJson(`questlog-perfil-${count}jogos.json`, pack)
      if (saved) toast(t('backup.profile.exported'), 'success')
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [t, toast])

  const importProfile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const pack = JSON.parse(text) as ProfilePack
        if (!isProfilePackType(pack.type)) {
          throw new Error(t('backup.profile.invalid'))
        }
        await backupApi.importProfile({
          activeGameAppId: pack.activeGameAppId,
          games: pack.games || [],
          achievementsByAppId: pack.achievementsByAppId || {},
          prefs: pack.prefs,
        })
        await refresh()
        toast(t('backup.profile.imported'), 'success')
      } catch (err) {
        toast(String(err), 'error')
      }
    },
    [refresh, t, toast],
  )

  return { exportProfile, importProfile }
}
