import { useCallback, useEffect, useState } from 'react'
import { aiApi } from '@/features/ai/api'
import { fallbackModelsForProvider } from '@/features/ai/providers'
import type { AiModelItem, AiProvider } from '@/types/ai'

function toModelItems(provider: AiProvider) {
  return fallbackModelsForProvider(provider).map((item) => ({
    id: item.value,
    name: item.label,
    provider: item.provider ?? provider,
  }))
}

export function useProviderModels(provider: AiProvider | null, enabled = true) {
  const [models, setModels] = useState<AiModelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!provider || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const result = await aiApi.listModels(provider)
      setModels(result.models)
      setSource(result.source)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível carregar os modelos.'
      setError(message)
      setModels(toModelItems(provider))
      setSource('fallback')
    } finally {
      setLoading(false)
    }
  }, [enabled, provider])

  useEffect(() => {
    if (!provider || !enabled) {
      setModels([])
      setSource('')
      setError(null)
      setLoading(false)
      return
    }
    void load()
  }, [enabled, load, provider])

  return { models, loading, source, error, refresh: load }
}
