import { marked } from 'marked'
import { convertFileSrc } from '@tauri-apps/api/core'
import { mediaApi } from './api'

const MEDIA_TOKEN = /guia-media:(?:[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+)/g
const MEDIA_PREFIX = 'guia-media:'
const HTTP_IMG_SRC =
  /(<img\b[^>]*\bsrc\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi

const displayToToken = new Map<string, string>()
const tokenToDisplay = new Map<string, string>()

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function isMediaToken(src: string): boolean {
  return src.startsWith(MEDIA_PREFIX)
}

export async function resolveMediaToken(token: string): Promise<string | null> {
  const key = token.trim()
  if (!key.startsWith(MEDIA_PREFIX)) return null
  const cached = tokenToDisplay.get(key)
  if (cached) return cached
  try {
    const path = await mediaApi.resolvePath(key)
    const display = convertFileSrc(path)
    tokenToDisplay.set(key, display)
    displayToToken.set(display, key)
    return display
  } catch {
    return null
  }
}

export function registerMediaPair(token: string, display: string) {
  displayToToken.set(display, token)
  tokenToDisplay.set(token, display)
}

/** Detecta se o conteúdo já é HTML do Quill/editor (não markdown cru). */
export function looksLikeStructuredHtml(value: string): boolean {
  return /<(p|div|ul|ol|li|h[1-6]|table|blockquote)\b/i.test(value.trim())
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim())
}

/** Markdown (ou misto) → HTML via marked. HTML de editor passa quase intacto. */
export function normalizeTipsToHtml(raw: string): string {
  const t = raw.trim()
  if (!t) return ''

  // Já é HTML estruturado do Quill: só garante imgs markdown residuais
  if (looksLikeStructuredHtml(t) && !/(^|\n)\s{0,3}#{1,3}\s|(^|\n)\s*[-*+]\s|!\[[^\]]*\]\(/.test(t)) {
    return t.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*\)/g, (_m, alt: string, url: string) => {
      const safeUrl = String(url || '').trim().replace(/"/g, '')
      if (!safeUrl) return ''
      return `<img src="${safeUrl}" alt="${escapeAttr(alt || '')}" />`
    })
  }

  try {
    const html = marked.parse(t, { async: false })
    return typeof html === 'string' ? html.trim() : t
  } catch {
    return t
  }
}

export function plainTipsToHtml(text: string): string {
  return normalizeTipsToHtml(text)
}

/** Detecta se as dicas incluem foto (HTML img, token local ou markdown). */
export function tipsHasImage(tips?: string | null): boolean {
  const t = tips?.trim()
  if (!t) return false
  return (
    /<img\b/i.test(t) ||
    t.includes('guia-media:') ||
    /!\[[^\]]*\]\(\s*[^)\s]+\s*\)/.test(t)
  )
}

/** Corrige URLs de wiki quebradas antes de baixar/exibir. */
export function rewriteTipsImageUrl(url: string): string {
  let u = url.trim()
  if (u.includes('weirdgloop.org/w/images/') || u.includes('weirdgloop.org/w/Images/')) {
    u = u.replace('/w/images/', '/images/').replace('/w/Images/', '/images/')
  }
  return u
}

/**
 * HTML do banco → HTML com src legíveis no WebView.
 * Baixa http(s) para disco (WebView costuma bloquear hotlink) e resolve guia-media.
 */
export async function tipsHtmlForDisplay(
  html: string,
  appId = 'misc',
): Promise<string> {
  if (!html) return ''
  let out = normalizeTipsToHtml(html)

  // Reescreve URLs wiki quebradas no HTML
  out = out.replace(
    /(src\s*=\s*["'])(https?:\/\/[^"']+)(["'])/gi,
    (_m, a: string, url: string, b: string) => `${a}${rewriteTipsImageUrl(url)}${b}`,
  )

  // guia-media → asset://
  const tokens = [...new Set(out.match(MEDIA_TOKEN) ?? [])]
  for (const token of tokens) {
    const display = await resolveMediaToken(token)
    if (display) out = out.split(token).join(display)
  }

  // http(s) imgs → download local
  const remoteUrls = [...out.matchAll(HTTP_IMG_SRC)].map((m) => m[3])
  const unique = [...new Set(remoteUrls)]
  for (const url of unique) {
    const fixed = rewriteTipsImageUrl(url)
    try {
      const saved = await mediaApi.saveFromUrl(appId || 'misc', fixed)
      const display = convertFileSrc(saved.path)
      registerMediaPair(saved.token, display)
      out = out.split(url).join(display)
      if (fixed !== url) out = out.split(fixed).join(display)
    } catch {
      if (fixed !== url) out = out.split(url).join(fixed)
    }
  }

  return out
}

/** HTML do Quill (com asset urls) → HTML estável com guia-media. */
export function tipsHtmlForStorage(html: string): string {
  let out = normalizeTipsToHtml(html)
  for (const [display, token] of displayToToken) {
    if (display && out.includes(display)) {
      out = out.split(display).join(token)
    }
  }
  out = out.replace(
    /src=(["'])(?:asset|https?):\/\/[^"']+#?(guia-media:[^"']+)\1/gi,
    'src=$1$2$1',
  )
  return out
}

function escapeAttr(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Sanitização mínima antes de dangerouslySetInnerHTML. */
export function sanitizeTipsHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}
