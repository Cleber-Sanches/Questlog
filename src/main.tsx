import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from '@/app/App'
import { UnlockOverlayApp } from '@/features/overlay/UnlockOverlayApp'
import { CompanionOverlayApp } from '@/features/companion/CompanionOverlayApp'
import '@/styles/global.css'
import '@/styles/unlock-overlay.css'
import '@/styles/companion-overlay.css'

const windowLabel = isTauri() ? getCurrentWindow().label : 'main'
const overlay = windowLabel === 'overlay'
const companion = windowLabel === 'companion'

if (overlay) {
  document.documentElement.classList.add('is-overlay')
  document.body.classList.add('is-overlay')
}

if (companion) {
  document.documentElement.classList.add('is-companion')
  document.body.classList.add('is-companion')
}

createRoot(document.getElementById('root')!).render(
  overlay ? (
    <UnlockOverlayApp />
  ) : companion ? (
    <CompanionOverlayApp />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
