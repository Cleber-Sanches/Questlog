import { useCallback, useEffect, useRef, useState } from 'react'
import { aiApi } from '@/features/ai/api'
import { useToast } from '@/app/providers/ToastProvider'
import type {
  AiAuthResult,
  AiProvider,
  AiProviderConfig,
  AiSettings,
} from '@/types/ai'
import { connectedProviders, EMPTY_AI_SETTINGS } from '@/types/ai'

export function useAiSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<AiSettings>(EMPTY_AI_SETTINGS)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [testingAuth, setTestingAuth] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await aiApi.getSettings()
      setSettings({ ...next, apiKey: '', clearApiKey: false })
    } catch (err) {
      toast(String(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persist = useCallback(
    async (recipe: (prev: AiSettings) => AiSettings, showToast = true) => {
      setSaving(true)
      try {
        const next = recipe(settingsRef.current)
        const saved = await aiApi.saveSettings(next)
        const normalized = { ...saved, apiKey: '', clearApiKey: false }
        setSettings(normalized)
        if (showToast) toast('Configurações de IA salvas', 'success')
        return normalized
      } catch (err) {
        toast(String(err), 'error')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [toast],
  )

  const save = useCallback(
    async (next: AiSettings) => persist(() => next),
    [persist],
  )

  const patchProvider = useCallback(
    (provider: AiProvider, patch: Partial<AiProviderConfig>) => {
      setSettings((s) => ({
        ...s,
        providers: {
          ...s.providers,
          [provider]: { ...s.providers[provider], ...patch },
        },
      }))
    },
    [],
  )

  const runDetect = useCallback(
    async (provider: AiProvider, cliPath: string) => {
      setDetecting(true)
      try {
        const res = await aiApi.detect(provider, cliPath)
        if (res.found && res.path) {
          patchProvider(provider, { cliPath: res.path })
        }
        if (!res.found) toast(res.error || 'CLI não encontrado', 'error')
        return res
      } catch (err) {
        toast(String(err), 'error')
        return null
      } finally {
        setDetecting(false)
      }
    },
    [patchProvider, toast],
  )

  const runTestAuth = useCallback(
    async (provider: AiProvider, cliPath: string): Promise<AiAuthResult | null> => {
      setTestingAuth(true)
      try {
        const res = await aiApi.testAuth(provider, cliPath)
        toast(res.detail, res.ok ? 'success' : 'error')
        return res
      } catch (err) {
        toast(String(err), 'error')
        return null
      } finally {
        setTestingAuth(false)
      }
    },
    [toast],
  )

  const runCliLogin = useCallback(
    async (provider: AiProvider, cliPath: string): Promise<AiAuthResult | null> => {
      setLoggingIn(true)
      try {
        const res = await aiApi.cliLogin(provider, cliPath)
        toast(res.detail, 'success')
        return res
      } catch (err) {
        toast(String(err), 'error')
        return null
      } finally {
        setLoggingIn(false)
      }
    },
    [toast],
  )

  const connectProvider = useCallback(
    async (provider: AiProvider, config: AiProviderConfig) =>
      persist((prev) => ({
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: { ...config, connected: true, enabled: true },
        },
        activeProvider: prev.activeProvider ?? provider,
      })),
    [persist],
  )

  const disconnectProvider = useCallback(
    async (provider: AiProvider) =>
      persist((prev) => {
        const next: AiSettings = {
          ...prev,
          providers: {
            ...prev.providers,
            [provider]: {
              ...prev.providers[provider],
              connected: false,
              enabled: false,
            },
          },
          activeProvider: prev.activeProvider === provider ? null : prev.activeProvider,
        }
        const remaining = connectedProviders(next)
        if (!next.activeProvider && remaining.length > 0) {
          next.activeProvider = remaining[0]
        }
        return next
      }),
    [persist],
  )

  const setProviderEnabled = useCallback(
    async (provider: AiProvider, enabled: boolean) =>
      persist((prev) => {
        const next: AiSettings = {
          ...prev,
          providers: {
            ...prev.providers,
            [provider]: { ...prev.providers[provider], enabled },
          },
        }
        if (enabled && next.providers[provider].connected) {
          next.activeProvider = provider
        } else if (!enabled && prev.activeProvider === provider) {
          next.activeProvider = connectedProviders(next)[0] ?? null
        }
        return next
      }),
    [persist],
  )

  const setActiveProvider = useCallback(
    async (provider: AiProvider | null) =>
      persist((prev) => ({ ...prev, activeProvider: provider })),
    [persist],
  )

  return {
    settings,
    setSettings,
    loading,
    saving,
    detecting,
    testingAuth,
    loggingIn,
    refresh,
    save,
    patchProvider,
    runDetect,
    runTestAuth,
    runCliLogin,
    connectProvider,
    disconnectProvider,
    setProviderEnabled,
    setActiveProvider,
  }
}
