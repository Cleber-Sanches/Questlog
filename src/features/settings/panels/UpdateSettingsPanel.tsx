import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { SegmentedFill } from '@/components/ui/SegmentedBar'
import { useT } from '@/app/providers/LocaleProvider'
import { useUpdater } from '@/app/providers/UpdaterProvider'
import { SPRING_JUMP } from '@/lib/motion/ease'

export function UpdateSettingsPanel() {
  const t = useT()
  const reduce = useReducedMotion()
  const {
    phase,
    currentVersion,
    availableVersion,
    notes,
    progress,
    lastCheckedAt,
    checkForUpdates,
    installUpdate,
  } = useUpdater()

  const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing'
  const upToDate = phase === 'upToDate'
  const hasUpdate = Boolean(availableVersion) && phase !== 'upToDate'
  const failed = phase === 'error'
  const transferring = phase === 'downloading' || phase === 'installing'
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (hasUpdate || transferring || failed) setExpanded(true)
  }, [failed, hasUpdate, transferring])

  const onCheck = () => {
    setExpanded(true)
    void checkForUpdates({ silent: true })
  }

  return (
    <div className="stStack stUpdate">
      <div className="stPanelHead">
        <h2 className="stPanelTitle">{t('settings.update.title')}</h2>
        <p className="stPanelSubtitle">{t('settings.update.subtitle')}</p>
      </div>

      <div className="stPanel stUpdateCard">
        <div className="stUpdateHero">
          <div className="stUpdateLead">
            <img
              className="stUpdateMark"
              src="/questlog-mark.png"
              width={64}
              height={64}
              alt=""
              draggable={false}
            />
            <div className="stUpdateCopy">
              <div className="stUpdateName">Questlog</div>
              <div className="stUpdateVer">{currentVersion || '…'}</div>
              {!expanded && upToDate ? (
                <p className="stUpdateStatus">{t('settings.update.upToDateShort')}</p>
              ) : null}
              {!expanded && hasUpdate ? (
                <p className="stUpdateStatus is-new">
                  {t('settings.update.availableShort', { version: availableVersion ?? '' })}
                </p>
              ) : null}
            </div>
          </div>
          {hasUpdate ? (
            <Button variant="primary" size="md" disabled={busy} onClick={() => void installUpdate()}>
              {phase === 'installing'
                ? t('settings.update.installingShort')
                : phase === 'downloading'
                  ? t('settings.update.downloadingShort')
                  : t('settings.update.installShort')}
            </Button>
          ) : (
            <Button variant="secondary" size="md" disabled={busy} onClick={onCheck}>
              {phase === 'checking' ? t('settings.update.checking') : t('settings.update.check')}
            </Button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              className="stUpdateReveal"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? undefined : { height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : SPRING_JUMP}
            >
              <div className="stUpdateRevealInner">
                {phase === 'checking' ? (
                  <>
                    <p className="stUpdateRevealTitle">{t('settings.update.checking')}</p>
                    <div className="stUpdateBar is-wait">
                      <SegmentedFill percent={28} brand />
                    </div>
                  </>
                ) : null}

                {upToDate ? (
                  <>
                    <p className="stUpdateRevealTitle">{t('settings.update.resultOk')}</p>
                    <p className="stUpdateRevealHint">
                      {lastCheckedAt ? t('settings.update.lastJustNow') : t('settings.update.searchDesc')}
                    </p>
                  </>
                ) : null}

                {hasUpdate ? (
                  <>
                    <p className="stUpdateRevealTitle">
                      {t('settings.update.availableShort', { version: availableVersion ?? '' })}
                    </p>
                    {notes ? <p className="stUpdateRevealHint">{notes}</p> : null}
                    <p className="stUpdateRevealHint">{t('settings.update.availableAlert')}</p>
                    {transferring ? (
                      <div className="stUpdateBar">
                        <p className="stUpdateRevealHint">
                          {phase === 'installing'
                            ? t('settings.update.installing')
                            : t('settings.update.downloading', { progress: String(progress) })}
                        </p>
                        <SegmentedFill
                          percent={phase === 'installing' ? Math.max(progress, 92) : progress}
                          brand
                          done={false}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                {failed ? (
                  <>
                    <p className="stUpdateRevealTitle is-err">{t('settings.update.checkError')}</p>
                    <p className="stUpdateRevealHint">{t('settings.update.checkErrorHint')}</p>
                  </>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
