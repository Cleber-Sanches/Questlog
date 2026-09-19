import { isTauri } from '@tauri-apps/api/core'
import { invoke } from '@/lib/invoke'
import type { OverlayChime, UnlockOverlayPayload } from './types'
import { resolveOverlayIcon } from './resolveOverlayIcon'
import { playProgressChime, playUnlockChime } from './playUnlockChime'

export async function showUnlockOverlay(
  payload: UnlockOverlayPayload,
  chime: OverlayChime = 'unlock',
): Promise<boolean> {
  if (!isTauri()) return false
  if (chime === 'unlock') playUnlockChime()
  else if (chime === 'progress') playProgressChime()
  try {
    await invoke('overlay_show_unlock', {
      payload: {
        ...payload,
        icon: resolveOverlayIcon(payload.icon),
      },
    })
    return true
  } catch {
    return false
  }
}
