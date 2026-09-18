import { ToastProvider } from '@/app/providers/ToastProvider'
import { NotificationProvider } from '@/app/providers/NotificationProvider'
import { ModalProvider } from '@/app/providers/ModalProvider'
import { AppDataProvider } from '@/app/providers/AppDataProvider'
import { LocaleProvider } from '@/app/providers/LocaleProvider'
import { RouterProvider, useRouter } from '@/app/router'
import { AppRouteSync } from '@/app/AppRouteSync'
import { AutoUpdateCheck } from '@/features/updater/components/AutoUpdateCheck'
import { GuidePage } from '@/pages/GuidePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ArchivedGamesPage } from '@/pages/ArchivedGamesPage'

import { OnboardingFlow } from '@/features/onboarding/components/OnboardingFlow'
import { useOnboarding } from '@/features/onboarding/hooks/useOnboarding'

function Routes({
  onboard,
}: {
  onboard: ReturnType<typeof useOnboarding>
}) {
  const { route } = useRouter()
  if (onboard.active) return <OnboardingFlow onComplete={onboard.complete} />
  if (route === 'settings') return <SettingsPage />
  if (route === 'archived') return <ArchivedGamesPage />
  if (route === 'guide') return <GuidePage />
  return <LibraryPage />
}

function Shell() {
  const onboard = useOnboarding()
  return (
    <>
      <AppRouteSync />
      {onboard.active ? null : <AutoUpdateCheck />}
      <div className="app-frame">
        <Routes onboard={onboard} />
      </div>
    </>
  )
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
                <Shell />
              </RouterProvider>
            </ModalProvider>
          </LocaleProvider>
        </AppDataProvider>
      </NotificationProvider>
    </ToastProvider>
  )
}
