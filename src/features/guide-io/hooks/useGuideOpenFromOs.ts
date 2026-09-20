import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'
import { invoke } from '@/lib/invoke'
import { useGuideImport } from '@/features/guide-io/hooks/useGuideImport'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'

/** Abre .questlog / .json / .txt passados pelo SO (duplo clique / Abrir com). */
export function useGuideOpenFromOs(enabled = true) {
  const { importGuideText } = useGuideImport()
  const { toast } = useToast()
  const t = useT()
  const importRef = useRef(importGuideText)
  importRef.current = importGuideText

  useEffect(() => {
    if (!enabled || !isTauri()) return

    let cancelled = false
    const openPath = async (path: string) => {
      try {
        await invoke('app_show_main')
        const text = await invoke<string>('read_guide_open_file', { path })
        if (cancelled) return
        importRef.current(text)
      } catch {
        if (!cancelled) toast(t('toast.guide.invalid'), 'error')
      }
    }

    void invoke<string[]>('take_pending_guide_opens').then((paths) => {
      for (const path of paths) void openPath(path)
    })

    let unlisten: (() => void) | undefined
    void listen<string>('guide-open-path', (event) => {
      void openPath(event.payload)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [enabled, t, toast])
}
