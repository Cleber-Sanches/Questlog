export interface SteamSettingsStatus {
  installDir?: string | null
  detectedDir?: string | null
}

export interface SteamSearchItem {
  appId: string
  name: string
  image: string
  steamdbUrl: string
}

export interface SteamProgressAchievement {
  completed: boolean
  unlockedAt?: string | null
  title: string
  icon?: string | null
  iconHash?: string | null
  statGroup: string
  bitIndex: number
}

export interface SteamProgress {
  appId: string
  steamUser: {
    personaName?: string | null
    accountName?: string | null
    steamId3: string
    steamId64?: string
  }
  mtimeMs: number
  /** local = cache Steam; community = perfil público */
  source?: string
  achievements: Record<string, SteamProgressAchievement>
}

export interface SteamAchievementImport {
  id: number
  apiName: string
  title: string
  description: string
  titleEn?: string
  descriptionEn?: string
  icon: string
  completed: boolean
  unlockedAt?: string | null
  group: string
  dlc: string
  videoUrl: string
  guideUrl: string
  tips: string
  globalPercent?: number | null
}
