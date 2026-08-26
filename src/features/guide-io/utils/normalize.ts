import type { Achievement } from '@/types/achievement'

const ALIASES: Record<string, string> = {
  grupo: 'group',
  group: 'group',
  dlc: 'dlc',
  dicas: 'tips',
  tips: 'tips',
  comoDesbloquear: 'tips',
  video: 'videoUrl',
  videoUrl: 'videoUrl',
  linkGuia: 'guideUrl',
  guideUrl: 'guideUrl',
  dificuldade: 'difficulty',
  difficulty: 'difficulty',
  perdivel: 'missable',
  missable: 'missable',
  nivel: 'reqLevel',
  nivelRecomendado: 'reqLevel',
  reqLevel: 'reqLevel',
  apiName: 'apiName',
  title: 'title',
  titleEn: 'titleEn',
  tituloEn: 'titleEn',
  description: 'description',
  descriptionEn: 'descriptionEn',
  descricaoEn: 'descriptionEn',
  groupEn: 'groupEn',
  grupoEn: 'groupEn',
  iconHash: 'iconHash',
}

function hasGuideContent(entry: Record<string, unknown>) {
  const keys = [
    'group',
    'groupEn',
    'dlc',
    'tips',
    'videoUrl',
    'guideUrl',
    'difficulty',
    'missable',
    'reqLevel',
    'description',
    'descriptionEn',
    'titleEn',
  ]
  return keys.some((k) => {
    const v = entry[k]
    if (typeof v === 'boolean') return v
    return String(v ?? '').trim().length > 0
  })
}

export function normalizeGuideEntry(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const mapped = ALIASES[key] || key
    out[mapped] = value
  }
  return out
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function iconFromHash(appId: string, hash: unknown) {
  const clean = text(hash).trim().toLowerCase()
  if (!appId || !/^[a-f0-9]{40}$/.test(clean)) return ''
  return `https://shared.fastly.steamstatic.com/community_assets/images/apps/${appId}/${clean}.jpg`
}

function entryToAchievement(
  entry: Record<string, unknown>,
  id: number,
  appId: string,
): Achievement {
  return {
    id,
    apiName: text(entry.apiName) || `guia_${id}`,
    title: text(entry.title) || `Conquista ${id}`,
    description: text(entry.description),
    titleEn: text(entry.titleEn),
    descriptionEn: text(entry.descriptionEn),
    icon: iconFromHash(appId, entry.iconHash),
    group: text(entry.group),
    groupEn: text(entry.groupEn),
    dlc: text(entry.dlc),
    tips: text(entry.tips),
    videoUrl: text(entry.videoUrl),
    guideUrl: text(entry.guideUrl),
    difficulty: text(entry.difficulty) as Achievement['difficulty'],
    missable: entry.missable === true,
    reqLevel: text(entry.reqLevel),
    completed: false,
  }
}

/** Usado quando a Steam não devolve a lista de conquistas: o guia vira a própria lista. */
export function achievementsFromGuidePack(
  appId: string,
  entries: Array<Record<string, unknown>>,
): Achievement[] {
  return entries
    .map(normalizeGuideEntry)
    .filter((e) => text(e.title).trim() || text(e.apiName).trim())
    .map((e, i) => entryToAchievement(e, i + 1, appId))
}

export function applyGuideEntries(
  current: Achievement[],
  entries: Array<Record<string, unknown>>,
  appId = '',
) {
  const normalized = entries.map(normalizeGuideEntry).filter(hasGuideContent)
  const byApi = new Map<string, Record<string, unknown>>()
  const byTitle = new Map<string, Record<string, unknown>>()
  const byHash = new Map<string, Record<string, unknown>>()

  for (const e of normalized) {
    if (e.apiName) byApi.set(String(e.apiName), e)
    if (e.title) byTitle.set(String(e.title).toLowerCase(), e)
    if (e.iconHash) byHash.set(String(e.iconHash).toLowerCase(), e)
  }

  const used = new Set<Record<string, unknown>>()

  const merged = current.map((a) => {
    const hash = /([a-f0-9]{40})/i.exec(a.icon || '')?.[1]?.toLowerCase()
    const guide =
      (a.apiName && byApi.get(a.apiName)) ||
      byTitle.get(a.title.toLowerCase()) ||
      (hash ? byHash.get(hash) : undefined)
    if (!guide) return a
    used.add(guide)

    const next: Achievement = { ...a }
    if (typeof guide.group === 'string' && guide.group.trim()) next.group = guide.group
    if (typeof guide.groupEn === 'string' && guide.groupEn.trim()) next.groupEn = guide.groupEn
    if (typeof guide.dlc === 'string' && guide.dlc.trim()) next.dlc = guide.dlc
    if (typeof guide.tips === 'string' && guide.tips.trim()) next.tips = guide.tips
    if (typeof guide.videoUrl === 'string' && guide.videoUrl.trim()) next.videoUrl = guide.videoUrl
    if (typeof guide.guideUrl === 'string' && guide.guideUrl.trim()) next.guideUrl = guide.guideUrl
    if (typeof guide.difficulty === 'string' && guide.difficulty.trim()) {
      next.difficulty = guide.difficulty as Achievement['difficulty']
    }
    if (typeof guide.reqLevel === 'string' && guide.reqLevel.trim()) next.reqLevel = guide.reqLevel
    if (typeof guide.description === 'string' && guide.description.trim()) {
      next.description = guide.description
    }
    if (typeof guide.descriptionEn === 'string' && guide.descriptionEn.trim()) {
      next.descriptionEn = guide.descriptionEn
    }
    if (typeof guide.titleEn === 'string' && guide.titleEn.trim()) {
      next.titleEn = guide.titleEn
    }
    if (typeof guide.missable === 'boolean') next.missable = guide.missable
    return next
  })

  let nextId = merged.reduce((max, a) => Math.max(max, a.id), 0) + 1
  const extras = normalized
    .filter((e) => !used.has(e) && text(e.title).trim())
    .map((e) => entryToAchievement(e, nextId++, appId))

  return [...merged, ...extras]
}

export function buildGuidePack(game: { appId: string; name: string; links?: { label: string; url: string }[] }, achievements: Achievement[]) {
  return {
    type: 'trophy-desk-pack' as const,
    version: 2,
    exportedAt: new Date().toISOString(),
    note: 'Template de guia — progresso não é exportado',
    game: {
      appId: game.appId,
      name: game.name,
      links: (game.links || []).map((l) => ({ label: l.label, url: l.url })),
    },
    achievements: achievements.map((a) => ({
      apiName: a.apiName || '',
      title: a.title,
      titleEn: a.titleEn || '',
      iconHash: /([a-f0-9]{40})/i.exec(a.icon || '')?.[1] || '',
      group: a.group || '',
      groupEn: a.groupEn || '',
      dlc: a.dlc || '',
      description: a.description || '',
      descriptionEn: a.descriptionEn || '',
      tips: a.tips || '',
      videoUrl: a.videoUrl || '',
      guideUrl: a.guideUrl || '',
      difficulty: a.difficulty || '',
      missable: !!a.missable,
      reqLevel: a.reqLevel || '',
    })),
  }
}
