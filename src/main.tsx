import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from '@/app/App'
import { UnlockOverlayApp } from '@/features/overlay/UnlockOverlayApp'
import '@/styles/global.css'
import '@/styles/unlock-overlay.css'

const overlay = isTauri() && getCurrentWindow().label === 'overlay'

if (overlay) {
  document.documentElement.classList.add('is-overlay')
  document.body.classList.add('is-overlay')
}

createRoot(document.getElementById('root')!).render(
  overlay ? (
    <UnlockOverlayApp />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
