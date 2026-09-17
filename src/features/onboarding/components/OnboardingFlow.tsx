import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from '@/app/providers/LocaleProvider'
import { useModal } from '@/app/providers/ModalProvider'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useRouter } from '@/app/router'
import { Button } from '@/components/ui/Button'
import { SearchField } from '@/components/ui/SearchField'
import { WindowControls } from '@/components/WindowControls'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { EASE_OUT } from '@/lib/motion/ease'
import { GameListIcon } from '@/features/games/components/GameListIcon'
import { useAddGame } from '@/features/games/hooks/useAddGame'
import { useSteamSearch } from '@/features/steam/hooks/useSteamSearch'
import { useSteamSettings } from '@/features/steam/hooks/useSteamSettings'
import { useAiSettings } from '@/features/ai/hooks/useAiSettings'
import { AiConnectModal } from '@/features/ai/components/AiConnectModal'
import { AI_PROVIDERS } from '@/features/ai/providers'
import type { MessageKey } from '@/i18n'
import type { AiProvider } from '@/types/ai'
import type { SteamSearchItem } from '@/types/steam'

type Step = 'steam' | 'game' | 'ai'

const STEP_ORDER: Step[] = ['steam', 'game', 'ai']

const STEP_META: Record<Step, { labelKey: MessageKey; titleKey: MessageKey; leadKey: MessageKey }> =
  {
    steam: {
      labelKey: 'onboard.step.steam',
      titleKey: 'onboard.steam.title',
      leadKey: 'onboard.steam.lead',
    },
    game: {
      labelKey: 'onboard.step.game',
      titleKey: 'onboard.game.title',
      leadKey: 'onboard.game.lead',
    },
    ai: {
      labelKey: 'onboard.step.ai',
      titleKey: 'onboard.ai.title',
      leadKey: 'onboard.ai.lead',
    },
  }

const AI_BLURB: Record<AiProvider, MessageKey> = {
  'claude-code': 'onboard.ai.claude',
  opencode: 'onboard.ai.opencode',
}

