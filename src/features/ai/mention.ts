import type { Achievement } from '@/types/achievement'

/** Token inserido no texto: @[Título](apiName) ou @[Título] */
export function formatMention(a: Achievement): string {
  const title = (a.title || 'Conquista').replace(/[\[\]]/g, '')
  const api = a.apiName?.trim()
  if (api) return `@[${title}](${api})`
  return `@[${title}]`
}

export type ActiveMention = {
  /** índice do '@' */
  start: number
  /** texto após o @ (filtro) */
  query: string
}

/** Detecta menção em digitação: ...@query|cursor */
export function findActiveMention(text: string, cursor: number): ActiveMention | null {
  const before = text.slice(0, cursor)
  // Não reabrir se já estamos no meio de um token @[...] completo
  const openToken = before.lastIndexOf('@[')
  if (openToken !== -1) {
    const afterOpen = before.slice(openToken)
    const close = afterOpen.indexOf(']')
    if (close === -1) {
      // digitando dentro de @[... incompleto - raramente acontece
      return { start: openToken, query: afterOpen.slice(2) }
    }
  }

  const at = before.lastIndexOf('@')
  if (at < 0) return null

  // '@' não pode ser parte de e-mail: char anterior alfanumérico
  if (at > 0) {
    const prev = before[at - 1]
    if (prev && /[\w@.]/.test(prev)) return null
  }

  const afterAt = before.slice(at + 1)
  // token já fechado @[...](...) 
  if (afterAt.startsWith('[')) return null
  // query: tudo até fim (sem newline); permite espaços para filtrar
  if (afterAt.includes('\n')) return null
  // se já tem '](' no meio sem ser open token, ignore
  if (/[\[\]]/.test(afterAt)) return null

  return { start: at, query: afterAt }
}

export function insertMentionAt(
  text: string,
  cursor: number,
  start: number,
  achievement: Achievement,
): { text: string; cursor: number } {
  const token = formatMention(achievement)
  const before = text.slice(0, start)
  const after = text.slice(cursor)
  // espaço após menção para continuar digitando
  const next = `${before}${token} ${after}`
  const nextCursor = before.length + token.length + 1
  return { text: next, cursor: nextCursor }
}

export function filterAchievementsForMention(
  list: Achievement[],
  query: string,
  limit = 12,
): Achievement[] {
  const q = query.trim().toLocaleLowerCase('pt-BR')
  const scored = list.map((a, i) => {
    const title = a.title.toLocaleLowerCase('pt-BR')
    const api = (a.apiName || '').toLocaleLowerCase('pt-BR')
    let score = 0
    if (!q) score = 1
    else if (title.startsWith(q)) score = 100
    else if (title.includes(q)) score = 50
    else if (api.includes(q)) score = 40
    else {
      for (const t of q.split(/\s+/).filter((x) => x.length > 1)) {
        if (title.includes(t)) score += 10
      }
    }
    return { a, i, score }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .slice(0, limit)
    .map((x) => x.a)
}

/** Destaca menções na bolha do usuário */
export function splitMentionText(content: string): Array<{ type: 'text' | 'mention'; value: string }> {
  const re = /@\[([^\]]+)\](?:\(([^)]+)\))?/g
  const parts: Array<{ type: 'text' | 'mention'; value: string }> = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    if (m.index > last) {
      parts.push({ type: 'text', value: content.slice(last, m.index) })
    }
    parts.push({ type: 'mention', value: m[1] })
    last = m.index + m[0].length
  }
  if (last < content.length) {
    parts.push({ type: 'text', value: content.slice(last) })
  }
  if (!parts.length) parts.push({ type: 'text', value: content })
  return parts
}
