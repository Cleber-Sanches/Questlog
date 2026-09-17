import { invoke } from '@/lib/invoke'
import type {
  SteamAchievementImport,
  SteamProgress,
  SteamSearchItem,
  SteamSettingsStatus,
} from '@/types/steam'

export const steamApi = {
  progress: (appId: string) => invoke<SteamProgress>('get_steam_progress_cmd', { appId }),
  search: (query: string) =>
    invoke<{ items: SteamSearchItem[] }>('search_steam_games_cmd', { query }),
  achievements: (appId: string) =>
    invoke<{
      appId: string
      source: string
      achievements: SteamAchievementImport[]
      error?: string
    }>('get_steam_achievements_cmd', { appId }),
  dlcGroups: (appId: string) =>
    invoke<{
      appId: string
      groups: Array<{ dlcAppId?: number; dlcAppName: string; achievementApiNames: string[] }>
      byApiName: Record<string, string>
    }>('get_steam_dlc_groups_cmd', { appId }),
  clientIcon: (appId: string) =>
    invoke<{
      appId: string
      name?: string
      clienticon?: string
      icon?: string
      image: string
      cover?: string | null
      ico?: string
      fallback: boolean
    }>('get_steam_client_icon_cmd', { appId }),
  settings: () => invoke<SteamSettingsStatus>('steam_get_settings'),
  setInstallDir: (path: string) => invoke<void>('steam_set_install_dir', { path }),
  refreshLocaleTexts: (appId: string) =>
    invoke<number>('steam_refresh_locale_texts_cmd', { appId }),
}
