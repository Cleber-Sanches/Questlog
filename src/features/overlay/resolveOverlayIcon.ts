import { convertFileSrc, isTauri } from '@tauri-apps/api/core'

export function resolveOverlayIcon(icon?: string | null): string | null {
  const value = icon?.trim()
  if (!value) return null
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('asset:') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value
  }
  if (!isTauri()) return value
  try {
    return convertFileSrc(value)
  } catch {
    return value
  }
}
