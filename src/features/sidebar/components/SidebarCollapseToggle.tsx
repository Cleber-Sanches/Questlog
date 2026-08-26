import { useT } from '@/app/providers/LocaleProvider'
import { useSidebarCollapse } from '@/features/sidebar/SidebarCollapseContext'

type Props = {
  className?: string
  variant?: 'sidebar' | 'toolbar'
}

export function SidebarCollapseToggle({ className, variant = 'sidebar' }: Props) {
  const t = useT()
  const { collapsed, toggleCollapsed } = useSidebarCollapse()
  const label = collapsed ? t('nav.expand') : t('nav.collapse')

  return (
    <button
      type="button"
      className={[
        'sidebarCollapseToggle',
        variant === 'toolbar' ? 'is-toolbar' : 'is-sidebar',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-pressed={collapsed}
      onClick={toggleCollapsed}
    >
      <i
        className={`ph-duotone ph-sidebar-simple${collapsed ? ' is-collapsed' : ''}`}
        aria-hidden
      />
    </button>
  )
}
