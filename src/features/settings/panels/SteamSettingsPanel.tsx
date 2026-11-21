import { useEffect, useState } from 'react'
import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { useSteamSettings } from '@/features/steam/hooks/useSteamSettings'
import { useAppData } from '@/app/providers/AppDataProvider'
import { showUnlockOverlay } from '@/features/overlay/showUnlockOverlay'
import {
  OVERLAY_PROGRESS_SETTING_KEY,
  OVERLAY_SETTING_KEY,
  OVERLAY_SOUND_PROGRESS_SETTING_KEY,
  OVERLAY_SOUND_SETTING_KEY,
  TRAY_SETTING_KEY,
  overlayDifficulty,
  settingEnabled,
  type OverlayChime,
  type UnlockOverlayPayload,
} from '@/features/overlay/types'
import { SHOW_HIDDEN_SETTING_KEY, showHiddenAchievements } from '@/features/achievements/utils/hidden'
import {
  COMPANION_HOTKEY_SETTING_KEY,
  COMPANION_SETTING_KEY,
  DEFAULT_COMPANION_HOTKEY,
} from '@/features/companion/types'
import {
  refreshCompanionShortcut,
  setCompanionHotkey,
  toggleCompanion,
} from '@/features/companion/api'
import { hotkeyFromKeyboardEvent, hotkeyParts } from '@/features/companion/hotkey'

