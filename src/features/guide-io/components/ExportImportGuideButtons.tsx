import { useRef } from 'react'
import { DownloadIcon, UploadIcon } from '@/components/icons/raycast'
import { Button } from '@/components/ui/Button'
import { useGuideExport } from '@/features/guide-io/hooks/useGuideExport'
import { useGuideImport } from '@/features/guide-io/hooks/useGuideImport'
import { useT } from '@/app/providers/LocaleProvider'

export function ExportImportGuideButtons() {
  const t = useT()
  const { exportGuide } = useGuideExport()
  const { importGuide } = useGuideImport()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="headerGuideGroup" role="group" aria-label={t('guide.io.group')}>
      <Button
        variant="secondary"
        size="icon"
        title={t('guide.io.export.tip')}
        tooltipSide="bottom"
        onClick={() => void exportGuide()}
        aria-label={t('guide.io.export.aria')}
      >
        <UploadIcon width={16} height={16} className="btnIcon" aria-hidden />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        title={t('guide.io.import.tip')}
        tooltipSide="bottom"
        onClick={() => fileRef.current?.click()}
        aria-label={t('guide.io.import.aria')}
      >
        <DownloadIcon width={16} height={16} className="btnIcon" aria-hidden />
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importGuide(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
