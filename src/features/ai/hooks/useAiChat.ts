import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { aiApi } from '@/features/ai/api'
import { findProvider } from '@/features/ai/providers'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useRouter } from '@/app/router'
import type { AiChatMessage, AiProvider, AiSettings } from '@/types/ai'
import { connectedProviders, EMPTY_AI_SETTINGS } from '@/types/ai'

export type ProgressSource = {
  id: string
  title: string
  domain?: string | null
  url?: string | null
}

export type ChatStep = {
  id: string
  status: 'running' | 'done' | 'error'
  label: string
  detail?: string | null
  kind?: string | null
  query?: string | null
  sources?: ProgressSource[]
}

export type ThinkingSnapshot = {
  steps: ChatStep[]
  seconds: number
}

export type UiMessage = AiChatMessage & {
  id: string
  meta?: string
  thinking?: ThinkingSnapshot
}

type ProgressPayload = {
  id: string
  status: string
  label: string
  detail?: string | null
  kind?: string | null
  query?: string | null
  sources?: ProgressSource[]
}

function upsertStep(steps: ChatStep[], ev: ProgressPayload): ChatStep[] {
  const status = (['running', 'done', 'error'].includes(ev.status)
    ? ev.status
    : 'running') as ChatStep['status']
  const next: ChatStep = {
    id: ev.id,
    status,
    label: ev.label,
    detail: ev.detail,
    kind: ev.kind,
    query:
      ev.id === 'model' || ev.id.startsWith('model-')
        ? null
        : ev.query,
    sources: ev.sources?.length ? ev.sources : undefined,
  }
  const idx = steps.findIndex((s) => s.id === ev.id)
  let copy: ChatStep[]
  if (idx === -1) {
    copy = [...steps, next]
  } else {
    copy = [...steps]
    const prev = copy[idx]
    copy[idx] = {
      ...next,
      sources: next.sources?.length ? next.sources : prev.sources,
      query: next.query ?? prev.query,
      kind: next.kind ?? prev.kind,
    }
  }

  if (status === 'running') {
    copy = copy.map((s) => {
      if (s.id === ev.id || s.status !== 'running') return s
      const m = s.label.match(/(?:grupo|lote)\s+(\d+)\s*\/\s*(\d+)/i)
        || s.label.match(/\((\d+)\/(\d+)\)/)
      return {
        ...s,
        status: 'done' as const,
        label: m
          ? `Grupo ${m[1]}/${m[2]} concluído`
          : s.label.replace(/…$|\.\.\.$/, '').trim(),
      }
    })
  }

  return copy
}

function snapshotThinking(steps: ChatStep[], t0: number): ThinkingSnapshot | undefined {
  const clean = steps
    .filter((s) => s.id !== 'done')
    .map((s) => ({
      ...s,
      status: s.status === 'running' ? ('done' as const) : s.status,
    }))
  if (!clean.length) return undefined
  return {
    steps: clean,
    seconds: Math.max(1, Math.floor((Date.now() - t0) / 1000)),
  }
}

function modelForProvider(settings: AiSettings, provider: AiProvider | null) {
  if (!provider) return ''
  const saved = settings.providers[provider]?.model?.trim()
  if (saved) return saved
  return findProvider(provider)?.modelPlaceholder ?? ''
}

