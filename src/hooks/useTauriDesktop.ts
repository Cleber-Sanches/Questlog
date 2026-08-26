import { useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'

export function useTauriDesktop() {
  const [desktop] = useState(() => typeof window !== 'undefined' && isTauri())

  useEffect(() => {
    if (desktop) document.documentElement.classList.add('is-tauri')
  }, [desktop])

  return desktop
}
