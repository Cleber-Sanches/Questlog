import { useRef, useState } from 'react'
import { useLocale, useT } from '@/app/providers/LocaleProvider'
import { useModal } from '@/app/providers/ModalProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/overlay/ConfirmDialog'
import { useBackupSettings } from '@/features/backup/hooks/useBackupSettings'
import { useProfileBackup } from '@/features/backup/hooks/useProfileBackup'

function formatWhen(iso: string | null | undefined, bcp47: string) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(bcp47, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function BackupSettingsPanel() {
  const t = useT()
  const { bcp47 } = useLocale()
  const { openModal } = useModal()
  const { status, backupNow, chooseExternalDir, clearExternalDir, restoreSqlite } =
    useBackupSettings()
  const { exportProfile, importProfile } = useProfileBackup()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const last = formatWhen(status.lastBackupAt, bcp47)
  const external = status.externalBackupDir

  const onBackup = async () => {
    setBusy(true)
    try {
      await backupNow()
    } finally {
      setBusy(false)
    }
  }

  const onRestore = () => {
    openModal(
      <ConfirmDialog
        title={t('settings.backup.restore.confirmTitle')}
        message={t('settings.backup.restore.confirmBody')}
        confirmLabel={t('settings.backup.restore.action')}
        onConfirm={() => {
          setBusy(true)
          void restoreSqlite().finally(() => setBusy(false))
        }}
      />,
    )
  }

  return (
    <div className="stStack">
      <p className="stNote">{t('settings.backup.recovery.hint')}</p>

      <div className="stPanel">
        <div className="stRow">
          <div className="stRowLead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph-fill ph-cloud-arrow-down" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.backup.local.title')}</div>
              <p className="stRowDesc">
                {last ? (
                  <>
                    {t('settings.backup.local.last')}{' '}
                    <time className="stRowTime" dateTime={status.lastBackupAt ?? undefined}>
                      {last}
                    </time>
                  </>
                ) : (
                  t('settings.backup.local.none')
                )}
              </p>
            </div>
          </div>
          <Button variant="primary" size="md" onClick={() => void onBackup()} disabled={busy}>
            {busy ? t('common.saving') : t('settings.backup.local.action')}
          </Button>
        </div>

        <div className="stPanelDivider" role="separator" />

        <div className="stBlock">
          <div className="stBlockHead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph-fill ph-folder-open" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.backup.external.title')}</div>
              <p className="stRowDesc">{t('settings.backup.external.desc')}</p>
            </div>
          </div>

          {external ? (
            <div className="stPathRow">
              <code className="stPath">{external}</code>
              <div className="stPathActions">
                <Button variant="secondary" size="sm" onClick={() => void chooseExternalDir()}>
                  {t('common.change')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void clearExternalDir()}>
                  {t('common.remove')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="stEmptyRow">
              <p className="stNote">{t('settings.backup.external.none')}</p>
              <Button variant="secondary" size="sm" onClick={() => void chooseExternalDir()}>
                {t('common.chooseFolder')}
              </Button>
            </div>
          )}
        </div>

        <div className="stPanelDivider" role="separator" />

        <div className="stRow">
          <div className="stRowLead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph-fill ph-export" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.backup.profile.title')}</div>
              <p className="stRowDesc">{t('settings.backup.profile.desc')}</p>
            </div>
          </div>
          <div className="stPathActions">
            <Button variant="secondary" size="sm" onClick={() => void exportProfile()} disabled={busy}>
              {t('backup.profile.export')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {t('backup.profile.import')}
            </Button>
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
        </div>

        <div className="stPanelDivider" role="separator" />

        <div className="stRow">
          <div className="stRowLead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph-fill ph-database" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.backup.restore.title')}</div>
              <p className="stRowDesc">{t('settings.backup.restore.desc')}</p>
            </div>
          </div>
          <Button variant="secondary" size="md" onClick={onRestore} disabled={busy}>
            {t('settings.backup.restore.action')}
          </Button>
        </div>
      </div>
    </div>
  )
}
