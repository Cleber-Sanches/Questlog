import { useEffect } from 'react'

export function useKeyboardShortcut(combo: string, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = combo.toLowerCase()
      const pressed = [
        e.ctrlKey || e.metaKey ? 'ctrl' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join('+')
      if (pressed === key || `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.key.toLowerCase()}` === key) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, handler])
}
