import { useCallback, useRef } from 'react'

type PointerKind = 'mouse' | 'pen' | 'touch' | 'unknown'

function kindOf(event: { pointerType?: string }): PointerKind {
  const t = event.pointerType
  if (t === 'mouse' || t === 'pen' || t === 'touch') return t
  return 'unknown'
}

/** Filtra hover de mouse/pen — evita flicker no touch (compat mouseenter). */
export function useHoverGesture() {
  const active = useRef(false)

  const enter = useCallback((event: { pointerType?: string }) => {
    const kind = kindOf(event)
    if (kind === 'touch') return false
    if (kind === 'unknown') return false
    active.current = true
    return true
  }, [])

  const leave = useCallback((event: { pointerType?: string }) => {
    const kind = kindOf(event)
    if (kind === 'touch') return false
    if (!active.current) return false
    active.current = false
    return true
  }, [])

  const reset = useCallback(() => {
    active.current = false
  }, [])

  return { enter, leave, reset }
}
