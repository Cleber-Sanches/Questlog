import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowSquareOut,
  BookOpenText,
  Check,
  Circle,
  FolderOpen,
  ListNumbers,
  MagnifyingGlass,
  Sparkle,
  Terminal,
  WarningCircle,
  Wrench,
  YoutubeLogo,
} from '@phosphor-icons/react'
import type { ChatStep, ProgressSource } from '@/features/ai/hooks/useAiChat'
import { openExternal } from '@/lib/openExternal'

export type ThinkingTraceProps = {
  steps: ChatStep[]
  working?: boolean
  seconds?: number
}

type StepKind = 'guide' | 'context' | 'plan' | 'cli' | 'search' | 'parse' | 'save' | 'video' | 'tool' | 'generic'

const PREP_IDS = new Set(['load', 'context', 'catalog', 'cli', 'intent'])

function kindOf(step: ChatStep): StepKind {
  if (step.id === 'intent' || step.kind === 'tool') return 'tool'
  if (step.id === 'videos' || /youtube|v[ií]deo/i.test(step.label)) return 'video'
  if (step.id === 'load') return 'guide'
  if (step.id === 'context') return 'context'
  if (step.id === 'catalog' || step.id === 'levels') return 'plan'
  if (step.id === 'cli') return 'cli'
  if (step.id === 'parse') return 'parse'
  if (step.id === 'save') return 'save'
  if (step.id === 'model' || step.id.startsWith('model-') || step.kind === 'step') return 'search'
  if (/analisando|pesquis|grupo|lote/i.test(step.label)) return 'search'
  if (step.kind === 'search') return 'search'
  return 'generic'
}

function isPrep(step: ChatStep) {
  return PREP_IDS.has(step.id)
}

function cleanLabel(label: string) {
  return label.replace(/\.\.\.$/, '').replace(/…$/, '').trim()
}

/** Extrai contagem + nomes de conquistas do detail do backend. */
function parseAchievementDetail(detail?: string | null): { count?: string; names: string[] } {
  if (!detail?.trim()) return { names: [] }
  const raw = detail.trim()
  const isGeneric = (n: string) => {
    const t = n.trim().toLowerCase()
    return (
      !t ||
      t === 'nova conquista' ||
      t === 'new achievement' ||
      t === 'untitled' ||
      t === 'sem título' ||
      t === 'sem titulo'
    )
  }
  const m = raw.match(/^(\d+)\s*conquistas?\s*(?:·\s*)?(.*)$/i)
  if (m) {
    const names = m[2]
      ? m[2]
          .split(/\s*·\s*/)
          .map((s) => s.trim())
          .filter((n) => n && !isGeneric(n))
      : []
    return { count: `${m[1]} conquistas`, names }
  }
  if (/^\d+\s*·/.test(raw)) {
    const parts = raw.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean)
    const n = parts[0]
    return {
      count: `${n} conquistas`,
      names: parts.slice(1).filter((x) => !isGeneric(x)),
    }
  }
  return { names: [], count: raw }
}

function normalizeSteps(steps: ChatStep[]): ChatStep[] {
  let lastRunning = -1
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].status === 'running') lastRunning = i
  }

  return steps.map((step, i) => {
    let next = { ...step }

    // Nunca ecoar o pedido do usuário como “query” nos grupos de análise
    if (next.id === 'model' || next.id.startsWith('model-')) {
      next = { ...next, query: null, kind: next.kind === 'search' ? 'step' : next.kind }
    }

    if (next.status === 'running' && i !== lastRunning) {
      const m =
        next.label.match(/\((\d+)\/(\d+)\)/) ||
        next.label.match(/(?:grupo|lote)\s+(\d+)\s*\/\s*(\d+)/i)
      next = {
        ...next,
        status: 'done',
        label: m ? `Grupo ${m[1]}/${m[2]} concluído` : cleanLabel(next.label),
        query: null,
      }
    }
    return next
  })
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`aiTraceCaret${open ? ' is-open' : ''}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function StatusMark({ status }: { status: ChatStep['status'] }) {
  if (status === 'error') return <WarningCircle size={15} weight="regular" />
  if (status === 'running') {
    return (
      <span className="aiMkActive" aria-hidden>
        <span className="aiMkActivePulse" />
        <span className="aiMkActiveDot" />
      </span>
    )
  }
  if (status === 'done') return <Check size={15} weight="regular" />
  return <Circle size={12} weight="regular" />
}

function KindGlyph({ kind }: { kind: StepKind }) {
  const props = { size: 15, weight: 'regular' as const }
  switch (kind) {
    case 'guide':
      return <BookOpenText {...props} />
    case 'context':
      return <FolderOpen {...props} />
    case 'plan':
      return <ListNumbers {...props} />
    case 'cli':
      return <Terminal {...props} />
    case 'search':
      return <MagnifyingGlass {...props} />
    case 'video':
      return <YoutubeLogo {...props} />
    case 'tool':
      return <Wrench {...props} />
    case 'parse':
      return <Sparkle {...props} />
    case 'save':
      return <Check {...props} />
    default:
      return <Sparkle {...props} />
  }
}

function faviconUrl(url?: string | null, domain?: string | null) {
  try {
    if (url) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=32`
    if (domain) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
  } catch {
    /* ignore */
  }
  return null
}

