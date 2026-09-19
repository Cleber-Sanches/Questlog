import { useCallback } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { downloadJson } from '@/lib/downloadJson'
import { writeClipboard } from '@/lib/clipboard'
import { slugFilename } from '@/lib/format'
import { buildGuidePack } from '../utils/normalize'

export function useGuideExport() {
  const { activeGame, achievements } = useAppData()
  const { toast } = useToast()
  const t = useT()

  const exportGuide = useCallback(async () => {
    if (!activeGame) {
      toast(t('toast.guide.noGame'), 'error')
      return
    }
    try {
      const pack = buildGuidePack(activeGame, achievements)
      const saved = await downloadJson(
        `${slugFilename(activeGame.name) || activeGame.appId}-guia.json`,
        pack,
      )
      if (saved) toast(t('toast.guide.exported'), 'success')
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [activeGame, achievements, toast, t])

  const copyGuide = useCallback(async () => {
    if (!activeGame) {
      toast(t('toast.guide.noGame'), 'error')
      return
    }
    try {
      const pack = buildGuidePack(activeGame, achievements)
      await writeClipboard(JSON.stringify(pack, null, 2))
      toast(t('toast.guide.copied'), 'success')
    } catch {
      toast(t('toast.guide.clipboardFail'), 'error')
    }
  }, [activeGame, achievements, toast, t])

  return { exportGuide, copyGuide }
}
