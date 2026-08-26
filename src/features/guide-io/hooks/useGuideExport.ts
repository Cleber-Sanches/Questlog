import { useCallback } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { downloadJson } from '@/lib/downloadJson'
import { slugFilename } from '@/lib/format'
import { buildGuidePack } from '../utils/normalize'

export function useGuideExport() {
  const { activeGame, achievements } = useAppData()
  const { toast } = useToast()

  const exportGuide = useCallback(async () => {
    if (!activeGame) {
      toast('Nenhum jogo ativo', 'error')
      return
    }
    try {
      const pack = buildGuidePack(activeGame, achievements)
      const saved = await downloadJson(
        `${slugFilename(activeGame.name) || activeGame.appId}-guia.json`,
        pack,
      )
      if (saved) toast('Guia exportado', 'success')
    } catch (err) {
      toast(String(err), 'error')
    }
  }, [activeGame, achievements, toast])

  return { exportGuide }
}
