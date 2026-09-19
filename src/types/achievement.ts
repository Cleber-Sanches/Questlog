export type Difficulty = 'easy' | 'medium' | 'hard' | '' | null

export interface Achievement {
  id: number
  apiName?: string | null
  title: string
  description?: string | null
  titleEn?: string | null
  descriptionEn?: string | null
  icon?: string | null
  globalPercent?: number | null
  group?: string | null
  groupEn?: string | null
  dlc?: string | null
  tips?: string | null
  videoUrl?: string | null
  guideUrl?: string | null
  difficulty?: Difficulty
  missable?: boolean
  reqLevel?: string | null
  completed?: boolean
  completedManual?: boolean
  unlockedAt?: string | null
  /** Progresso parcial Steam (ex.: 14/20). Só existe em conquistas com barra. */
  progress?: number | null
  progressMax?: number | null
  /** Oculta na Steam até desbloquear. */
  hidden?: boolean
}

export type StatusFilter = 'all' | 'completed' | 'pending'
export type GroupBy = 'queue' | 'flat' | 'group' | 'dlc' | 'difficulty' | 'reqLevel'
export type AchievementSort =
  | 'steam'
  | 'rarityCommon'
  | 'rarityRare'
  | 'progress'
  | 'az'
  | 'unlocked'

export const GROUP_BY_OPTIONS: Array<{
  value: GroupBy
  icon: string
}> = [
  { value: 'queue', icon: 'ph-fill ph-flag-banner' },
  { value: 'flat', icon: 'ph-duotone ph-list-bullets' },
  { value: 'group', icon: 'ph-duotone ph-squares-four' },
  { value: 'dlc', icon: 'ph-fill ph-puzzle-piece' },
  { value: 'difficulty', icon: 'ph-duotone ph-gauge' },
  { value: 'reqLevel', icon: 'ph-duotone ph-stairs' },
]

export const ACHIEVEMENT_SORT_OPTIONS: Array<{
  value: AchievementSort
  icon: string
}> = [
  { value: 'steam', icon: 'ph-fill ph-list-numbers' },
  { value: 'rarityCommon', icon: 'ph-fill ph-chart-bar' },
  { value: 'rarityRare', icon: 'ph-fill ph-star' },
  { value: 'progress', icon: 'ph-fill ph-circle-half' },
  { value: 'az', icon: 'ph-fill ph-text-aa' },
  { value: 'unlocked', icon: 'ph-fill ph-clock-counter-clockwise' },
]

export function isAchievementSort(value: string | null | undefined): value is AchievementSort {
  return (
    value === 'steam' ||
    value === 'rarityCommon' ||
    value === 'rarityRare' ||
    value === 'progress' ||
    value === 'az' ||
    value === 'unlocked'
  )
}
