import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  /** Default 1.75 — a bit heavier than Raycast stock (1.5) for dark UI. */
  strokeWidth?: number | string
}

function iconPathProps(strokeWidth: number | string = 1.75) {
  return {
    stroke: 'currentColor' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth,
  }
}

/** Glyphs from Raycast Icons — local copies (avoids nested React 18 from @raycast/icons). */
export function ArrowClockwiseIcon({ strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        {...iconPathProps(strokeWidth)}
        d="M14.25 9.75 12 12.25m0 0-2.25-2.5m2.25 2.5V8.875a5.125 5.125 0 1 0-10.25 0v3.375"
      />
    </svg>
  )
}

/** Relógio com seta — sync automático. */
export function SyncAutoIcon({ strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" {...props}>
      <circle {...iconPathProps(strokeWidth)} cx="8" cy="8" r="5.25" />
      <path {...iconPathProps(strokeWidth)} d="M8 5.25V8l2 1.25" />
    </svg>
  )
}

/** Sino de notificações. */
export function BellIcon({ strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        {...iconPathProps(strokeWidth)}
        d="M6.25 13.25a1.75 1.75 0 0 0 3.5 0M3.25 10.75h9.5l-1.1-1.65V6.5a3.9 3.9 0 1 0-7.8 0v2.6l-1.1 1.65Z"
      />
    </svg>
  )
}

export function UploadIcon({ strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        {...iconPathProps(strokeWidth)}
        d="M1.75 11.75v.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2v-.5M8 10.25v-8.5m0 0 3.25 3.5M8 1.75l-3.25 3.5"
      />
    </svg>
  )
}

export function DownloadIcon({ strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        {...iconPathProps(strokeWidth)}
        d="M8 10.25v-8.5m0 8.5 3.25-3.5M8 10.25l-3.25-3.5m-3 5v.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2v-.5"
      />
    </svg>
  )
}
