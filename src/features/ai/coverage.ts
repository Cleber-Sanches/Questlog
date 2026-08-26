export type CoverageStat = {
  label: string
  value: string
  total?: string
  /** Texto extra após o número, ex.: "6 (sem zona…)" */
  detail?: string
}

export type SplitReply = {
  body: string
  stats: CoverageStat[]
  note: string
  followUp: string | null
}

const COVER_SPLIT =
  /(?:\n---\s*)?\n+#{2,3}\s*Cobertura\s*\n+([\s\S]*)$/i

const STAT_LINE =
  /^\s*[-*]\s+\*\*(.+?):\*\*\s*(.+?)\s*$/

function stripMd(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .trim()
}

function parseStatValue(raw: string): Pick<CoverageStat, 'value' | 'total' | 'detail'> {
  const ratio = raw.match(/^(\d+)\s*(?:de|\/)\s*(\d+)\s*(?:\((.+)\))?\s*$/i)
  if (ratio) {
    return {
      value: ratio[1],
      total: ratio[2],
      detail: ratio[3]?.trim(),
    }
  }

  const withDetail = raw.match(/^(\d+)\s*\((.+)\)\s*$/)
  if (withDetail) {
    return { value: withDetail[1], detail: withDetail[2].trim() }
  }

  const plainNum = raw.match(/^(\d+)\s*$/)
  if (plainNum) return { value: plainNum[1] }

  return { value: raw }
}

export function splitCoverage(text: string): SplitReply {
  const match = COVER_SPLIT.exec(text)
  if (!match) {
    return { body: text.trim(), stats: [], note: '', followUp: null }
  }

  const body = text.slice(0, match.index).trim()
  const rest = match[1].trim()
  const stats: CoverageStat[] = []
  const notes: string[] = []

  for (const line of rest.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '---') continue
    const stat = STAT_LINE.exec(trimmed)
    if (stat) {
      stats.push({
        label: stripMd(stat[1]),
        ...parseStatValue(stripMd(stat[2])),
      })
      continue
    }
    notes.push(trimmed)
  }

  const note = stripMd(notes.join(' '))
  // Só sugere follow-up se ainda houver buraco real nas stats
  const stillMissing = stats.some((s) => {
    if (!s.total) return false
    const v = Number(s.value)
    const t = Number(s.total)
    if (!Number.isFinite(v) || !Number.isFinite(t) || t <= 0) return false
    const label = s.label.toLowerCase()
    if (/dicas|nível|nivel|v[ií]deo|grupo|dificuldade|perd[ií]v|sem /.test(label)) return v < t
    if (/alterad/.test(label)) return false
    return v < t
  })

  const blob = `${note} ${stats.map((s) => s.label).join(' ')}`.toLowerCase()
  let followUp: string | null = null
  if (stillMissing && /completa .+ que falt|completa o que falta|nos vazios/i.test(note)) {
    if (
      /não vai inventar|nao vai inventar|não há nível explícito|nao ha nivel|não inventar valores|nao inventar valores/i.test(
        note,
      )
    ) {
      followUp = null
    } else if (/v[ií]deo/.test(blob)) followUp = 'Completa os vídeos que faltam'
    else if (/n[ií]vel/.test(blob)) followUp = 'Completa os níveis que faltam'
    else if (/dica/.test(blob)) followUp = 'Completa as dicas que faltam'
    else followUp = 'Completa o que falta'
  }

  return {
    body,
    stats,
    note: stillMissing
      ? note
      : note.replace(/peça\s+\*?completa .+?\*?\.?/gi, '').trim(),
    followUp,
  }
}

/** Fallback: meta do turn vira linhas de Cobertura (evita chip verde solto). */
export function statsFromMeta(meta?: string): CoverageStat[] {
  if (!meta?.trim()) return []
  const videos = meta.match(/(\d+)\s*v[ií]deos?(?:\s+do\s+YouTube)?/i)
  if (videos) {
    return [{ label: 'Vídeos adicionados', value: videos[1] }]
  }
  const updated = meta.match(/(\d+)\s*conquista/i)
  if (updated) {
    return [{ label: 'Alteradas nesta rodada', value: updated[1] }]
  }
  return []
}
