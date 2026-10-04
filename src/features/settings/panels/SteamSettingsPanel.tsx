import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { useSteamSettings } from '@/features/steam/hooks/useSteamSettings'
import { useAppData } from '@/app/providers/AppDataProvider'
import { TRAY_SETTING_KEY, settingEnabled } from '@/lib/settings'
import { SHOW_HIDDEN_SETTING_KEY, showHiddenAchievements } from '@/features/achievements/utils/hidden'

export function SteamSettingsPanel() {
  const t = useT()
  const { settings, setSetting } = useAppData()
  const { status, chooseInstallDir, clearInstallDir } = useSteamSettings()
  const custom = status.installDir
  const detected = status.detectedDir
  const trayOn = settingEnabled(settings, TRAY_SETTING_KEY, true)
  const showHidden = showHiddenAchievements(settings)

  const toggle = (key: string, on: boolean) => {
    void setSetting(key, on ? '1' : '0')
  }

  return (
    <div className="stStack">
      <section className="stSection">
        <h3 className="stSectionTitle">{t('settings.steam.section.sync')}</h3>
        <div className="stPanel">
          <div className="stRow">
            <div className="stRowLead">
              <span className="stRowIcon" aria-hidden>
                <i className="ph-fill ph-arrows-clockwise" />
              </span>
              <div className="stRowCopy">
                <div className="stRowTitle">{t('settings.steam.sync.title')}</div>
                <p className="stRowDesc">{t('settings.steam.sync.desc')}</p>
              </div>
            </div>
            <span className="stStatusPill">{t('settings.steam.sync.badge')}</span>
          </div>

          <div className="stPanelDivider" role="separator" />

          <div className="stRow">
            <div className="stRowLead">
              <span className="stRowIcon" aria-hidden>
                <i className="ph-fill ph-eye-slash" />
              </span>
              <div className="stRowCopy">
                <div className="stRowTitle">{t('settings.steam.hidden.title')}</div>
                <p className="stRowDesc">{t('settings.steam.hidden.desc')}</p>
              </div>
            </div>
            <label className="settingsSwitch">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => toggle(SHOW_HIDDEN_SETTING_KEY, e.target.checked)}
                aria-label={t('settings.steam.hidden.title')}
              />
              <span className="settingsSwitchUi" aria-hidden />
            </label>
          </div>
        </div>
      </section>

      <section className="stSection">
        <h3 className="stSectionTitle">{t('settings.steam.section.window')}</h3>
        <div className="stPanel">
          <div className="stRow">
            <div className="stRowLead">
              <span className="stRowIcon" aria-hidden>
                <i className="ph-fill ph-tray" />
              </span>
              <div className="stRowCopy">
                <div className="stRowTitle">{t('settings.steam.tray.title')}</div>
                <p className="stRowDesc">{t('settings.steam.tray.desc')}</p>
              </div>
            </div>
            <label className="settingsSwitch">
              <input
                type="checkbox"
                checked={trayOn}
                onChange={(e) => toggle(TRAY_SETTING_KEY, e.target.checked)}
                aria-label={t('settings.steam.tray.title')}
              />
              <span className="settingsSwitchUi" aria-hidden />
            </label>
          </div>
        </div>
      </section>

      <section className="stSection">
        <h3 className="stSectionTitle">{t('settings.steam.section.folder')}</h3>
        <div className="stPanel">
          <div className="stBlock">
            <div className="stBlockHead">
              <span className="stRowIcon" aria-hidden>
                <i className="ph-fill ph-folder-simple" />
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
      </section>
    </div>
  )
}
