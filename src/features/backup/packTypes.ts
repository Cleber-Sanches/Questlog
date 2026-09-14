export const PROFILE_PACK_TYPES = [
  'questlog-profile',
  'trophy-desk-profile',
  'guia-conquistas-profile',
] as const
export const GUIDE_PACK_TYPES = [
  'questlog-pack',
  'trophy-desk-pack',
  'guia-conquistas-pack',
] as const

export type ProfilePackType = (typeof PROFILE_PACK_TYPES)[number]
export type GuidePackType = (typeof GUIDE_PACK_TYPES)[number]

export function isProfilePackType(type: string | undefined): type is ProfilePackType {
  return PROFILE_PACK_TYPES.includes(type as ProfilePackType)
}

export function isGuidePackType(type: string | undefined): type is GuidePackType {
  return GUIDE_PACK_TYPES.includes(type as GuidePackType)
}
