import { useEffect, type RefObject } from 'react'

/** Fecha ao clicar fora ou apertar Escape. */
export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (root.contains(event.target as Node)) return
      onDismiss()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onDismiss, rootRef])
}
