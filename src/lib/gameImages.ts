import type { Game } from '@/types/game'

/** Capas da Store (alta resolução) — cards de arquivados. */
export function gameCoverCandidates(game: Pick<Game, 'appId' | 'image' | 'icon'>) {
  const appId = game.appId
  if (!appId) return [game.image, game.icon].filter(Boolean) as string[]

  const list = [
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
  ]

  // Ícone/clienticon só como último recurso (não é capa)
  if (game.image) list.push(game.image)
  if (game.icon) list.push(game.icon)

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
