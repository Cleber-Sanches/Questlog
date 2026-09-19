import type { GameLink } from '@/types/game'

export function newLinkId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `link_${crypto.randomUUID()}`
  }
  return `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultGameLinks(appId: string): GameLink[] {
  return [
    {
      id: newLinkId(),
      label: 'Steam',
      url: `https://store.steampowered.com/app/${appId}`,
    },
    {
      id: newLinkId(),
      label: 'SteamDB',
      url: `https://steamdb.info/app/${appId}/`,
    },
  ]
}

export function linkGlyph(url: string, label: string) {
  const hay = `${url} ${label}`.toLowerCase()
  if (hay.includes('steamdb')) return 'ph ph-database'
  if (hay.includes('steampowered') || hay.includes('steamcommunity') || hay.includes('steam')) {
    return 'ph ph-steam-logo'
  }
  if (hay.includes('wiki')) return 'ph ph-book-open-text'
  if (hay.includes('mapa') || hay.includes('map')) return 'ph ph-map-trifold'
  return 'ph ph-link'
}

export function sameLinkUrl(a: string, b: string) {
  return a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()
}

export function mergePresetLinks(existing: GameLink[], presets: GameLink[]) {
  const next = [...existing]
  for (const preset of presets) {
    if (next.some((l) => sameLinkUrl(l.url, preset.url))) continue
    next.push(preset)
  }
  return next
}
