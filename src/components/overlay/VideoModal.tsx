import { Modal } from './Modal'
import { openExternal } from '@/lib/openExternal'
import { Button } from '@/components/ui/Button'
import { useT } from '@/app/providers/LocaleProvider'

export function VideoModal({
  title,
  url,
  embedUrl,
}: {
  title?: string
  url: string
  embedUrl: string
}) {
  const t = useT()
  const heading = title?.trim() || t('video.watch')

  return (
    <Modal title={heading} wide>
      <div
        style={{
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <iframe
          src={embedUrl}
          title={heading}
          style={{ width: '100%', height: '100%', border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <Button variant="ghost" onClick={() => void openExternal(url)}>
          {t('video.openBrowser')}
        </Button>
      </div>
    </Modal>
  )
}
