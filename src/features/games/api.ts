import { invoke } from '@/lib/invoke'
import type { Game } from '@/types/game'

export const gamesApi = {
  upsert: (game: Game) => invoke<void>('db_upsert_game', { game }),
  setArchived: (appId: string, archived: boolean) =>
    invoke<void>('db_set_game_archived', { appId, archived }),
  delete: (appId: string) => invoke<void>('db_delete_game', { appId }),
  setActive: (appId: string | null) => invoke<void>('db_set_active_game', { appId }),
}
