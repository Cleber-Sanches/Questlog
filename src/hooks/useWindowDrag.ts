import { useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useTauriDesktop } from '@/hooks/useTauriDesktop'

const INTERACTIVE =
  'button, a, input, textarea, select, [contenteditable], [data-no-drag], [data-window-controls]'

export function useWindowDrag() {
  const desktop = useTauriDesktop()

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!desktop || e.button !== 0) return
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return
      void getCurrentWindow().startDragging()
    },
    [desktop],
  )

  const bind = desktop
    ? ({ className = '' }: { className?: string } = {}) => ({
        className: className ? `${className} window-drag-region` : 'window-drag-region',
        'data-tauri-drag-region': '',
        onPointerDown,
      })
    : ({ className = '' }: { className?: string } = {}) =>
        className ? { className } : {}

  return { desktop, onPointerDown, bind }
}
