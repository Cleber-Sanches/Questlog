import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@/lib/invoke'
import { useTauriDesktop } from '@/hooks/useTauriDesktop'

function stopWindowAction(e: ReactMouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

export function WindowControls({ inline = false }: { inline?: boolean }) {
  const desktop = useTauriDesktop()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!desktop) return
    const win = getCurrentWindow()
    void win.isMaximized().then(setMaximized)
    let disposed = false
    let unlisten: (() => void) | undefined
    void win.onResized(() => {
      void win.isMaximized().then((value) => {
        if (!disposed) setMaximized(value)
      })
    }).then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [desktop])

  const minimize = useCallback((e: ReactMouseEvent) => {
    stopWindowAction(e)
    void invoke('app_minimize_or_tray')
  }, [])

  const toggleMaximize = useCallback((e: ReactMouseEvent) => {
    stopWindowAction(e)
    void getCurrentWindow().toggleMaximize()
  }, [])

  const close = useCallback((e: ReactMouseEvent) => {
    stopWindowAction(e)
    void invoke('app_close_or_tray')
  }, [])

  if (!desktop) return null

  return (
    <div
      className={`windowControls${inline ? ' isInline' : ''}`}
      data-window-controls
      data-no-drag
      onMouseDown={stopWindowAction}
      onPointerDown={stopWindowAction}
    >
      <button
        type="button"
        className="windowControl"
        onMouseDown={stopWindowAction}
        onClick={minimize}
        aria-label="Minimizar"
      >
        <i className="ph ph-minus" aria-hidden />
      </button>
      <button
        type="button"
        className="windowControl"
        onMouseDown={stopWindowAction}
        onClick={toggleMaximize}
        aria-label={maximized ? 'Restaurar' : 'Maximizar'}
      >
        <i className={maximized ? 'ph ph-copy' : 'ph ph-square'} aria-hidden />
      </button>
      <button
        type="button"
        className="windowControl windowControlClose"
        onMouseDown={stopWindowAction}
        onClick={close}
        aria-label="Fechar"
      >
        <i className="ph ph-x" aria-hidden />
      </button>
    </div>
  )
}
