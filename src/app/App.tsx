import { ToastProvider } from '@/app/providers/ToastProvider'
import { NotificationProvider } from '@/app/providers/NotificationProvider'
import { ModalProvider } from '@/app/providers/ModalProvider'
import { AppDataProvider } from '@/app/providers/AppDataProvider'
import { LocaleProvider } from '@/app/providers/LocaleProvider'
import { RouterProvider, useRouter } from '@/app/router'
import { AppRouteSync } from '@/app/AppRouteSync'
import { AutoUpdateCheck } from '@/features/updater/components/AutoUpdateCheck'
import { GuidePage } from '@/pages/GuidePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ArchivedGamesPage } from '@/pages/ArchivedGamesPage'

function Routes() {
  const { route } = useRouter()
  if (route === 'settings') return <SettingsPage />
  if (route === 'archived') return <ArchivedGamesPage />
  return <GuidePage />
}

export default function App() {
  return (
    <ToastProvider>
      <NotificationProvider>
        {/* AppData deve envolver Modal: o conteúdo do modal é renderizado
            como irmão de children do ModalProvider, não dentro do Router. */}
        <AppDataProvider>
          <LocaleProvider>
            <ModalProvider>
              <RouterProvider>
                <AppRouteSync />
                <AutoUpdateCheck />
                <div className="app-frame">
                  <Routes />
                </div>
              </RouterProvider>
            </ModalProvider>
          </LocaleProvider>
        </AppDataProvider>
      </NotificationProvider>
    </ToastProvider>
  )
}
