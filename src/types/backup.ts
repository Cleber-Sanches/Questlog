export interface BackupInfo {
  path: string
  externalPath?: string | null
  createdAt: string
}

export interface BackupStatus {
  lastBackupAt?: string | null
  lastBackupPath?: string | null
  externalBackupDir?: string | null
}

export interface ProfilePack {
  type: 'questlog-profile' | 'trophy-desk-profile' | 'guia-conquistas-profile'
  version: number
  exportedAt?: string
  activeGameAppId?: string | null
  games: import('./game').Game[]
  achievementsByAppId: Record<string, import('./achievement').Achievement[]>
  prefs?: {
    collapsedSections?: Record<string, boolean>
  }
}

export interface GuidePack {
  type: 'questlog-pack' | 'trophy-desk-pack' | 'guia-conquistas-pack'
  version: number
  exportedAt?: string
  game: {
    appId: string
    name: string
    links?: { label: string; url: string }[]
  }
  achievements: Array<Record<string, unknown>>
}
