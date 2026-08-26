import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { useSteamSettings } from '@/features/steam/hooks/useSteamSettings'

export function SteamSettingsPanel() {
  const t = useT()
  const { status, chooseInstallDir, clearInstallDir } = useSteamSettings()
  const custom = status.installDir
  const detected = status.detectedDir

  return (
    <div className="stStack">
      <div className="stPanel">
        <div className="stRow">
          <div className="stRowLead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph ph-arrows-clockwise" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.steam.sync.title')}</div>
              <p className="stRowDesc">{t('settings.steam.sync.desc')}</p>
            </div>
          </div>
          <span className="stStatusPill">{t('settings.steam.sync.badge')}</span>
        </div>

        <div className="stPanelDivider" role="separator" />

        <div className="stBlock">
          <div className="stBlockHead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph ph-folder-simple" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.steam.folder.title')}</div>
              <p className="stRowDesc">
                {custom
                  ? t('settings.steam.folder.custom')
                  : detected
                    ? t('settings.steam.folder.detected')
                    : t('settings.steam.folder.missing')}
              </p>
            </div>
          </div>

          {custom ? (
            <div className="stPathRow">
              <code className="stPath">{custom}</code>
              <div className="stPathActions">
                <Button variant="secondary" size="sm" onClick={() => void chooseInstallDir()}>
                  {t('common.change')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void clearInstallDir()}>
                  {t('settings.steam.folder.useAuto')}
                </Button>
              </div>
            </div>
          ) : detected ? (
            <div className="stPathRow">
              <code className="stPath">{detected}</code>
              <div className="stPathActions">
                <Button variant="secondary" size="sm" onClick={() => void chooseInstallDir()}>
                  {t('settings.steam.folder.chooseOther')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="stEmptyRow">
              <p className="stNote">{t('settings.steam.folder.notFound')}</p>
              <Button variant="secondary" size="sm" onClick={() => void chooseInstallDir()}>
                {t('common.chooseFolder')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
