export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function slugFilename(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

/** Contagem de progresso Steam — compacta quando o número fica grande demais no card. */
export function formatProgressCount(value: number, locale = 'pt-BR') {
  const n = Math.max(0, Math.round(value))
  if (n >= 10_000) {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(n)
  }
  return new Intl.NumberFormat(locale).format(n)
}