function SourceFavicon({ source }: { source: ProgressSource }) {
  const src = faviconUrl(source.url, source.domain)
  const isYt = /youtube/i.test(source.domain ?? source.url ?? '')
  const [failed, setFailed] = useState(!src)

  if (failed || !src) {
    return (
      <span className={`aiSourcesIcon${isYt ? ' is-yt' : ''}`} aria-hidden>
        {isYt ? <YoutubeLogo size={14} weight="fill" /> : <MagnifyingGlass size={13} weight="regular" />}
      </span>
    )
  }

  return (
    <span className="aiSourcesIcon is-fav" aria-hidden>
      <img src={src} alt="" width={16} height={16} onError={() => setFailed(true)} />
    </span>
  )
}

/** Citations — pill Fontes + lista com índice e link externo */
function SourcesBlock({ sources, limit }: { sources: ProgressSource[]; limit?: number }) {
  const [open, setOpen] = useState(true)
  if (!sources.length) return null
  const visible = limit ? sources.slice(0, limit) : sources
  const more = limit ? Math.max(0, sources.length - limit) : 0

  return (
    <div className="aiSources">
      <button
        type="button"
        className="aiSourcesPill"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <BookOpenText size={14} weight="regular" aria-hidden />
        <span>Fontes</span>
        <span className="aiSourcesCount">{sources.length}</span>
        <Caret open={open} />
      </button>
      {open ? (
        <ul className="aiSourcesList" role="list">
          {visible.map((s, i) => (
            <li key={s.id} className="aiSourcesItem">
              {s.url ? (
                <button
                  type="button"
                  className="aiSourcesLink"
                  onClick={() => void openExternal(s.url)}
                >
                  <SourceFavicon source={s} />
                  <span className="aiSourcesTitle">{s.title}</span>
                  {s.domain ? <span className="aiSourcesDomain">{s.domain}</span> : null}
                  <span className="aiSourcesMeta">
                    <span className="aiSourcesIdx">{i + 1}</span>
                    <ArrowSquareOut size={13} weight="regular" className="aiSourcesExt" aria-hidden />
                  </span>
                </button>
              ) : (
                <div className="aiSourcesLink is-static">
                  <SourceFavicon source={s} />
                  <span className="aiSourcesTitle">{s.title}</span>
                  {s.domain ? <span className="aiSourcesDomain">{s.domain}</span> : null}
                  <span className="aiSourcesMeta">
                    <span className="aiSourcesIdx">{i + 1}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
          {more > 0 ? <li className="aiSourcesMore">+{more} mais</li> : null}
        </ul>
      ) : null}
    </div>
  )
}

/** Agent Activity search — status compacto + query + resultados */
function SearchActivity({ step }: { step: ChatStep }) {
  const sources = step.sources ?? []
  const running = step.status === 'running'
  const [open, setOpen] = useState(true)
  const query = step.query?.trim() || null
  const visible = sources.slice(0, 4)
  const more = Math.max(0, sources.length - visible.length)

  const pillLabel = running
    ? 'Buscando na web…'
    : step.status === 'error'
      ? 'Busca falhou'
      : 'Buscou na web'

  const currentHint =
    running && step.detail && !/vídeo\(s\)|video\(s\)/i.test(step.detail)
      ? step.detail
      : null

  return (
    <li className={`aiSearchAct is-${step.status}`} role="listitem">
      <button
        type="button"
        className={`aiSearchPill${running ? ' is-live' : ''}`}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <MagnifyingGlass size={14} weight="regular" className="aiSearchPillIcon" aria-hidden />
        <span className={running ? 'is-shimmer' : undefined}>{pillLabel}</span>
        <Caret open={open} />
      </button>

      {open ? (
        <div className="aiSearchBody">
          {query ? (
            <div className="aiSearchQuery">
              <span>{query}</span>
            </div>
          ) : currentHint ? (
            <div className="aiSearchQuery is-hint">
              <span>{currentHint}</span>
            </div>
          ) : null}

          {sources.length > 0 ? (
            <ul className="aiSearchResults" role="list">
              {visible.map((s) => (
                <li key={s.id}>
                  {s.url ? (
                    <button
                      type="button"
                      className="aiSearchResult"
                      onClick={() => void openExternal(s.url)}
                    >
                      <SourceFavicon source={s} />
                      <span className="aiSourcesTitle">{s.title}</span>
                      {s.domain ? <span className="aiSourcesDomain">{s.domain}</span> : null}
                    </button>
                  ) : (
                    <div className="aiSearchResult is-static">
                      <SourceFavicon source={s} />
                      <span className="aiSourcesTitle">{s.title}</span>
                      {s.domain ? <span className="aiSourcesDomain">{s.domain}</span> : null}
                    </div>
                  )}
                </li>
              ))}
              {more > 0 ? <li className="aiSourcesMore">+{more} mais</li> : null}
            </ul>
          ) : running ? (
            <p className="aiSearchEmpty">Procurando resultados…</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function ActivityRow({ step }: { step: ChatStep }) {
  const kind = kindOf(step)
  const sources = step.sources ?? []
  const isWebSearch =
    kind === 'video' ||
    step.id === 'videos' ||
    (step.kind === 'search' && (Boolean(step.query) || sources.length > 0))

  const [runSecs, setRunSecs] = useState(0)
  useEffect(() => {
    if (step.status !== 'running') {
      setRunSecs(0)
      return
    }
    const t0 = Date.now()
    setRunSecs(0)
    const id = window.setInterval(() => {
      setRunSecs(Math.floor((Date.now() - t0) / 1000))
    }, 400)
    return () => window.clearInterval(id)
  }, [step.id, step.status])

  if (isWebSearch) {
    return <SearchActivity step={step} />
  }

  const toolish = kind === 'search' || kind === 'cli' || kind === 'guide' || kind === 'tool'
  const showKind = toolish && step.status !== 'running'
  const parsed = parseAchievementDetail(step.detail)
  const showParsed = parsed.names.length > 0 || Boolean(parsed.count && /conquista/i.test(parsed.count))
  const plainDetail = !showParsed && step.detail ? step.detail : null
  const waitingHint =
    step.status === 'running' && runSecs >= 2
      ? `Aguardando o modelo · ${formatDuration(runSecs)}`
      : null

  return (
    <li className={`aiActRow is-${step.status} is-kind-${kind}`} role="listitem">
      <div className="aiActMain">
        <span className="aiActMark" aria-hidden>
          {step.status === 'running' || step.status === 'error' || !showKind ? (
            <StatusMark status={step.status} />
          ) : (
            <KindGlyph kind={kind} />
          )}
        </span>
        <div className="aiActCopy">
          <span className="aiActLabel">{cleanLabel(step.label)}</span>
          {showParsed ? (
            <div className="aiActMetaBlock">
              {parsed.count ? <span className="aiActDetail">{parsed.count}</span> : null}
              {parsed.names.length > 0 ? (
                <div className="aiActChips">
                  {parsed.names.slice(0, 3).map((name) => (
                    <span key={name} className="aiActChip">
                      {name}
                    </span>
                  ))}
                  {parsed.names.length > 3 ? (
                    <span className="aiActChip">+{parsed.names.length - 3}</span>
                  ) : null}
                </div>
              ) : null}
              {waitingHint ? <span className="aiActDetail is-wait">{waitingHint}</span> : null}
            </div>
          ) : (
            <>
              {plainDetail ? <span className="aiActDetail">{plainDetail}</span> : null}
              {waitingHint ? <span className="aiActDetail is-wait">{waitingHint}</span> : null}
            </>
          )}
        </div>
      </div>
      {sources.length > 0 ? <SourcesBlock sources={sources} /> : null}
    </li>
  )
}

/**
 * Agent Activity nível produto: status limpo + fontes clicáveis (beUI Citations).
 */
export function ThinkingTrace({ steps, working = true, seconds = 0 }: ThinkingTraceProps) {
  const rows = useMemo(
    () => normalizeSteps(steps.filter((s) => s.id !== 'done')),
    [steps],
  )
  const hasError = rows.some((s) => s.status === 'error')
  const [manual, setManual] = useState(false)
  const open = working || manual

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!working) return
    setElapsed(0)
    const t0 = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250)
    return () => window.clearInterval(id)
  }, [working])

  useEffect(() => {
    if (working) setManual(false)
  }, [working])

  const inResearch = useMemo(
    () =>
      rows.some(
        (s) =>
          kindOf(s) === 'search' ||
          kindOf(s) === 'video' ||
          s.id === 'parse' ||
          s.id === 'save',
      ),
    [rows],
  )

  const prep = useMemo(() => rows.filter(isPrep), [rows])
  const earlyPrepIds = useMemo(() => new Set(['load', 'context', 'intent', 'catalog']), [])
  const earlyPrep = useMemo(
    () => rows.filter((s) => earlyPrepIds.has(s.id)),
    [rows, earlyPrepIds],
  )
  const pastEarlyPrep = useMemo(
    () =>
      rows.some(
        (s) =>
          !earlyPrepIds.has(s.id) &&
          (s.status === 'running' || s.status === 'done' || s.status === 'error'),
      ),
    [rows, earlyPrepIds],
  )
  const earlyPrepDone =
    earlyPrep.length > 0 &&
    earlyPrep.every((s) => s.status === 'done' || s.status === 'error')

  const visible = useMemo(() => {
    if (earlyPrepDone && pastEarlyPrep) {
      return rows.filter((s) => !earlyPrepIds.has(s.id))
    }
    if (inResearch) {
      const prepDone = prep.every((s) => s.status === 'done' || s.status === 'error')
      if (prepDone && prep.length > 0) return rows.filter((s) => !isPrep(s))
    }
    return rows
  }, [rows, inResearch, prep, earlyPrepDone, pastEarlyPrep, earlyPrepIds])

  if (!rows.length && !working) return null

  const secs = working ? elapsed : seconds
  const timeLabel = formatDuration(secs)

  let title: ReactNode
  if (hasError && !working) {
    title = secs > 0 ? <>Falhou após <span className="tabular">{timeLabel}</span></> : 'Falhou'
  } else if (working) {
    title = (
      <span className="is-shimmer">
        Pensando…
        {secs > 0 ? (
          <>
            {' '}
            · <span className="tabular">{timeLabel}</span>
          </>
        ) : null}
      </span>
    )
  } else if (secs > 0) {
    title = (
      <>
        Pensou por <span className="tabular">{timeLabel}</span>
      </>
    )
  } else {
    title = rows.length > 0 ? `Concluiu ${rows.length} passos` : 'Pensou um pouco'
  }

  const showPrepSummary = earlyPrepDone && pastEarlyPrep

  return (
    <div className={`aiTrace${working ? ' is-live' : ''}${hasError ? ' is-err' : ''}`}>
      {working ? (
        <div className="aiTraceStatus" role="status" aria-live="polite">
          <span className="aiTraceTitle">{title}</span>
        </div>
      ) : (
        <button
          type="button"
          className="aiTraceHead"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setManual((m) => !m)}
        >
          <span className="aiTraceTitle">{title}</span>
          <Caret open={open} />
        </button>
      )}

      {visible.length > 0 ? (
        <div
          className="aiTracePanel"
          style={{
            gridTemplateRows: open ? '1fr' : '0fr',
            opacity: open ? 1 : 0,
          }}
        >
          <div className="aiTraceClip">
            <ul className="aiActList" role="list">
              {showPrepSummary ? (
                <li className="aiActRow is-done is-kind-generic" role="listitem">
                  <div className="aiActMain">
                    <span className="aiActMark" aria-hidden>
                      <Check size={15} weight="regular" />
                    </span>
                    <div className="aiActCopy">
                      <span className="aiActLabel">Preparação</span>
                      <span className="aiActDetail">guia · contexto · ferramenta</span>
                    </div>
                  </div>
                </li>
              ) : null}
              {visible.map((step) => (
                <ActivityRow key={step.id} step={step} />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ToolChips({
  items,
}: {
  items: Array<{ label: string; tone?: 'default' | 'ok' | 'warn' | 'muted' }>
}) {
  if (!items.length) return null
  return (
    <div className="aiChips" aria-label="Resumo">
      {items.map((c) => (
        <span key={c.label} className={`aiChip is-${c.tone ?? 'default'}`}>
          {c.label}
        </span>
      ))}
    </div>
  )
}

export function FollowUpChips({
  items,
  onPick,
}: {
  items: string[]
  onPick: (text: string) => void
}) {
  return (
    <div className="aiFollowUps">
      {items.map((s) => (
        <button key={s} type="button" className="aiFollowChip" onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  )
}
