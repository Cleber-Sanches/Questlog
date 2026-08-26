import { Modal } from './Modal'
import { Button } from '@/components/ui/Button'
import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}) {
  const { closeModal } = useModal()
  const t = useT()
  const confirm = confirmLabel ?? t('common.confirm')

  return (
    <Modal title={title}>
      <p style={{ color: 'var(--color-text-body)' }}>{message}</p>
      <div className="modal-actions">
        <Button onClick={closeModal}>{t('common.cancel')}</Button>
        <Button
          variant="primary"
          onClick={() => {
            onConfirm()
            closeModal()
          }}
        >
          {confirm}
        </Button>
      </div>
    </Modal>
  )
}
