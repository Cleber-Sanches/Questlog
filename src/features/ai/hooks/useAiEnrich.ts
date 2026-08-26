import { useCallback, useState } from 'react'
import { aiApi } from '@/features/ai/api'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useToast } from '@/app/providers/ToastProvider'

export function useAiEnrich() {
  const { activeGame, refresh } = useAppData()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const enrich = useCallback(async () => {
    if (!activeGame?.appId) {
      toast('Selecione um jogo primeiro', 'error')
      return
    }
    setBusy(true)
    toast('IA enriquecendo o guia… isso pode levar alguns minutos', 'info')
    try {
      const res = await aiApi.enrichGuide(activeGame.appId, { onlyMissing: true, limit: 25 })
      await refresh()
      toast(
        res.updated > 0
          ? `IA atualizou ${res.updated} de ${res.considered} conquistas (${res.provider})`
          : `IA respondeu sem mudanças (${res.considered} analisadas)`,
        res.updated > 0 ? 'success' : 'info',
      )
    } catch (err) {
      toast(String(err), 'error')
    } finally {
      setBusy(false)
    }
  }, [activeGame?.appId, refresh, toast])

  return { enrich, busy, enabled: !!activeGame }
}
