import { useEffect, useRef, useState } from 'react'
import { useUpdater } from '@/app/providers/UpdaterProvider'
import { UpdateAlertDialog } from './UpdateAlertDialog'

/** Mostra o alerta quando o check automático acha versão nova. */
export function AutoUpdateCheck() {
  const { phase, availableVersion, progress, installUpdate } = useUpdater()
  const [open, setOpen] = useState(false)
  const shown = useRef(false)
  const busy = phase === 'downloading' || phase === 'installing'

  useEffect(() => {
    if (phase !== 'available' || !availableVersion || shown.current) return
    shown.current = true
    setOpen(true)
  }, [phase, availableVersion])

  if (!open || !availableVersion) return null

  return (
    <UpdateAlertDialog
      version={availableVersion}
      phase={phase}
      progress={progress}
      onDismiss={() => {
        if (busy) return
        setOpen(false)
      }}
      onInstall={() => void installUpdate()}
    />
  )
}
