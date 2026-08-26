import { useCallback, useRef } from 'react'

type TapRecord = {
  pointerType: string
  state: boolean
}

/** Guarda o pointerdown pra decidir se um click veio de toque (abre tooltip). */
export function useTapGesture() {
  const record = useRef<TapRecord | null>(null)

  const start = useCallback((event: { pointerType?: string }, open: boolean) => {
    record.current = {
      pointerType: event.pointerType || 'unknown',
      state: open,
    }
  }, [])

  const take = useCallback(() => {
    const next = record.current
    record.current = null
    return next
  }, [])

  const drop = useCallback(() => {
    record.current = null
  }, [])

  return { start, take, drop }
}
