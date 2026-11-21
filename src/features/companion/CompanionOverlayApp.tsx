import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { DifficultyIcon } from '@/features/achievements/components/DifficultyIcon'
import { SegmentedFill } from '@/components/ui/SegmentedBar'
import { overlayDifficulty } from '@/features/overlay/types'
import { resolveOverlayIcon } from '@/features/overlay/resolveOverlayIcon'
import { formatHudCount } from '@/lib/format'
import { parseLocale } from '@/i18n/locales'
import { translate } from '@/i18n'
import { fetchCompanionSnapshot, hideCompanion } from './api'
import { CompanionTips } from './CompanionTips'
import type { CompanionItem, CompanionSnapshot } from './types'

function itemProgress(item: CompanionItem) {
  const max =
    typeof item.progressMax === 'number' && item.progressMax > 0 ? item.progressMax : null
  if (max == null) return null
  const current = Math.min(max, Math.max(0, item.progress ?? 0))
  return {
    current,
    max,
    pct: Math.round((current / max) * 100),
  }
}

export function CompanionOverlayApp() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [brokenIcons, setBrokenIcons] = useState<Record<number, boolean>>({})
  const listRef = useRef<HTMLDivElement>(null)

  const load = () => {
    void fetchCompanionSnapshot()
      .then((next) => {
        setSnapshot(next)
        setSelectedId((current) => {
          if (current != null && next.missing.some((item) => item.id === current)) {
            return current
          }
          return next.missing[0]?.id ?? null
        })
      })
      .catch(() => {
        setSnapshot(null)
      })
  }

  useEffect(() => {
    document.documentElement.classList.add('is-companion', 'dark')
    document.body.classList.add('is-companion')
    return () => {
      document.documentElement.classList.remove('is-companion')
      document.body.classList.remove('is-companion')
    }
  }, [])

  useEffect(() => {
    load()
    let unlisten: (() => void) | undefined
    void listen('companion-shown', () => load()).then((fn) => {
      unlisten = fn
    })
    return () => unlisten?.()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void hideCompanion()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (selectedId == null || !listRef.current) return
    const row = listRef.current.querySelector<HTMLElement>(`[data-id="${selectedId}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const locale = parseLocale(snapshot?.locale)
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars)

  if (!snapshot) {
    return <div className="companionOverlay" />
  }

  const spoiler = (item: CompanionItem) => Boolean(item.hidden) && !snapshot.showHidden
  const titleOf = (item: CompanionItem) => (spoiler(item) ? t('companion.hidden') : item.title)
  const progressPct =
    snapshot.total > 0 ? Math.round((snapshot.completed / snapshot.total) * 100) : 0

  return (
    <div className="companionOverlay">
      <div className="companionPanel">
        <header className="companionHead">
          <div className="companionHeadTop">
            <div className="companionHeadCopy">
              <p className="companionKicker">{t('companion.title')}</p>
              <h1 className="companionGame">{snapshot.gameName || t('companion.noGame')}</h1>
            </div>
            <button
              type="button"
              className="companionClose"
              onClick={() => void hideCompanion()}
              aria-label={t('companion.close')}
            >
              <i className="ph-bold ph-x" />
            </button>
          </div>

          {snapshot.gameAppId ? (
            <div className="companionHud">
              <div className="companionHudBarRow">
                <SegmentedFill percent={progressPct} brand className="companionHudBar" />
                <span className="companionHudPct">{progressPct}%</span>
              </div>
              <p className="companionHudMeta">
                {t('companion.progress', {
                  done: formatHudCount(snapshot.completed),
                  total: formatHudCount(snapshot.total),
                  left: formatHudCount(snapshot.missing.length),
                })}
              </p>
            </div>
          ) : (
            <p className="companionHint">{t('companion.noGameHint')}</p>
          )}
        </header>

        <div className="companionList" role="list" ref={listRef}>
          {snapshot.missing.length === 0 && snapshot.gameAppId ? (
            <p className="companionEmpty">{t('companion.empty')}</p>
          ) : null}

          {snapshot.missing.map((item) => {
            const open = item.id === selectedId
            const difficulty = overlayDifficulty(item.difficulty)
            const icon = resolveOverlayIcon(item.icon)
            const broken = brokenIcons[item.id]
            const prog = itemProgress(item)
            const desc = !spoiler(item) ? (item.description || '').trim() : ''
            const tip = !spoiler(item) ? item.tips || '' : ''

            return (
              <article
                key={item.id}
                data-id={item.id}
                className={`companionItem${open ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  role="listitem"
                  className="companionRow"
                  aria-expanded={open}
                  onClick={() => setSelectedId(open ? null : item.id)}
                >
                  <span className={`companionArt${!icon || broken ? ' is-fallback' : ''}`}>
                    {icon && !broken ? (
                      <img
                        src={icon}
                        alt=""
                        width={32}
                        height={32}
                        onError={() => setBrokenIcons((prev) => ({ ...prev, [item.id]: true }))}
                      />
                    ) : (
                      <i className="ph-fill ph-trophy" />
                    )}
                  </span>

                  <span className="companionRowMain">
                    <span className="companionRowTitle">{titleOf(item)}</span>
                    {prog && !open ? (
                      <span className="companionRowProgress">
                        <SegmentedFill percent={prog.pct} brand className="companionMiniBar" />
                        <span className="companionRowMeta">
                          {formatHudCount(prog.current)}/{formatHudCount(prog.max)}
                        </span>
                      </span>
                    ) : null}
                  </span>

                  <span className="companionRowTrail">
                    {item.missable ? (
                      <span className="diffChip is-iconOnly is-missable">
                        <DifficultyIcon kind="missable" />
                      </span>
                    ) : null}
                    {difficulty ? (
                      <span className={`diffChip is-iconOnly is-${difficulty}`}>
                        <DifficultyIcon kind={difficulty} />
                      </span>
                    ) : null}
                    <i
                      className={`ph-bold ${open ? 'ph-caret-up' : 'ph-caret-down'} companionCaret`}
                      aria-hidden
                    />
                  </span>
                </button>

                {open ? (
                  <div className="companionExpand">
                    {spoiler(item) ? (
                      <p className="companionMuted">{t('companion.hiddenDesc')}</p>
                    ) : (
                      <>
                        {desc ? <p className="companionDesc">{desc}</p> : null}
                        {prog ? (
                          <div className="companionExpandProgress">
                            <SegmentedFill
                              percent={prog.pct}
                              brand
                              className="companionExpandBar"
                            />
                            <span className="companionRowMeta">
                              {formatHudCount(prog.current)}/{formatHudCount(prog.max)}
                            </span>
                          </div>
                        ) : null}
                        <div className="companionTipHead">
                          <i className="ph-fill ph-lightbulb" aria-hidden />
                          <span>{t('companion.tipLabel')}</span>
                        </div>
                        {tip.trim() ? (
                          <CompanionTips html={tip} appId={snapshot.gameAppId || 'misc'} />
                        ) : (
                          <p className="companionMuted">{t('companion.noTip')}</p>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
