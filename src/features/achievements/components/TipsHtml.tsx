import { useEffect, useState, type MouseEvent, type KeyboardEvent } from 'react'
import {
  normalizeTipsToHtml,
  sanitizeTipsHtml,
  tipsHtmlForDisplay,
} from '@/features/media/tipsHtml'
import { Tooltip } from '@/components/ui/Tooltip'
import { useT } from '@/app/providers/LocaleProvider'

function decorateTipsHtml(asHtml: string, zoomHint: string): string {
  return sanitizeTipsHtml(asHtml).replace(
    /<img\b([^>]*?)\/?>/gi,
    (_m, attrs: string) => {
      const cleaned = String(attrs)
        .replace(/\s*title\s*=\s*("[^"]*"|'[^']*')/i, '')
        .replace(/\s*class\s*=\s*("[^"]*"|'[^']*')/i, '')
        .replace(/\/\s*$/, '')
      return `<img class="tipsViewImg" title="${escapeAttr(zoomHint)}"${cleaned} />`
    },
  )
}

function escapeAttr(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

export function TipsHtml({ html, appId = 'misc' }: { html: string; appId?: string }) {
  const t = useT()
  const zoomHint = t('tips.image.zoom')
  const [content, setContent] = useState(() =>
    decorateTipsHtml(normalizeTipsToHtml(html || ''), zoomHint),
  )
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const raw = html || ''
    setContent(decorateTipsHtml(normalizeTipsToHtml(raw), zoomHint))
    void tipsHtmlForDisplay(raw, appId).then((resolved) => {
      if (cancelled) return
      setContent(decorateTipsHtml(resolved.trim() || '', zoomHint))
    })
    return () => {
      cancelled = true
    }
  }, [html, appId, zoomHint])

  useEffect(() => {
    if (!lightboxSrc) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxSrc])

  function openFromClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    const img = target?.closest?.('img') as HTMLImageElement | null
    if (!img) return
    e.preventDefault()
    e.stopPropagation()
    const src = img.currentSrc || img.src
    if (src) setLightboxSrc(src)
  }

  function onKeyActivate(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const target = e.target as HTMLElement | null
    const img = target?.closest?.('img') as HTMLImageElement | null
    if (!img) return
    e.preventDefault()
    const src = img.currentSrc || img.src
    if (src) setLightboxSrc(src)
  }

  return (
    <>
      <div
        className="tipsView tipsView--html"
        role="presentation"
        onClick={openFromClick}
        onKeyDown={onKeyActivate}
        dangerouslySetInnerHTML={{ __html: content || '<p></p>' }}
      />

      {lightboxSrc ? (
        <div
          className="tipsLightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Imagem ampliada"
          onClick={() => setLightboxSrc(null)}
        >
          <Tooltip content={t('common.close')} side="left" wrapperClassName="tipsLightboxCloseTip">
            <button
              type="button"
              className="tipsLightboxClose"
              aria-label={t('common.close')}
              onClick={() => setLightboxSrc(null)}
            >
              <i className="ph-bold ph-x" aria-hidden />
            </button>
          </Tooltip>
          <img
            className="tipsLightboxImg"
            src={lightboxSrc}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
          <p className="tipsLightboxHint">{t('tips.lightbox.hint')}</p>
        </div>
      ) : null}
    </>
  )
}
