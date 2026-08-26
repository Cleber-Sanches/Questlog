import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useT } from '@/app/providers/LocaleProvider'
import { useAiChat } from '@/features/ai/hooks/useAiChat'
import {
  filterAchievementsForMention,
  findActiveMention,
  insertMentionAt,
  splitMentionText,
  type ActiveMention,
} from '@/features/ai/mention'
import { AiMarkdown } from '@/features/ai/components/AiMarkdown'
import { PromptInput } from '@/features/ai/components/PromptInput'
import { FollowUpChips, ThinkingTrace } from '@/features/ai/ui/primitives'
import { splitCoverage, statsFromMeta } from '@/features/ai/coverage'
import { AI_PROVIDERS, findProvider } from '@/features/ai/providers'
import { Tooltip } from '@/components/ui/Tooltip'
import { EASE_OUT } from '@/lib/motion/ease'
import type { MessageKey } from '@/i18n'
import type { Achievement } from '@/types/achievement'

const SUGGESTIONS: Array<{ icon: string; color: string; titleKey: MessageKey; prompt: string }> = [
  {
    icon: 'ph-fill ph-lightbulb',
    color: '#00B139',
    titleKey: 'chat.suggest.tips',
    prompt: 'Adiciona dicas onde ainda falta',
  },
  {
    icon: 'ph-fill ph-warning',
    color: '#FF9900',
    titleKey: 'chat.suggest.missable',
    prompt: 'Marca as perdíveis e explica por quê',
  },
  {
    icon: 'ph-fill ph-youtube-logo',
    color: '#FF0000',
    titleKey: 'chat.suggest.videos',
    prompt: 'Adiciona vídeos do YouTube onde ainda falta',
  },
  {
    icon: 'ph-fill ph-folders',
    color: '#f59e0b',
    titleKey: 'chat.suggest.group',
    prompt: 'Agrupa as conquistas sem grupo',
  },
  {
    icon: 'ph-fill ph-list-numbers',
    color: '#38bdf8',
    titleKey: 'chat.suggest.levels',
    prompt: 'Preenche níveis onde ainda falta',
  },
  {
    icon: 'ph-fill ph-medal',
    color: '#9359FF',
    titleKey: 'chat.suggest.difficulty',
    prompt: 'Revisa a dificuldade das conquistas sem classificação',
  },
]

