import { Button } from '@/components/ui/Button'
import { useRouter } from '@/app/router'
import { useT } from '@/app/providers/LocaleProvider'

export function HelpButton() {
  const t = useT()
  const { navigate } = useRouter()

  return (
    <Button
      variant="secondary"
      size="icon"
      title={t('settings.help.open')}
      tooltipSide="bottom"
      aria-label={t('settings.help.open')}
      onClick={() => navigate('settings', { settingsSection: 'help' })}
    >
      <i className="ph ph-question" aria-hidden />
    </Button>
  )
}
