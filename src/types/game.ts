export interface GameLink {
  id: string
  label: string
  url: string
}

export interface Game {
  appId: string
  name: string
  image?: string | null
  icon?: string | null
  clienticon?: string | null
  archived?: boolean
  links?: GameLink[]
  metadata?: Record<string, unknown> | null
}
