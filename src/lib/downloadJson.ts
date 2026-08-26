import { isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

export async function downloadJson(filename: string, data: unknown): Promise<boolean> {
  const content = JSON.stringify(data, null, 2)

  if (isTauri()) {
    const path = await save({
      defaultPath: filename,
      filters: [{ name: 'Arquivo JSON', extensions: ['json'] }],
    })
    if (!path) return false

    await writeTextFile(path, content)
    return true
  }

  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}
