import { invoke } from '@/lib/invoke'
import { normalizeExternalUrl } from '@/lib/url'

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Abre URL no navegador do sistema (Tauri) ou numa nova aba (web). */
export async function openExternal(url?: string | null) {
  const normalized = normalizeExternalUrl(url)
  if (!normalized) return

  if (isTauriRuntime()) {
    await invoke('open_external_url', { url: normalized })
    return
  }

  window.open(normalized, '_blank', 'noopener,noreferrer')
}