function UserBubble({ content }: { content: string }) {
  const parts = splitMentionText(content)
  return (
    <p className="aiUserBubble">
      {parts.map((p, i) =>
        p.type === 'mention' ? (
          <span key={i} className="aiMentionChip">
            @{p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </p>
  )
}

function AssistantBody({
  content,
  meta,
  onFollowUp,
}: {
  content: string
  meta?: string
  onFollowUp: (text: string) => void
}) {
  const t = useT()
  const { body, stats, note, followUp } = splitCoverage(content)
  const coverageStats = stats.length > 0 ? stats : statsFromMeta(meta)
  return (
    <div className="aiMsgBody">
      {body ? (
        <div className="aiBubble">
          <AiMarkdown text={body} />
        </div>
      ) : null}
      {coverageStats.length > 0 ? (
        <div className="aiCoverage">
          <p className="aiCoverageLabel">{t('chat.coverage')}</p>
          <div className="aiCoverageList">
            {coverageStats.map((s) => {
              const compact = Boolean(s.total || /^\d+$/.test(s.value))
              return (
                <div
                  key={s.label}
                  className={`aiCoverageRow${compact ? '' : ' is-text'}`}
                >
                  <div className="aiCoverageRowMain">
                    <span className="aiCoverageName">{s.label}</span>
                    {s.value ? (
                      <span className="aiCoverageFigure">
                        <span className="aiCoverageValue">{s.value}</span>
                        {s.total ? <span className="aiCoverageTotal">/{s.total}</span> : null}
                      </span>
                    ) : null}
                  </div>
                  {s.detail ? <p className="aiCoverageDetail">{s.detail}</p> : null}
                </div>
              )
            })}
          </div>
          {note ? <p className="aiCoverageNote">{note}</p> : null}
        </div>
      ) : null}
      {followUp ? <FollowUpChips items={[followUp]} onPick={onFollowUp} /> : null}
    </div>
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function GuideAiChat() {
  const t = useT()
  const chat = useAiChat()
  const reduce = useReducedMotion() ?? false
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [cursor, setCursor] = useState(0)
  const [mentionHi, setMentionHi] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [closing, setClosing] = useState(false)

  const panelVisible = chat.open || closing
  const isEmpty = chat.messages.length === 0 && !chat.busy
  const gameLabel = chat.gameName ?? t('chat.gameFallback')
  const headTitle = isEmpty
    ? t('chat.new')
    : chat.gameName || t('chat.title')
  const activeProviderMeta = findProvider(chat.chatProvider)

  const closeChat = () => {
    if (!chat.open || closing) return
    if (prefersReducedMotion()) {
      chat.setOpen(false)
      return
    }
    setClosing(true)
  }

  const toggleChat = () => {
    if (chat.open && !closing) closeChat()
    else {
      setClosing(false)
      chat.setOpen(true)
    }
  }

  const active = useMemo(
    () => findActiveMention(chat.input, cursor),
    [chat.input, cursor],
  )

  const matches = useMemo(() => {
    if (!active) return [] as Achievement[]
    return filterAchievementsForMention(chat.achievements, active.query, 12)
  }, [active, chat.achievements])

  useEffect(() => {
    setMentionHi(0)
  }, [active?.start, active?.query])

  const pickMention = (a: Achievement, from: ActiveMention) => {
    const next = insertMentionAt(chat.input, cursor, from.start, a)
    chat.setInput(next.text)
    setCursor(next.cursor)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.cursor, next.cursor)
    })
  }

  const syncCursor = () => {
    const el = taRef.current
    if (el) setCursor(el.selectionStart)
  }

  const applySuggestion = (prompt: string) => {
    if (prompt.includes('@[…]')) {
      chat.setInput('@')
      setCursor(1)
      requestAnimationFrame(() => {
        taRef.current?.focus()
        taRef.current?.setSelectionRange(1, 1)
      })
    } else {
      chat.setInput(prompt)
      requestAnimationFrame(() => {
        const el = taRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(0, 0)
        el.scrollTop = 0
        el.scrollLeft = 0
      })
    }
  }

  const panelClass = [
    'aiChatPanel',
    expanded ? 'is-expanded' : '',
    closing ? 'is-closing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const providerOptions = AI_PROVIDERS.filter((p) => chat.availableProviders.includes(p.id))

  return (
    <div className={`aiChatRoot${panelVisible ? ' is-open' : ''}`}>
      {panelVisible ? (
        <section
          className={panelClass}
          aria-label={t('chat.aria')}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return
            if (!closing) return
            chat.setOpen(false)
            setClosing(false)
          }}
        >
          <header className="aiChatHead">
            <div className="aiChatHeadLead">
              <span className="aiChatHeadMark" aria-hidden>
                <i className="ph ph-chat" />
              </span>
              <h2 className="aiChatHeadTitle">{headTitle}</h2>
            </div>
            <div className="aiChatHeadActions">
              <Tooltip content={t('chat.new')} side="bottom">
                <button
                  type="button"
                  className="aiChatIconBtn"
                  aria-label={t('chat.new')}
                  onClick={chat.clear}
                >
                  <i className="ph ph-plus" aria-hidden />
                </button>
              </Tooltip>
              <Tooltip content={t('nav.settings')} side="bottom">
                <button
                  type="button"
                  className="aiChatIconBtn"
                  aria-label={t('nav.settings')}
                  onClick={chat.openSettings}
                >
                  <i className="ph ph-gear" aria-hidden />
                </button>
              </Tooltip>
              <Tooltip content={expanded ? t('common.collapse') : t('common.expand')} side="bottom">
                <button
                  type="button"
                  className="aiChatIconBtn"
                  aria-label={expanded ? t('common.collapse') : t('common.expand')}
                  aria-pressed={expanded}
                  onClick={() => setExpanded((v) => !v)}
                >
                  <i
                    className={`ph ${expanded ? 'ph-arrows-in-simple' : 'ph-arrows-out-simple'}`}
                    aria-hidden
                  />
                </button>
              </Tooltip>
              <Tooltip content={t('common.close')} side="bottom">
                <button
                  type="button"
                  className="aiChatIconBtn"
                  aria-label={t('common.close')}
                  onClick={closeChat}
                >
                  <i className="ph ph-x" aria-hidden />
                </button>
              </Tooltip>
            </div>
          </header>

          <div
            className={`aiChatBody${isEmpty ? ' is-empty' : ' is-thread'}`}
            ref={chat.listRef}
          >
            {isEmpty ? (
              <motion.div
                className="aiEmptyStage"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}
              >
                <div className="aiEmptyAura" aria-hidden />
                <div className="aiEmptyHero">
                  <div className="aiEmptyOrb" aria-hidden>
                    <span className="aiEmptyOrbRing" />
                    <span className="aiEmptyOrbRing is-delayed" />
                    <span className="aiEmptyOrbCore">
                      {activeProviderMeta ? (
                        <img
                          src={activeProviderMeta.logo}
                          alt=""
                          width={22}
                          height={22}
                          draggable={false}
                        />
                      ) : (
                        <i className="ph-fill ph-sparkle" />
                      )}
                    </span>
                  </div>
                  <div className="aiEmptyCopy">
                    <h2>{t('chat.empty.title')}</h2>
                    <p>
                      {t('chat.empty.subtitle')}{' '}
                      <strong>{gameLabel}</strong>
                    </p>
                  </div>
                  {!activeProviderMeta ? (
                    <button
                      type="button"
                      className="aiEmptyConnect"
                      onClick={chat.openSettings}
                    >
                      {t('chat.empty.connect')}
                    </button>
                  ) : null}
                </div>

                <div className="aiSuggestList">
                  {SUGGESTIONS.map((s, index) => (
                    <motion.button
                      key={s.titleKey}
                      type="button"
                      className="aiSuggestItem"
                      onClick={() => applySuggestion(s.prompt)}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.35, delay: 0.08 + index * 0.04, ease: EASE_OUT }
                      }
                      whileHover={reduce ? undefined : { y: -1 }}
                      whileTap={reduce ? undefined : { scale: 0.98 }}
                    >
                      <span className="aiSuggestIcon" style={{ color: s.color }} aria-hidden>
                        <i className={s.icon} />
                      </span>
                      <span className="aiSuggestText">{t(s.titleKey)}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              chat.messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="aiMsg is-user">
                    <UserBubble content={m.content} />
                  </div>
                ) : (
                  <div key={m.id} className="aiMsg is-assistant">
                    <div className="aiMsgHead">
                      <span className="aiMsgWho">{t('chat.picker.provider')}</span>
                    </div>
                    <div className="aiMsgStack">
                      {m.thinking ? (
                        <ThinkingTrace
                          steps={m.thinking.steps}
                          working={false}
                          seconds={m.thinking.seconds}
                        />
                      ) : null}
                      <AssistantBody
                        content={m.content}
                        meta={m.meta}
                        onFollowUp={(text) => {
                          chat.setInput(text)
                          requestAnimationFrame(() => taRef.current?.focus())
                        }}
                      />
                    </div>
                  </div>
                ),
              )
            )}

            {chat.busy ? (
              <div className="aiMsg is-assistant is-streaming">
                <div className="aiMsgStack">
                  <ThinkingTrace steps={chat.liveSteps} working />
                </div>
              </div>
            ) : null}
          </div>

          <div className="aiChatForm">
            <PromptInput
              ref={taRef}
              value={chat.input}
              onValueChange={(text) => {
                chat.setInput(text)
                requestAnimationFrame(() => {
                  const el = taRef.current
                  if (el) setCursor(el.selectionStart)
                })
              }}
              onSubmit={() => {
                if (active && matches.length) return
                void chat.send()
              }}
              loading={chat.busy}
              onStop={() => void chat.cancel()}
              disabled={!chat.chatProvider}
              providers={providerOptions.map((p) => ({
                id: p.id,
                name: p.name,
                logo: p.logo,
                modelPlaceholder: p.modelPlaceholder,
              }))}
              provider={chat.chatProvider}
              onProviderChange={(id) => chat.setChatProvider(id)}
              model={chat.chatModel}
              onModelChange={chat.setChatModel}
              onModelBlur={() => void chat.persistModel()}
              onClick={syncCursor}
              onKeyUp={syncCursor}
              onSelect={syncCursor}
              onKeyDown={(e) => {
                if (active && matches.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMentionHi((h) => (h + 1) % matches.length)
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMentionHi((h) => (h - 1 + matches.length) % matches.length)
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    pickMention(matches[mentionHi] ?? matches[0], active)
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    const before = chat.input.slice(0, active.start)
                    const after = chat.input.slice(cursor)
                    chat.setInput(before + after)
                    const c = before.length
                    setCursor(c)
                    requestAnimationFrame(() => {
                      taRef.current?.setSelectionRange(c, c)
                    })
                  }
                }
              }}
              overlay={
                active ? (
                  matches.length > 0 ? (
                    <div className="aiMentionMenu" role="listbox" aria-label={t('guide.pane.aria')}>
                      <div className="aiMentionMenuHead">
                        <span>{t('guide.pane.aria')}</span>
                        <span>{matches.length}</span>
                      </div>
                      {matches.map((a, i) => {
                        const group = a.group?.trim()
                        const showGroup = !!group && !/^sem\s*grupo$/i.test(group)
                        const desc = (a.description || '').trim()
                        const difficulty =
                          a.difficulty === 'easy' || a.difficulty === 'medium' || a.difficulty === 'hard'
                            ? a.difficulty
                            : null
                        const diffLabel =
                          difficulty === 'easy'
                            ? t('difficulty.easy')
                            : difficulty === 'medium'
                              ? t('difficulty.medium')
                              : difficulty === 'hard'
                                ? t('difficulty.hard')
                                : null
                        return (
                          <button
                            key={a.apiName || a.id}
                            type="button"
                            role="option"
                            aria-selected={i === mentionHi}
                            className={`aiMentionItem${i === mentionHi ? ' is-active' : ''}${a.completed ? ' is-done' : ''}`}
                            onMouseDown={(ev) => {
                              ev.preventDefault()
                              pickMention(a, active)
                            }}
                            onMouseEnter={() => setMentionHi(i)}
                          >
                            {a.icon ? (
                              <img className="aiMentionIcon" src={a.icon} alt="" loading="lazy" />
                            ) : (
                              <span className="aiMentionIcon is-empty" aria-hidden>
                                <i className="ph-duotone ph-trophy" />
                              </span>
                            )}
                            <span className="aiMentionBody">
                              <span className="aiMentionItemTitle">{a.title}</span>
                              {desc ? <span className="aiMentionItemDesc">{desc}</span> : null}
                              <span className="aiMentionFlags">
                                {a.completed ? (
                                  <span className="aiMentionFlag is-ok">{t('chat.mention.completed')}</span>
                                ) : null}
                                {diffLabel ? (
                                  <span className={`aiMentionFlag is-${difficulty}`}>{diffLabel}</span>
                                ) : null}
                                {a.missable ? (
                                  <span className="aiMentionFlag is-miss">{t('chat.mention.missable')}</span>
                                ) : null}
                                {a.videoUrl?.trim() ? (
                                  <span className="aiMentionFlag">
                                    <i className="ph-bold ph-play" aria-hidden /> {t('chat.mention.video')}
                                  </span>
                                ) : null}
                                {showGroup ? (
                                  <span className="aiMentionFlag is-muted">{group}</span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : chat.achievements.length === 0 ? (
                    <div className="aiMentionMenu aiMentionEmpty">{t('chat.mention.emptyGame')}</div>
                  ) : (
                    <div className="aiMentionMenu aiMentionEmpty">{t('chat.mention.emptySearch')}</div>
                  )
                ) : null
              }
            />
          </div>
        </section>
      ) : null}

      {!panelVisible ? (
        <Tooltip content={t('chat.open')} side="left">
          <button
            type="button"
            className={`aiChatFab${chat.busy ? ' is-busy' : ''}`}
            aria-label={t('chat.open')}
            aria-expanded={false}
            onClick={toggleChat}
          >
            <i className="ph-fill ph-chat" aria-hidden />
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}
