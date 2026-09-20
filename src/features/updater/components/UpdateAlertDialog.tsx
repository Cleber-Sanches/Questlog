import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { SegmentedFill } from '@/components/ui/SegmentedBar'
import { EASE_OUT } from '@/lib/motion/ease'
import type { UpdatePhase } from '@/features/updater/hooks/useAppUpdater'

function UpdateSealIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
      <path
        fill="currentColor"
        d="M12 1.55 14.28 3l2.68-.28.95 2.52 2.52.95-.28 2.68L22.45 12 21 14.28l.28 2.68-2.52.95-.95 2.52-2.68-.28L12 22.45 9.72 21l-2.68.28-.95-2.52-2.52-.95.28-2.68L1.55 12 3 9.72l-.28-2.68 2.52-.95.95-2.52 2.68.28L12 1.55Z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.1V8.6m0 0 3.15 3.15M12 8.6 8.85 11.75"
      />
    </svg>
  )
}

export function UpdateAlertDialog({
  version,
  phase,
  progress,
  onInstall,
  onDismiss,
  dismissable,
}: {
  version: string
  phase: UpdatePhase
  progress: number
  onInstall: () => void
  onDismiss: () => void
  dismissable?: boolean
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const downloading = phase === 'downloading'
  const installing = phase === 'installing'
  const busy = downloading || installing
  const failed = phase === 'error'
  const canDismiss = dismissable ?? !busy

  const installLabel = installing
    ? t('settings.update.installingShort')
    : downloading
      ? t('settings.update.downloadingShort')
      : t('settings.update.installShort')

  return createPortal(
    <div
      className="updateAlertBackdrop"
      role="presentation"
      onClick={canDismiss ? onDismiss : undefined}
    >
      <motion.aside
        className="updateAlert"
        role="dialog"
        aria-modal="true"
        aria-labelledby="updateAlertTitle"
        onClick={(e) => e.stopPropagation()}
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
      >
        <div className="updateAlertTop">
          <span className="updateAlertIcon" aria-hidden>
            <UpdateSealIcon />
          </span>
          <div className="updateAlertCopy">
            <h2 id="updateAlertTitle">{t('settings.update.alertTitle')}</h2>
            <span className="updateAlertVer">{t('settings.update.version', { version })}</span>
          </div>
        </div>
        <p>
          {failed
            ? t('settings.update.installError')
            : installing
              ? t('settings.update.installing')
              : t('settings.update.availableAlert')}
        </p>
        {downloading || installing ? (
          <div className="updateAlertProgress">
            <span className="updateAlertProgressText">
              {installing ? t('settings.update.installingShort') : `${Math.min(100, progress)}%`}
            </span>
            <SegmentedFill
              percent={installing ? Math.max(progress, 92) : progress}
              brand
              done={false}
            />
          </div>
        ) : null}
        <div className="updateAlertActions">
          <Button variant="secondary" size="md" disabled={!canDismiss} onClick={onDismiss}>
            {t('settings.update.later')}
          </Button>
          <Button variant="primary" size="md" disabled={busy} onClick={onInstall}>
            {installLabel}
          </Button>
        </div>
      </motion.aside>
    </div>,
    document.querySelector('.app-frame') ?? document.body,
  )
}
