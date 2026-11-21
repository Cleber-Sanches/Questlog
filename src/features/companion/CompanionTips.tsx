import { useEffect, useState } from 'react'
import {
  normalizeTipsToHtml,
  sanitizeTipsHtml,
  tipsHtmlForDisplay,
} from '@/features/media/tipsHtml'

export function CompanionTips({ html, appId = 'misc' }: { html: string; appId?: string }) {
  const [content, setContent] = useState(() =>
    sanitizeTipsHtml(normalizeTipsToHtml(html || '')),
  )

  useEffect(() => {
    let cancelled = false
    const raw = html || ''
    setContent(sanitizeTipsHtml(normalizeTipsToHtml(raw)))
    void tipsHtmlForDisplay(raw, appId).then((resolved) => {
      if (cancelled) return
      setContent(sanitizeTipsHtml(resolved.trim() || ''))
    })
    return () => {
      cancelled = true
    }
  }, [html, appId])

  if (!content.trim()) return null

  return (
    <div
      className="tipsView tipsView--html companionTips"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
