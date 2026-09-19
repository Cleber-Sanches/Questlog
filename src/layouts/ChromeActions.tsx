import { WindowControls } from '@/components/WindowControls'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { HelpButton } from '@/features/settings/components/HelpButton'

export function ChromeActions() {
  return (
    <div className="chromeActions" data-no-drag>
      <HelpButton />
      <NotificationBell />
      <WindowControls inline />
    </div>
  )
}
