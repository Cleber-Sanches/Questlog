export function hotkeyFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.metaKey) parts.push('Super')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (!parts.some((p) => p === 'Ctrl' || p === 'Alt' || p === 'Super')) return null

  let key = ''
  if (event.code.startsWith('Key') && event.code.length === 4) {
    key = event.code.slice(3)
  } else if (event.code.startsWith('Digit') && event.code.length === 6) {
    key = event.code.slice(5)
  } else if (event.code.startsWith('F') && /^F\d+$/.test(event.code)) {
    key = event.code
  } else if (event.code === 'Space') {
    key = 'Space'
  } else if (event.code === 'Escape') {
    key = 'Esc'
  } else if (event.code === 'Tab') {
    key = 'Tab'
  } else if (event.key.length === 1) {
    key = event.key.toUpperCase()
  } else {
    key = event.key
  }
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

export function hotkeyParts(hotkey: string) {
  return hotkey.split('+').map((part) => part.trim()).filter(Boolean)
}
