import { useAppUpdater } from '@/features/updater/hooks/useAppUpdater'

/** Verifica atualizações em segundo plano após o app abrir. */
export function AutoUpdateCheck() {
  useAppUpdater({ autoCheck: true })
  return null
}
