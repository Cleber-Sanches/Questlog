import { Button } from '@/components/ui/Button'
import { SegmentedFill } from '@/components/ui/SegmentedBar'
import { useT } from '@/app/providers/LocaleProvider'
import { useUpdater } from '@/app/providers/UpdaterProvider'

export function UpdateSettingsPanel() {
  const t = useT()
  const {
    phase,
    currentVersion,
    availableVersion,
    notes,
    progress,
    error,
    checkForUpdates,
    installUpdate,
  } = useUpdater()

  const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing'

  return (
    <div className="stStack">
      <div className="stPanelHead">
        <h2 className="stPanelTitle">{t('settings.update.title')}</h2>
        <p className="stPanelSubtitle">{t('settings.update.subtitle')}</p>
      </div>

      <div className="stPanel">
        <div className="stRow">
          <div className="stRowLead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph-fill ph-arrows-clockwise" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.update.current')}</div>
              <p className="stRowDesc">
                {t('settings.update.version', { version: currentVersion || '…' })}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => void checkForUpdates()}
          >
            {phase === 'checking' ? t('settings.update.checking') : t('settings.update.check')}
          </Button>
        </div>

        {phase === 'upToDate' ? (
          <>
            <div className="stPanelDivider" role="separator" />
            <p className="stNote is-ok">{t('settings.update.upToDate')}</p>
          </>
        ) : null}

        {availableVersion && phase !== 'upToDate' ? (
          <>
            <div className="stPanelDivider" role="separator" />
            <div className="stRow">
              <div className="stRowLead">
                <span className="stRowIcon" aria-hidden>
                  <i className="ph-fill ph-download-simple" />
                </span>
                <div className="stRowCopy">
                  <div className="stRowTitle">
                    {t('settings.update.available', { version: availableVersion })}
                  </div>
                  {notes ? <p className="stRowDesc">{notes}</p> : null}
                  {phase === 'downloading' || phase === 'installing' ? (
                    <p className="stRowDesc">
                      {phase === 'installing'
                        ? t('settings.update.installing')
                        : t('settings.update.downloading', { progress: String(progress) })}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                variant="primary"
                size="md"
                disabled={busy}
                onClick={() => void installUpdate()}
              >
                {busy ? t('common.saving') : t('settings.update.install')}
              </Button>
            </div>
            {(phase === 'downloading' || phase === 'installing') && (
              <div className="stUpdateBarWrap">
                <SegmentedFill
                  percent={phase === 'installing' ? 100 : progress}
                  brand
                  done={phase === 'installing'}
                />
              </div>
            )}
          </>
        ) : null}

        {phase === 'error' ? (
          <>
            <div className="stPanelDivider" role="separator" />
            <p className="stNote is-err">{t('settings.update.checkError')}</p>
            {error ? <p className="stNote">{error}</p> : null}
            <p className="stNote">{t('settings.update.endpointHint')}</p>
          </>
        ) : null}
      </div>
    </div>
  )
}
