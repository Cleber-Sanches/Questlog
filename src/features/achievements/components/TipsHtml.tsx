import { useEffect, useState, type MouseEvent, type KeyboardEvent, type PointerEvent } from 'react'
import {
  looksLikeHtml,
  sanitizeTipsHtml,
  tipsHtmlForDisplay,
} from '@/features/media/tipsHtml'
import { AnchorTooltip, Tooltip } from '@/components/ui/Tooltip'
import { useT } from '@/app/providers/LocaleProvider'

export function TipsHtml({ html }: { html: string }) {
  const t = useT()
  const [content, setContent] = useState('')
  const [plain, setPlain] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [imgTip, setImgTip] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const raw = html || ''
    if (!looksLikeHtml(raw)) {
      setPlain(true)
      setContent(raw)
      return
    }
    setPlain(false)
    void tipsHtmlForDisplay(raw).then((resolved) => {
      if (!cancelled) {
        const withHint = sanitizeTipsHtml(resolved).replace(
          /<img\b([^>]*?)>/gi,
          (_m, attrs: string) => {
            const cleaned = String(attrs)
              .replace(/\s*title\s*=\s*("[^"]*"|'[^']*')/i, '')
              .replace(/\s*class\s*=\s*("[^"]*"|'[^']*')/i, '')
            return `<img class="tipsViewImg"${cleaned} />`
          },
        )
        setContent(withHint)
      }
    })
    return () => {
      cancelled = true
    }
  }, [html])

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

  function onPointerOver(e: PointerEvent) {
    const img = (e.target as HTMLElement | null)?.closest?.('img') as HTMLElement | null
    if (img) setImgTip(img)
  }

  function onPointerOut(e: PointerEvent) {
    const img = (e.target as HTMLElement | null)?.closest?.('img')
    const next = e.relatedTarget as Node | null
    if (img && (!next || !img.contains(next))) setImgTip(null)
  }

  return (
    <>
      {plain ? (
        <div className="tipsView tipsView--plain">{content}</div>
      ) : (
        <div
          className="tipsView tipsView--html"
          role="presentation"
          onClick={openFromClick}
          onKeyDown={onKeyActivate}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          dangerouslySetInnerHTML={{ __html: content || '<p></p>' }}
        />
      )}
      <AnchorTooltip anchor={imgTip} content={t('tips.image.zoom')} side="top" />

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
