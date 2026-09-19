import { X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useModal } from '@/app/providers/ModalProvider'
import { Button } from '@/components/ui/Button'
import { useT } from '@/app/providers/LocaleProvider'

export function Modal({
  title,
  children,
  onClose,
  wide,
  className,
}: {
  title: string
  children: ReactNode
  onClose?: () => void
  wide?: boolean
  className?: string
}) {
  const { closeModal } = useModal()
  const t = useT()
  const close = onClose ?? closeModal

  return (
    <div className="modal-backdrop" onClick={close} role="presentation">
      <div
        className={`modal${wide ? ' is-wide' : ''}${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="modalHead">
          <h2>{title}</h2>
          <Button
            variant="secondary"
            size="icon"
            onClick={close}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={16} weight="bold" aria-hidden />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
