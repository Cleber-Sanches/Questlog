export function normalizeExternalUrl(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

function getYoutubeVideoId(url: string) {
  try {
    const u = new URL(normalizeExternalUrl(url))
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || ''
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (u.pathname === '/watch' || u.pathname === '/watch/') {
        const id = u.searchParams.get('v') || ''
        return /^[\w-]{11}$/.test(id) ? id : null
      }
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})(?:\/|$)/i)
      return m ? m[2] : null
    }
  } catch {
    /* ignore */
  }
  return null
}

function getVimeoVideoId(url: string) {
  try {
    const u = new URL(normalizeExternalUrl(url))
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (host === 'player.vimeo.com' && parts[0] === 'video' && /^\d+$/.test(parts[1] || '')) {
      return parts[1]
    }
    if (/^\d+$/.test(parts[0] || '')) return parts[0]
  } catch {
    /* ignore */
  }
  return null
}

function isVideoBrowseUrl(url: string) {
  try {
    const u = new URL(normalizeExternalUrl(url))
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (!host.includes('youtube') && host !== 'youtu.be' && !host.includes('vimeo')) {
      return false
    }
    const path = u.pathname.toLowerCase()
    if (
      path.startsWith('/results') ||
      path.startsWith('/playlist') ||
      path.startsWith('/channel/') ||
      path.startsWith('/c/') ||
      path.startsWith('/user/') ||
      path.startsWith('/@') ||
      path.startsWith('/feed') ||
      path.startsWith('/hashtag/')
    ) {
      return true
    }
    if (u.searchParams.has('search_query') || u.searchParams.has('q')) return true
  } catch {
    /* ignore */
  }
  return false
}

export type VideoAction =
  | { mode: 'embed'; url: string; embedUrl: string }
  | { mode: 'external'; url: string }

export function resolveVideoAction(url?: string | null): VideoAction | null {
  const openUrl = normalizeExternalUrl(url)
  if (!openUrl) return null
  if (isVideoBrowseUrl(openUrl)) {
    return { mode: 'external', url: openUrl }
  }
  const yt = getYoutubeVideoId(openUrl)
  if (yt) {
    return {
      mode: 'embed',
      url: openUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,
    }
  }
  const vimeo = getVimeoVideoId(openUrl)
  if (vimeo) {
    return {
      mode: 'embed',
      url: openUrl,
      embedUrl: `https://player.vimeo.com/video/${vimeo}?autoplay=1`,
    }
  }
  return { mode: 'external', url: openUrl }
}
