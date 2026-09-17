import type { Game } from '@/types/game'

/** Ícone 32px da comunidade — não serve como capa. */
export function isCommunityIconUrl(url?: string | null) {
  return !!url && /steamcommunity\/public\/images\/apps\//i.test(url)
}

export function isStoreCoverUrl(url?: string | null) {
  if (!url || isCommunityIconUrl(url)) return false
  return /\/steam\/apps\/|store_item_assets\/steam\/apps\//i.test(url)
}

/** Capas da Store (alta resolução) — cards da biblioteca / arquivados. */
export function gameCoverCandidates(game: Pick<Game, 'appId' | 'image' | 'icon'>) {
  const appId = game.appId
  const list: string[] = []
  if (isStoreCoverUrl(game.image)) list.push(game.image as string)
  if (!appId) return [...new Set(list)]

  list.push(
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
  )

  return [...new Set(list.filter(Boolean))]
}

/** Ícones pequenos — seletor / lista lateral. */
export function gameIconCandidates(game: Pick<Game, 'appId' | 'image' | 'icon' | 'clienticon'>) {
  const list = [game.icon, game.clienticon, game.image].filter(Boolean) as string[]
  if (game.appId) {
    list.push(
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/capsule_184x69.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/capsule_231x87.jpg`,
    )
  }
  return [...new Set(list)]
}

/** Capa vertical da biblioteca (600×900). */
export function gameListIconCandidates(appId: string, fallback?: string | null) {
  const id = appId.trim()
  const list: string[] = []
  if (id) {
    list.push(
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_capsule.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/portrait.png`,
    )
  }
  if (fallback && !isCommunityIconUrl(fallback)) list.push(fallback)
  return [...new Set(list.filter(Boolean))]
}
