import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { gamesApi } from '@/features/games/api'
import { useRouter } from '@/app/router'
import { AppShell } from '@/layouts/AppShell'
import { WindowControls } from '@/components/WindowControls'
import { SidebarCollapseToggle } from '@/features/sidebar/components/SidebarCollapseToggle'
import { ConfirmDialog } from '@/components/overlay/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { initials } from '@/lib/format'
import { gameCoverCandidates } from '@/lib/gameImages'
import type { StatusFilter } from '@/types/achievement'
import type { Game } from '@/types/game'
import type { Achievement } from '@/types/achievement'

function statsFor(items: Achievement[]) {
  const total = items.length
  const completed = items.filter((a) => a.completed).length
  return {
    total,
    completed,
    platinum: total > 0 && completed === total,
  }
}

function ArchivedCover({ game, platinum }: { game: Game; platinum: boolean }) {
  const candidates = useMemo(() => gameCoverCandidates(game), [game])
  const [index, setIndex] = useState(0)
  const src = index < candidates.length ? candidates[index] : ''
  const showImg = !!src

  useEffect(() => {
    setIndex(0)
  }, [game.appId])

  return (
    <div className="archivedGameMedia">
      {platinum ? <span className="archivedPlatinumShine" aria-hidden /> : null}
      {showImg ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setIndex((i) => i + 1)}
        />
      ) : null}
      <span className="archivedGameFallback" hidden={showImg}>
        {initials(game.name || 'GC')}
      </span>
    </div>
  )
}

export function ArchivedGamesPage() {
  const t = useT()
  const { games, achievementsByAppId, refresh, setActiveGame } = useAppData()
  const { navigate } = useRouter()
  const { openModal } = useModal()
  const { bind } = useWindowDrag()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const archivedAll = useMemo(
    () =>
      games
        .filter((g) => g.archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [games],
  )

  const archived = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return archivedAll
    return archivedAll.filter(
      (g) => g.name.toLowerCase().includes(q) || g.appId.includes(q),
    )
  }, [archivedAll, query])

  async function restore(appId: string) {
    await gamesApi.setArchived(appId, false)
    await setActiveGame(appId)
    await refresh()
    navigate('guide')
  }

  function confirmDelete(game: Game) {
    openModal(
      <ConfirmDialog
        title={t('game.remove')}
        message={t('game.remove.confirm', { name: game.name })}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          void (async () => {
            await gamesApi.delete(game.appId)
            await refresh()
          })()
        }}
      />,
    )
  }

  return (
    <AppShell
      status={status}
      setStatus={(s) => {
        setStatus(s)
        navigate('guide')
      }}
    >
      <div className="archived-layout">
        <section className="archived-pane" aria-label={t('archived.aria')}>
          <header className="archivedHero">
            <SidebarCollapseToggle variant="toolbar" />
            <div {...bind({ className: 'archivedHeroDrag' })} aria-hidden />
            <label className="archivedHeroSearch" data-no-drag>
              <i className="ph ph-magnifying-glass archivedSearchIcon" aria-hidden />
              <input
                type="search"
                placeholder={t('archived.search.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
            <WindowControls inline />
          </header>

          <div className="archivedGamesGrid">
            {archivedAll.length === 0 ? (
              <div className="archivedEmpty">
                <div className="empty-icon" aria-hidden>
                  <i className="ph-duotone ph-archive" />
                </div>
                <p>{t('archived.empty.title')}</p>
                <span>{t('archived.empty.hint')}</span>
              </div>
            ) : archived.length === 0 ? (
              <div className="archivedEmpty">
                <p>{t('archived.empty.search', { q: query.trim() })}</p>
              </div>
            ) : (
              archived.map((game) => {
                const stats = statsFor(achievementsByAppId[game.appId] ?? [])
                const pct =
                  stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
                return (
                  <article
                    key={game.appId}
                    className={`archivedGameCard${stats.platinum ? ' isPlatinum' : ''}`}
                  >
                    <ArchivedCover game={game} platinum={stats.platinum} />
                    <div className="archivedGameBody">
                      <div className="archivedGameTitleRow">
                        <h2 className="archivedGameName">{game.name}</h2>
                        {stats.platinum ? (
                          <Tooltip content={t('archived.platinum.tip')} side="top">
                            <span className="archivedPlatinumBadge">
                              <i className="ph-duotone ph-trophy" aria-hidden />
                              <span>{t('archived.platinum')}</span>
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                      <p className="archivedGameMeta">
                        <span>AppID {game.appId}</span>
                        <span className="archivedGameMetaSep" aria-hidden>
                          ·
                        </span>
                        <span
                          className={`archivedGameProgress${stats.platinum ? ' isPlatinum' : ''}`}
                        >
                          {stats.total === 0
                            ? t('archived.noAchievements')
                            : t('archived.progress', {
                                done: stats.completed,
                                total: stats.total,
                              })}
                        </span>
                      </p>
                      {stats.total > 0 ? (
                        <div className="archivedProgressTrack" aria-hidden>
                          <span className="archivedProgressFill" style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                    </div>
                    <div className="archivedGameActions">
                      <button
                        type="button"
                        className="archivedRestoreBtn"
                        onClick={() => void restore(game.appId)}
                      >
                        <i className="ph-duotone ph-arrow-counter-clockwise" aria-hidden />
                        <span>{t('archived.restore')}</span>
                      </button>
                      <Tooltip content={t('archived.remove.tip')} side="top">
                        <button
                          type="button"
                          className="archivedDeleteBtn"
                          aria-label={t('archived.remove.aria')}
                          onClick={() => confirmDelete(game)}
                        >
                          <i className="ph ph-trash" aria-hidden />
                        </button>
                      </Tooltip>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
