import { useRef } from 'react'
import { useProfileBackup } from '@/features/backup/hooks/useProfileBackup'
import { useBackupSettings } from '@/features/backup/hooks/useBackupSettings'
import { useRouter } from '@/app/router'
import { Tooltip } from '@/components/ui/Tooltip'
import { useLocale, useT } from '@/app/providers/LocaleProvider'

function formatLastBackup(iso: string | null | undefined, locale: string, noneLabel: string) {
  if (!iso) return noneLabel
  try {
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return noneLabel
  }
}

export function ProfileBackupBar() {
  const t = useT()
  const { bcp47 } = useLocale()
  const { exportProfile, importProfile } = useProfileBackup()
  const { status } = useBackupSettings()
  const { navigate } = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const noneLabel = t('backup.profile.none')

  return (
    <div className="sidebarBackup">
      <p className="sidebarBackupLabel">{t('backup.profile.label')}</p>
      <div className="sidebarBackupSeg" role="group" aria-label={t('backup.profile.group')}>
        <Tooltip content={t('backup.profile.export.tip')} side="top">
          <button
            type="button"
            className="sidebarBackupSegBtn"
            onClick={() => void exportProfile()}
          >
            <i className="ph-bold ph-export" aria-hidden />
            <span>{t('backup.profile.export')}</span>
          </button>
        </Tooltip>
        <Tooltip content={t('backup.profile.import.tip')} side="top">
          <button
            type="button"
            className="sidebarBackupSegBtn"
            onClick={() => fileRef.current?.click()}
          >
            <i className="ph-bold ph-download-simple" aria-hidden />
            <span>{t('backup.profile.import')}</span>
          </button>
        </Tooltip>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importProfile(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="sidebarBackupSettings"
        onClick={() => navigate('settings')}
      >
        <span className="sidebarBackupSettingsLead">
          <i className="ph-duotone ph-gear" aria-hidden />
          <span>{t('nav.settings')}</span>
        </span>
        <span className="sidebarBackupMeta">
          {status.lastBackupAt ? (
            <Tooltip
              content={new Date(status.lastBackupAt).toLocaleString(bcp47)}
              side="top"
            >
              <span>{formatLastBackup(status.lastBackupAt, bcp47, noneLabel)}</span>
            </Tooltip>
          ) : (
            formatLastBackup(status.lastBackupAt, bcp47, noneLabel)
          )}
        </span>
      </button>
    </div>
  )
}
