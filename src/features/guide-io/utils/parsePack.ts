import { isGuidePackType } from '@/features/backup/packTypes'
import { normalizeGuideEntry } from './normalize'
import type { GuidePack } from '@/types/backup'

export function looksLikeGuidePack(text: string) {
  const raw = text.trim()
  if (!raw.startsWith('{')) return false
  try {
    const pack = JSON.parse(raw) as GuidePack
    return isGuidePackType(pack.type)
  } catch {
    return false
  }
}

export function parseGuidePack(text: string): GuidePack {
  let pack: GuidePack
  try {
    pack = JSON.parse(text) as GuidePack
  } catch {
    throw new Error('invalid')
  }
  if (!isGuidePackType(pack.type)) throw new Error('invalid')
  return pack
}

export function isGuideFile(file: File) {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return name.endsWith('.json') || type.includes('json') || type === ''
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function tipsPlain(value: unknown) {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function iconFromHash(appId: string, hash: unknown) {
  const clean = text(hash).toLowerCase()
  if (!appId || !/^[a-f0-9]{40}$/.test(clean)) return ''
  return `https://shared.fastly.steamstatic.com/community_assets/images/apps/${appId}/${clean}.jpg`
}

function entryRichness(entry: Record<string, unknown>) {
  let score = 0
  if (tipsPlain(entry.tips)) score += 4
  if (text(entry.videoUrl)) score += 2
  if (text(entry.guideUrl)) score += 2
  if (text(entry.difficulty)) score += 1
  if (entry.missable === true) score += 1
  return score
}

export type GuidePackPreviewRow = {
  key: string
  title: string
  description: string
  tip: string
  icon: string
  hasTips: boolean
  hasVideo: boolean
  hasGuide: boolean
  difficulty: string
  missable: boolean
  hidden: boolean
  hasContent: boolean
}

export function summarizeGuidePack(pack: GuidePack, currentAppId?: string | null) {
  const entries = pack.achievements || []
  const appId = String(pack.game?.appId || '')
  let withTips = 0
  let withVideo = 0
  let withGuide = 0
  let withDifficulty = 0
  let withMissable = 0
  let filled = 0

  const rows: GuidePackPreviewRow[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = normalizeGuideEntry(entries[i])
    const tip = tipsPlain(entry.tips)
    const hasTips = tip.length > 0
    const hasVideo = text(entry.videoUrl).length > 0
    const hasGuide = text(entry.guideUrl).length > 0
    const difficulty = text(entry.difficulty)
    const missable = entry.missable === true
    const score = entryRichness(entry)
    if (hasTips) withTips += 1
    if (hasVideo) withVideo += 1
    if (hasGuide) withGuide += 1
    if (difficulty) withDifficulty += 1
    if (missable) withMissable += 1
    if (score > 0) filled += 1

    const apiName = text(entry.apiName)
    rows.push({
      key: apiName || `row-${i}`,
      title: text(entry.title) || text(entry.titleEn) || apiName || `Conquista ${i + 1}`,
      description: text(entry.description) || text(entry.descriptionEn),
      tip: tip.slice(0, 120),
      icon: iconFromHash(appId, entry.iconHash),
      hasTips,
      hasVideo,
      hasGuide,
      difficulty,
      missable,
      hidden: entry.hidden === true,
      hasContent: score > 0,
    })
  }

  return {
    gameName: String(pack.game?.name || '').trim() || appId,
    appId,
    count: entries.length,
    filled,
    bare: Math.max(0, entries.length - filled),
    withTips,
    withVideo,
    withGuide,
    withDifficulty,
    withMissable,
    rows,
    hasContent: filled > 0,
    switchesGame: Boolean(currentAppId && appId && currentAppId !== appId),
  }
}

export type GuidePackSummary = ReturnType<typeof summarizeGuidePack>
