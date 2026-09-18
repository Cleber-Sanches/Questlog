import { useEffect, useRef, useState } from 'react'
import { useAppUpdater } from '@/features/updater/hooks/useAppUpdater'
import { UpdateAlertDialog } from './UpdateAlertDialog'

/** Verifica atualizações após abrir e mostra um alerta se houver versão nova. */
export function AutoUpdateCheck() {
  const { phase, availableVersion, installUpdate } = useAppUpdater({ autoCheck: true })
  const [alertVersion, setAlertVersion] = useState<string | null>(null)
  const shown = useRef(false)

  useEffect(() => {
    if (phase !== 'available' || !availableVersion || shown.current) return
    shown.current = true
    setAlertVersion(availableVersion)
  }, [phase, availableVersion])

  if (!alertVersion) return null

  return (
    <UpdateAlertDialog
      version={alertVersion}
      onDismiss={() => setAlertVersion(null)}
      onInstall={() => {
        void installUpdate()
        setAlertVersion(null)
      }}
    />
  )
}
