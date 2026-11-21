import { invoke } from '@tauri-apps/api/core'
import type { CompanionSnapshot } from './types'

export async function fetchCompanionSnapshot() {
  return invoke<CompanionSnapshot>('companion_get_snapshot')
}

export async function hideCompanion() {
  await invoke('companion_hide')
}

export async function toggleCompanion() {
  await invoke('companion_toggle')
}

export async function refreshCompanionShortcut() {
  await invoke('companion_refresh_shortcut')
}

export async function setCompanionHotkey(hotkey: string) {
  return invoke<string>('companion_set_hotkey', { hotkey })
}
