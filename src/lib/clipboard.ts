import { isTauri } from '@tauri-apps/api/core'

function writeViaDom(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  const ok = document.execCommand('copy')
  el.remove()
  if (!ok) throw new Error('clipboard-unavailable')
}

export async function writeClipboard(text: string) {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(text)
      return
    } catch {
      writeViaDom(text)
      return
    }
  }
  writeViaDom(text)
}

export async function readClipboard() {
  if (isTauri()) {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
    return readText()
  }
  throw new Error('clipboard-unavailable')
}