export function SteamSettingsPanel() {
  const t = useT()
  const { settings, setSetting, achievements, activeGame } = useAppData()
  const { status, chooseInstallDir, clearInstallDir } = useSteamSettings()
  const custom = status.installDir
  const detected = status.detectedDir
  const overlayOn = settingEnabled(settings, OVERLAY_SETTING_KEY, true)
  const overlayProgressOn = settingEnabled(settings, OVERLAY_PROGRESS_SETTING_KEY, true)
  const overlaySoundOn = settingEnabled(settings, OVERLAY_SOUND_SETTING_KEY, true)
  const overlaySoundProgressOn = settingEnabled(
    settings,
    OVERLAY_SOUND_PROGRESS_SETTING_KEY,
    false,
  )
  const companionOn = settingEnabled(settings, COMPANION_SETTING_KEY, true)
  const companionHotkey = settings[COMPANION_HOTKEY_SETTING_KEY]?.trim() || DEFAULT_COMPANION_HOTKEY
  const [recordingHotkey, setRecordingHotkey] = useState(false)
  const [hotkeyError, setHotkeyError] = useState(false)
  const trayOn = settingEnabled(settings, TRAY_SETTING_KEY, true)
  const showHidden = showHiddenAchievements(settings)
  const extrasLocked = !overlayOn
  const companionLocked = !companionOn
  const soundProgressLocked = extrasLocked || !overlaySoundOn || !overlayProgressOn

  const toggle = (key: string, on: boolean) => {
    void setSetting(key, on ? '1' : '0')
  }

  const toggleCompanionSetting = (on: boolean) => {
    void setSetting(COMPANION_SETTING_KEY, on ? '1' : '0').then(() =>
      refreshCompanionShortcut(),
    )
  }

  useEffect(() => {
    if (!recordingHotkey) return
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecordingHotkey(false)
        return
      }
      const next = hotkeyFromKeyboardEvent(event)
      if (!next) {
        setHotkeyError(true)
        return
      }
      setHotkeyError(false)
      setRecordingHotkey(false)
      void setCompanionHotkey(next)
        .then((saved) => setSetting(COMPANION_HOTKEY_SETTING_KEY, saved))
        .catch(() => setHotkeyError(true))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recordingHotkey, setSetting])

  const previewUnlock = (kind: 'difficulty' | 'progress') => {
    const withIcon = achievements.filter((a) => a.icon)
    const rated = withIcon.filter((a) => overlayDifficulty(a.difficulty) || a.missable)
    const withProgress = withIcon.filter(
      (a) => typeof a.progressMax === 'number' && a.progressMax > 0,
    )
    const pick =
      kind === 'difficulty'
        ? rated.find((a) => a.completed) || rated[0] || withIcon.find((a) => a.completed) || withIcon[0]
        : withProgress.find((a) => !a.completed) ||
          withProgress[0] ||
          withIcon.find((a) => a.completed) ||
          withIcon[0]

    const payload: UnlockOverlayPayload = {
      kicker: kind === 'progress' ? t('overlay.progress') : t('overlay.kicker'),
      title: pick?.title || t('settings.steam.overlay.sampleTitle'),
      subtitle: activeGame?.name || 'Questlog',
      icon: pick?.icon || null,
      difficulty: overlayDifficulty(pick?.difficulty) || (kind === 'difficulty' ? 'hard' : null),
      missable: Boolean(pick?.missable),
    }

    if (kind === 'progress') {
      const max =
        typeof pick?.progressMax === 'number' && pick.progressMax > 0 ? pick.progressMax : 20
      const current =
        typeof pick?.progress === 'number' && pick.progress > 0 && pick.progress < max
          ? pick.progress
          : Math.max(1, Math.round(max * 0.7))
      payload.progress = current
      payload.progressMax = max
      payload.difficulty = overlayDifficulty(pick?.difficulty)
      payload.missable = Boolean(pick?.missable)
    }

    const chime: OverlayChime =
      kind === 'progress'
        ? overlaySoundOn && overlaySoundProgressOn
          ? 'progress'
          : 'none'
        : overlaySoundOn
          ? 'unlock'
          : 'none'

    void showUnlockOverlay(payload, chime)
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
        <h3 className="stSectionTitle">{t('settings.steam.section.alerts')}</h3>
        <div className="stPanel">
          <div className="stBundle">
            <div className="stRow">
              <div className="stRowLead">
                <span className="stRowIcon" aria-hidden>
                  <i className="ph-fill ph-trophy" />
                </span>
                <div className="stRowCopy">
                  <div className="stRowTitle">{t('settings.steam.overlay.title')}</div>
                  <p className="stRowDesc">{t('settings.steam.overlay.desc')}</p>
                </div>
              </div>
              <label className="settingsSwitch">
                <input
                  type="checkbox"
                  checked={overlayOn}
                  onChange={(e) => toggle(OVERLAY_SETTING_KEY, e.target.checked)}
                  aria-label={t('settings.steam.overlay.title')}
                />
                <span className="settingsSwitchUi" aria-hidden />
              </label>
            </div>

            <div className="stBundleExtras">
              <div className={`stRow is-sub${extrasLocked ? ' is-disabled' : ''}`}>
                <div className="stRowLead">
                  <span className="stRowIcon" aria-hidden>
                    <i className="ph-fill ph-chart-bar" />
                  </span>
                  <div className="stRowCopy">
                    <div className="stRowTitle">{t('settings.steam.overlay.progress.title')}</div>
                    <p className="stRowDesc">{t('settings.steam.overlay.progress.desc')}</p>
                  </div>
                </div>
                <label className={`settingsSwitch is-sm${extrasLocked ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={overlayProgressOn}
                    disabled={extrasLocked}
                    onChange={(e) => toggle(OVERLAY_PROGRESS_SETTING_KEY, e.target.checked)}
                    aria-label={t('settings.steam.overlay.progress.title')}
                  />
                  <span className="settingsSwitchUi" aria-hidden />
                </label>
              </div>
              <div className={`stRow is-sub${extrasLocked ? ' is-disabled' : ''}`}>
                <div className="stRowLead">
                  <span className="stRowIcon" aria-hidden>
                    <i className="ph-fill ph-speaker-high" />
                  </span>
                  <div className="stRowCopy">
                    <div className="stRowTitle">{t('settings.steam.overlay.sound.title')}</div>
                    <p className="stRowDesc">{t('settings.steam.overlay.sound.desc')}</p>
                  </div>
                </div>
                <label className={`settingsSwitch is-sm${extrasLocked ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={overlaySoundOn}
                    disabled={extrasLocked}
                    onChange={(e) => toggle(OVERLAY_SOUND_SETTING_KEY, e.target.checked)}
                    aria-label={t('settings.steam.overlay.sound.title')}
                  />
                  <span className="settingsSwitchUi" aria-hidden />
                </label>
              </div>
              <div className={`stRow is-sub${soundProgressLocked ? ' is-disabled' : ''}`}>
                <div className="stRowLead">
                  <span className="stRowIcon" aria-hidden>
                    <i className="ph-fill ph-waveform" />
                  </span>
                  <div className="stRowCopy">
                    <div className="stRowTitle">{t('settings.steam.overlay.soundProgress.title')}</div>
                    <p className="stRowDesc">{t('settings.steam.overlay.soundProgress.desc')}</p>
                  </div>
                </div>
                <label className={`settingsSwitch is-sm${soundProgressLocked ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={overlaySoundProgressOn}
                    disabled={soundProgressLocked}
                    onChange={(e) => toggle(OVERLAY_SOUND_PROGRESS_SETTING_KEY, e.target.checked)}
                    aria-label={t('settings.steam.overlay.soundProgress.title')}
                  />
                  <span className="settingsSwitchUi" aria-hidden />
                </label>
              </div>
              <div className={`stRow is-sub${extrasLocked ? ' is-disabled' : ''}`}>
                <div className="stRowLead">
                  <span className="stRowIcon" aria-hidden>
                    <i className="ph-fill ph-eye" />
                  </span>
                  <div className="stRowCopy">
                    <div className="stRowTitle">{t('settings.steam.overlay.previewHint')}</div>
                    <p className="stRowDesc">{t('settings.steam.overlay.previewDesc')}</p>
                  </div>
                </div>
                <div className="stPreviewRow">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={extrasLocked}
                    onClick={() => previewUnlock('difficulty')}
                  >
                    {t('settings.steam.overlay.previewDifficulty')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={extrasLocked || !overlayProgressOn}
                    onClick={() => previewUnlock('progress')}
                  >
                    {t('settings.steam.overlay.previewProgress')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stSection">
        <h3 className="stSectionTitle">{t('settings.steam.companion.title')}</h3>
        <div className="stPanel">
          <div className="stBundle">
            <div className="stRow">
              <div className="stRowLead">
                <span className="stRowIcon" aria-hidden>
                  <i className="ph-fill ph-game-controller" />
                </span>
                <div className="stRowCopy">
                  <div className="stRowTitle">{t('settings.steam.companion.title')}</div>
                  <p className="stRowDesc">{t('settings.steam.companion.desc')}</p>
                </div>
              </div>
              <label className="settingsSwitch">
                <input
                  type="checkbox"
                  checked={companionOn}
                  onChange={(e) => toggleCompanionSetting(e.target.checked)}
                  aria-label={t('settings.steam.companion.title')}
                />
                <span className="settingsSwitchUi" aria-hidden />
              </label>
            </div>

            <div className="stBundleExtras">
              <div className={`stRow is-sub${companionLocked ? ' is-disabled' : ''}`}>
                <div className="stRowLead">
                  <span className="stRowIcon" aria-hidden>
                    <i className="ph-fill ph-keyboard" />
                  </span>
                  <div className="stRowCopy">
                    <div className="stRowTitle">{t('settings.steam.companion.hotkey')}</div>
                    <p className="stRowDesc">
                      {hotkeyError
                        ? t('settings.steam.companion.invalid')
                        : t('settings.steam.companion.hotkeyDesc')}
                    </p>
                  </div>
                </div>
                <div className="stPreviewRow">
                  <span className="stHelpKeys" aria-hidden>
                    {hotkeyParts(companionHotkey).map((key) => (
                      <kbd key={key} className="stKbd">
                        {key}
                      </kbd>
                    ))}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={companionLocked}
                    onClick={() => {
                      setHotkeyError(false)
                      setRecordingHotkey(true)
                    }}
                  >
                    {recordingHotkey
                      ? t('settings.steam.companion.recording')
                      : t('settings.steam.companion.record')}
                  </Button>
                </div>
              </div>
              <div className={`stRow is-sub${companionLocked ? ' is-disabled' : ''}`}>
                <div className="stRowLead">
                  <span className="stRowIcon" aria-hidden>
                    <i className="ph-fill ph-eye" />
                  </span>
                  <div className="stRowCopy">
                    <div className="stRowTitle">{t('settings.steam.companion.preview')}</div>
                    <p className="stRowDesc">{t('settings.steam.companion.note')}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={companionLocked}
                  onClick={() => void toggleCompanion()}
                >
                  {t('settings.steam.companion.preview')}
                </Button>
              </div>
            </div>
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
