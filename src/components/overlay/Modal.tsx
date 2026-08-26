import type { ReactNode } from 'react'
import { useModal } from '@/app/providers/ModalProvider'
import { Button } from '@/components/ui/Button'
import { useT } from '@/app/providers/LocaleProvider'

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string
  children: ReactNode
  onClose?: () => void
  wide?: boolean
}) {
  const { closeModal } = useModal()
  const t = useT()
  const close = onClose ?? closeModal

  return (
    <div className="modal-backdrop" onClick={close} role="presentation">
      <div
        className={`modal${wide ? ' is-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <h2>{title}</h2>
          <Button variant="ghost" onClick={close} aria-label={t('common.close')} title={t('common.close')}>
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
