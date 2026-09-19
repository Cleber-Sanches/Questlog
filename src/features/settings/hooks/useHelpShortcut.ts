import { useEffect } from 'react'
import { useRouter } from '@/app/router'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

export function useHelpShortcut(enabled = true) {
  const { navigate } = useRouter()

  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key !== '?' && !(event.key === '/' && event.shiftKey)) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      navigate('settings', { settingsSection: 'help' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, navigate])
}
