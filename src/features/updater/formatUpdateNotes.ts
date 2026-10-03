/** Remove boilerplate técnico do release (Setup/NSIS/latest.json) das notas do updater. */
export function formatUpdateNotes(raw: string | null | undefined, version?: string | null): string {
  const fallback = version
    ? `Novidades da versão ${version}.\nO app reinicia depois de instalar.`
    : 'Atualização disponível.\nO app reinicia depois de instalar.'

  if (!raw?.trim()) return fallback

  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let skipBlock = false

  for (const line of lines) {
    const t = line.trim()

    if (/^#{1,3}\s*download\b/i.test(t)) {
      skipBlock = true
      continue
    }
    if (skipBlock) {
      if (/^#{1,3}\s+\S/.test(t) && !/^#{1,3}\s*download\b/i.test(t)) {
        skipBlock = false
      } else {
        continue
      }
    }

    if (
      /questlog-setup\.exe/i.test(t) ||
      /\bnsis\b/i.test(t) ||
      /latest\.json/i.test(t) ||
      /instalador visual/i.test(t) ||
      /updater automático/i.test(t) ||
      /busca atualiza/i.test(t) ||
      /github\.com\/.*\/releases\/latest\/download/i.test(t) ||
      /^\*\*full changelog\*\*/i.test(t)
    ) {
      continue
    }

    out.push(line)
  }

  const cleaned = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!cleaned || cleaned.length < 12) return fallback
  return cleaned
}