export function OnboardingFlow({ onComplete }: { onComplete: () => Promise<void> }) {
  const t = useT()
  const reduce = useReducedMotion()
  const { bind } = useWindowDrag()
  const { navigate } = useRouter()
  const { activeGame } = useAppData()
  const { status, ready, chooseInstallDir } = useSteamSettings()
  const { addGame, busy } = useAddGame()
  const ai = useAiSettings()
  const { openModal } = useModal()
  const searchRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [query, setQuery] = useState('')
  const searching = query.trim().length >= 2
  const { items, loading, error, query: readyQuery } = useSteamSearch(searching ? query.trim() : '')
  const awaiting = searching && (loading || query.trim() !== readyQuery)
  const steamPath = status.installDir || status.detectedDir
  const hasSteam = !!steamPath

  useEffect(() => {
    if (!ready || step) return
    setStep('steam')
  }, [ready, step])

  useEffect(() => {
    if (step === 'game') searchRef.current?.focus()
  }, [step])

  const finish = async () => {
    await onComplete()
    if (activeGame) navigate('guide')
  }

  const openConnect = (providerId: AiProvider) => {
    const cfg = ai.settings.providers[providerId]
    openModal(
      <AiConnectModal
        provider={providerId}
        initial={cfg}
        onDetect={(cliPath) => ai.runDetect(providerId, cliPath)}
        onTestAuth={(cliPath) => ai.runTestAuth(providerId, cliPath)}
        onCliLogin={(cliPath) => ai.runCliLogin(providerId, cliPath)}
        onSave={async (config) => {
          const saved = await ai.connectProvider(providerId, config)
          if (saved && !saved.enabled) {
            await ai.save({ ...saved, enabled: true })
          }
          await finish()
        }}
      />,
    )
  }

  const addFromSteam = async (item: SteamSearchItem) => {
    const ok = await addGame(item)
    if (ok) setStep('ai')
  }

  const steamFound = step === 'steam' && hasSteam
  const titleKey = steamFound ? 'onboard.steam.found.title' : (step ? STEP_META[step].titleKey : 'onboard.game.title')
  const leadKey = steamFound ? 'onboard.steam.found.lead' : (step ? STEP_META[step].leadKey : 'onboard.game.lead')
  const stepIndex = step ? STEP_ORDER.indexOf(step) : 0
  const skipTo = step === 'steam' ? 'game' : 'ai'

  return (
    <div className="onboard">
      <header {...bind({ className: 'onboardTop' })}>
        <div className="onboardDrag" aria-hidden />
        <WindowControls inline />
      </header>

      <main className="onboardMain">
        {!ready || !step ? (
          <p className="onboardHint">{t('common.loading')}</p>
        ) : (
          <div className="onboardCol">
            <img
              className="onboardLogo"
              src="/questlog-mark.png"
              width={72}
              height={72}
              alt=""
              draggable={false}
            />

            <nav className="onboardDots" aria-label={t('onboard.kicker')}>
              {STEP_ORDER.map((id, i) => {
                const current = id === step
                const done = i < stepIndex
                return (
                  <button
                    key={id}
                    type="button"
                    className={`onboardDot${current ? ' isOn' : ''}${done ? ' isDone' : ''}`}
                    aria-label={t(STEP_META[id].labelKey)}
                    aria-current={current ? 'step' : undefined}
                    onClick={() => setStep(id)}
                  />
                )
              })}
            </nav>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${step}-${steamFound ? 'found' : 'ask'}`}
                className="onboardPanel"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
              >
                <h1 className="onboardTitle">{t(titleKey)}</h1>
                <p className="onboardLead">{t(leadKey)}</p>

                {step === 'steam' && steamFound ? (
                  <>
                    <div className="onboardFound">
                      <i className="ph-fill ph-check-circle" aria-hidden />
                      <span className="onboardFoundPath" title={steamPath ?? undefined}>
                        {steamPath}
                      </span>
                    </div>
                    <Button variant="primary" size="lg" onClick={() => setStep('game')}>
                      {t('onboard.continue')}
                    </Button>
                    <button
                      type="button"
                      className="onboardLater"
                      onClick={() => void chooseInstallDir()}
                    >
                      {t('onboard.steam.change')}
                    </button>
                  </>
                ) : null}

                {step === 'steam' && !steamFound ? (
                  <Button variant="primary" size="lg" onClick={() => void chooseInstallDir()}>
                    {t('common.chooseFolder')}
                  </Button>
                ) : null}

                {step === 'game' ? (
                  <>
                    <div className="onboardSearch">
                      <SearchField
                        inputRef={searchRef}
                        value={query}
                        onChange={setQuery}
                        placeholder={t('game.search.placeholder')}
                      />
                    </div>
                    {searching ? (
                      <div className="onboardResults">
                        {error ? (
                          <p className="onboardHint">{t('game.search.error')}</p>
                        ) : items.length === 0 ? (
                          <p className="onboardHint">
                            {awaiting ? t('game.search.loading') : t('game.steam.none')}
                          </p>
                        ) : (
                          items.slice(0, 6).map((item) => (
                            <button
                              key={item.appId}
                              type="button"
                              className="onboardGame"
                              disabled={busy}
                              aria-label={`${t('game.status.add')} ${item.name}`}
                              onClick={() => void addFromSteam(item)}
                            >
                              <GameListIcon
                                appId={item.appId}
                                name={item.name}
                                image={item.image}
                              />
                              <span className="onboardGameName">{item.name}</span>
                              <span className="onboardGameAdd">{t('game.status.add')}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {step === 'ai' ? (
                  <div className="onboardProviders">
                    {AI_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="onboardProvider"
                        disabled={ai.saving}
                        onClick={() => openConnect(p.id)}
                      >
                        <span className={`onboardProviderLogo brand-${p.id}`} aria-hidden>
                          <img
                            src={p.logo}
                            alt=""
                            width={40}
                            height={40}
                            draggable={false}
                          />
                        </span>
                        <span className="onboardProviderCopy">
                          <strong>{p.name}</strong>
                          <span>{t(AI_BLURB[p.id])}</span>
                        </span>
                        <span className="onboardProviderCta">{t('common.connect')}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {step === 'ai' ? (
                  <Button variant="primary" size="lg" onClick={() => void finish()}>
                    {t('onboard.ai.skip')}
                  </Button>
                ) : steamFound ? null : (
                  <button type="button" className="onboardLater" onClick={() => setStep(skipTo)}>
                    {t('onboard.later')}
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}
