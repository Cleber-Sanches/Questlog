import { convertFileSrc } from '@tauri-apps/api/core'
import { mediaApi } from './api'

const MEDIA_TOKEN = /guia-media:(?:[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+)/g
const MEDIA_PREFIX = 'guia-media:'

const displayToToken = new Map<string, string>()
const tokenToDisplay = new Map<string, string>()

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

/** HTML do banco → HTML com src legíveis no WebView. */
export async function tipsHtmlForDisplay(html: string): Promise<string> {
  if (!html) return ''
  const tokens = [...new Set(html.match(MEDIA_TOKEN) ?? [])]
  let out = html
  for (const token of tokens) {
    const display = await resolveMediaToken(token)
    if (display) out = out.split(token).join(display)
  }
  return out
}

/** HTML do Quill (com asset urls) → HTML estável com guia-media. */
export function tipsHtmlForStorage(html: string): string {
  let out = html
  for (const [display, token] of displayToToken) {
    if (display && out.includes(display)) {
      out = out.split(display).join(token)
    }
  }
  // asset protocol variants
  out = out.replace(
    /src=(["'])(?:asset|https?):\/\/[^"']+#?(guia-media:[^"']+)\1/gi,
    'src=$1$2$1',
  )
  return out
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim())
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

export function plainTipsToHtml(text: string): string {
  const t = text.trim()
  if (!t) return ''
  if (looksLikeHtml(t)) return t
  return t
    .split(/\n+/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sanitização mínima antes de dangerouslySetInnerHTML. */
export function sanitizeTipsHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}
