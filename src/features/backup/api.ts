import { invoke } from '@/lib/invoke'
import type { BackupInfo, BackupStatus, ProfilePack } from '@/types/backup'
import type { Game } from '@/types/game'
import type { Achievement } from '@/types/achievement'

export const backupApi = {
  now: () => invoke<BackupInfo>('backup_now'),
  status: () => invoke<BackupStatus>('backup_get_status'),
  setExternalDir: (path: string) => invoke<void>('backup_set_external_dir', { path }),
  maybeAuto: () => invoke<BackupInfo | null>('backup_maybe_auto'),
  restoreSqlite: (path: string) => invoke<void>('backup_restore_sqlite', { path }),
  exportProfile: () => invoke<ProfilePack>('db_export_profile'),
  importProfile: (pack: {
    activeGameAppId?: string | null
    games: Game[]
    achievementsByAppId: Record<string, Achievement[]>
    prefs?: { collapsedSections?: Record<string, boolean> }
  }) => invoke<void>('db_import_profile', { pack }),
}