export function useAiChat() {
  const { activeGame, achievements, refresh } = useAppData()
  const { navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [liveSteps, setLiveSteps] = useState<ChatStep[]>([])
  const [aiSettings, setAiSettings] = useState<AiSettings>(EMPTY_AI_SETTINGS)
  const [chatProvider, setChatProvider] = useState<AiProvider | null>(null)
  const [chatModel, setChatModel] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<ChatStep[]>([])
  const startedAtRef = useRef(0)
  const runIdRef = useRef(0)
  const gameId = activeGame?.appId ?? null

  const availableProviders = connectedProviders(aiSettings)

  useEffect(() => {
    let cancelled = false
    void aiApi.getSettings().then((next) => {
      if (cancelled) return
      setAiSettings({ ...next, apiKey: '', clearApiKey: false })
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!availableProviders.length) {
      setChatProvider(null)
      return
    }
    setChatProvider((prev) => {
      if (prev && availableProviders.includes(prev)) return prev
      if (aiSettings.activeProvider && availableProviders.includes(aiSettings.activeProvider)) {
        return aiSettings.activeProvider
      }
      return availableProviders[0]
    })
  }, [aiSettings.activeProvider, availableProviders])

  useEffect(() => {
    setChatModel(modelForProvider(aiSettings, chatProvider))
  }, [aiSettings, chatProvider])

  useEffect(() => {
    setMessages([])
    setInput('')
    setLiveSteps([])
    stepsRef.current = []
  }, [gameId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, busy, open, liveSteps])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    void listen<ProgressPayload>('ai-chat-progress', (event) => {
      setLiveSteps((prev) => {
        const next = upsertStep(prev, event.payload)
        stepsRef.current = next
        return next
      })
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  const persistModel = useCallback(async () => {
    if (!chatProvider) return chatModel
    const trimmed = chatModel.trim()
    if (!trimmed) return chatModel
    const current = aiSettings.providers[chatProvider]?.model?.trim() ?? ''
    if (trimmed === current) return trimmed

    const next: AiSettings = {
      ...aiSettings,
      providers: {
        ...aiSettings.providers,
        [chatProvider]: {
          ...aiSettings.providers[chatProvider],
          model: trimmed,
        },
      },
    }
    setAiSettings(next)
    try {
      await aiApi.saveSettings(next)
    } catch {
      /* ignore */
    }
    return trimmed
  }, [aiSettings, chatModel, chatProvider])

  const cancel = useCallback(async () => {
    const thinking = snapshotThinking(stepsRef.current, startedAtRef.current)
    runIdRef.current += 1
    setBusy(false)
    setLiveSteps([])
    stepsRef.current = []
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Execução cancelada.',
        thinking,
      },
    ])
    try {
      await aiApi.cancelChat()
    } catch {
      /* ignore */
    }
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    if (!activeGame?.appId) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Selecione um jogo na barra lateral para conversar com contexto.',
        },
      ])
      return
    }
    if (!chatProvider) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Nenhum assistente conectado. Abra Configurações → Assistente de IA e conecte um provedor.',
        },
      ])
      return
    }

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map(({ role, content }) => ({ role, content }))

    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: text }])
    setInput('')
    setBusy(true)
    const runId = ++runIdRef.current
    startedAtRef.current = Date.now()
    const initial: ChatStep[] = [
      { id: 'load', status: 'running', label: 'Lendo o guia do jogo…', detail: null },
    ]
    stepsRef.current = initial
    setLiveSteps(initial)

    try {
      const model = await persistModel()
      const res = await aiApi.chatTurn(activeGame.appId, text, history, chatProvider, model)
      if (runId !== runIdRef.current) return
      if (res.updated > 0) await refresh()
      if (runId !== runIdRef.current) return
      const thinking = snapshotThinking(stepsRef.current, startedAtRef.current)
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.reply,
          meta:
            res.videos > 0
              ? `${res.videos} vídeo${res.videos === 1 ? '' : 's'} do YouTube`
              : res.updated > 0
                ? `${res.updated} conquista${res.updated === 1 ? '' : 's'} atualizada${res.updated === 1 ? '' : 's'}`
                : undefined,
          thinking,
        },
      ])
    } catch (err) {
      if (runId !== runIdRef.current) return
      const msg = String(err)
      if (msg.includes('Execução cancelada')) return
      const thinking = snapshotThinking(stepsRef.current, startedAtRef.current)
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: msg.includes('Ative a integração') || msg.includes('Conecte um provedor')
            ? 'IA indisponível. Abra Configurações → Assistente de IA, ative e conecte um assistente.'
            : msg,
          thinking,
        },
      ])
    } finally {
      if (runId === runIdRef.current) {
        setBusy(false)
        setLiveSteps([])
        stepsRef.current = []
      }
    }
  }, [activeGame?.appId, busy, chatProvider, input, messages, persistModel, refresh])

  return {
    open,
    setOpen,
    busy,
    input,
    setInput,
    messages,
    liveSteps,
    listRef,
    achievements,
    gameName: activeGame?.name ?? null,
    chatProvider,
    setChatProvider,
    chatModel,
    setChatModel,
    persistModel,
    availableProviders,
    send,
    cancel,
    openSettings: () => navigate('settings'),
    clear: () => {
      setMessages([])
      setLiveSteps([])
      stepsRef.current = []
    },
  }
}
