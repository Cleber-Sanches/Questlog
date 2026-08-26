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
}

export type StatusFilter = 'all' | 'completed' | 'pending'
export type GroupBy = 'flat' | 'group' | 'dlc' | 'difficulty' | 'reqLevel'

export const GROUP_BY_OPTIONS: Array<{
  value: GroupBy
  label: string
  icon: string
}> = [
  { value: 'flat', label: 'Lista', icon: 'ph-duotone ph-list-bullets' },
  { value: 'group', label: 'Grupos', icon: 'ph-duotone ph-squares-four' },
  { value: 'dlc', label: 'DLC', icon: 'ph-fill ph-puzzle-piece' },
  { value: 'difficulty', label: 'Dificuldade', icon: 'ph-duotone ph-gauge' },
  { value: 'reqLevel', label: 'Nível', icon: 'ph-duotone ph-stairs' },
]
