import { useEffect, useRef, useState } from 'react'
import { Export } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { useGuideExport } from '@/features/guide-io/hooks/useGuideExport'
import { useGuideImport } from '@/features/guide-io/hooks/useGuideImport'
import { useT } from '@/app/providers/LocaleProvider'

export function GuideShareMenu() {
  const t = useT()
  const { exportGuide, copyGuide } = useGuideExport()
  const { importGuide, importGuideFromClipboard } = useGuideImport()
  const fileRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="guideShareMenu" ref={rootRef}>
      <Button
        variant="secondary"
        size="icon"
        className={open ? 'is-open' : undefined}
        title={open ? undefined : t('guide.io.menu.tip')}
        tooltipSide="bottom"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('guide.io.menu.aria')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Export size={18} weight="bold" className="btnIcon" aria-hidden />
      </Button>

      {open ? (
        <div className="guideSharePanel" role="dialog" aria-label={t('guide.io.menu.title')}>
          <div className="guideSharePanelHead">
            <span className="guideSharePanelTitle">{t('guide.io.menu.title')}</span>
          </div>
          <ul className="guideShareList">
            <li>
              <button
                type="button"
                className="guideShareItem"
                onClick={() => {
                  void copyGuide()
                  setOpen(false)
                }}
              >
                <i className="ph ph-copy" aria-hidden />
                <span>{t('guide.io.copy')}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="guideShareItem"
                onClick={() => {
                  setOpen(false)
                  void exportGuide()
                }}
              >
                <i className="ph ph-upload-simple" aria-hidden />
                <span>{t('guide.io.save')}</span>
              </button>
            </li>
            <li className="guideShareSplit" aria-hidden />
            <li>
              <button
                type="button"
                className="guideShareItem"
                onClick={() => {
                  setOpen(false)
                  void importGuideFromClipboard()
                }}
              >
                <i className="ph ph-clipboard" aria-hidden />
                <span>{t('guide.io.paste')}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="guideShareItem"
                onClick={() => {
                  setOpen(false)
                  fileRef.current?.click()
                }}
              >
                <i className="ph ph-download-simple" aria-hidden />
                <span>{t('guide.io.open')}</span>
              </button>
            </li>
          </ul>
          <p className="guideShareHint">{t('guide.io.drop.hint')}</p>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importGuide(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
