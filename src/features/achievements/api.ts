import { invoke } from '@/lib/invoke'
import type { Achievement } from '@/types/achievement'

export const achievementsApi = {
  list: (appId: string) => invoke<Achievement[]>('db_list_achievements', { appId }),
  setAll: (appId: string, achievements: Achievement[]) =>
    invoke<void>('db_set_achievements', { appId, achievements }),
  patch: (appId: string, achievement: Achievement) =>
    invoke<void>('db_patch_achievement', { appId, achievement }),
  insert: (appId: string, achievement: Achievement) =>
    invoke<void>('db_insert_achievement', { appId, achievement }),
  remove: (appId: string, id: number) =>
    invoke<void>('db_delete_achievement', { appId, id }),
  setCollapsed: (appId: string, view: string, sectionName: string, collapsed: boolean) =>
    invoke<void>('db_set_collapsed', { appId, view, sectionName, collapsed }),
}
