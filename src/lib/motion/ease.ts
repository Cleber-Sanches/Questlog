/** Tokens de motion compartilhados (espelham beUI). */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const

export const EASE_OUT_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const SPRING_PRESS = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const

export const SPRING_SWAP = {
  type: 'spring',
  stiffness: 460,
  damping: 30,
  mass: 0.55,
} as const

/** Pulo do card de atualização ao expandir. */
export const SPRING_JUMP = {
  type: 'spring',
  stiffness: 420,
  damping: 16,
  mass: 0.72,
} as const
