export function DifficultyIcon({ kind }: { kind: 'easy' | 'medium' | 'hard' | 'missable' }) {
  if (kind === 'missable') {
    return (
      <svg className="diffHex is-missable" viewBox="0 0 18 18" aria-hidden>
        <polygon className="diffHexShape" points="9,1.5 16,5.5 16,12.5 9,16.5 2,12.5 2,5.5" />
        <path
          className="diffHexMark"
          d="M9 5.2v5.2"
          strokeLinecap="round"
        />
        <circle className="diffHexDot" cx="9" cy="12.8" r="0.95" />
      </svg>
    )
  }
  if (kind === 'easy') {
    return (
      <svg className="diffHex is-easy" viewBox="0 0 18 18" aria-hidden>
        <polygon className="diffHexShape" points="9,1.5 16,5.5 16,12.5 9,16.5 2,12.5 2,5.5" />
        <path className="diffHexMark" d="M6.2 9.1l1.8 1.8 3.8-3.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'medium') {
    return (
      <svg className="diffHex is-medium" viewBox="0 0 18 18" aria-hidden>
        <polygon className="diffHexShape" points="9,1.5 16,5.5 16,12.5 9,16.5 2,12.5 2,5.5" />
        <path className="diffHexMark" d="M6 9h6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className="diffHex is-hard" viewBox="0 0 18 18" aria-hidden>
      <polygon className="diffHexShape" points="9,1.5 16,5.5 16,12.5 9,16.5 2,12.5 2,5.5" />
      <path className="diffHexMark" d="M6.5 6.5l5 5M11.5 6.5l-5 5" strokeLinecap="round" />
    </svg>
  )
}
