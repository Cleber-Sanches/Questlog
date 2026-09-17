import { useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT, useLocale } from '@/app/providers/LocaleProvider'
import { useRouter } from '@/app/router'
import { AppShell } from '@/layouts/AppShell'
import { WindowControls } from '@/components/WindowControls'
import { SidebarCollapseToggle } from '@/features/sidebar/components/SidebarCollapseToggle'
import { Tooltip } from '@/components/ui/Tooltip'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { GameCover } from '@/features/games/components/GameCover'
import { useSteamSearch } from '@/features/steam/hooks/useSteamSearch'
import { useAddGame } from '@/features/games/hooks/useAddGame'
import {
  compareGamesByHunt,
  compareGamesByName,
  gameHuntStats,
} from '@/features/games/utils/stats'
import { SegmentedBar } from '@/components/ui/SegmentedBar'
import type { SteamSearchItem } from '@/types/steam'
import type { StatusFilter } from '@/types/achievement'
import type { Game } from '@/types/game'

type LibrarySort = 'hunt' | 'name'

export function LibraryPage() {
  const t = useT()
  const { bcp47 } = useLocale()
  const { games, achievementsByAppId, activeGame, setActiveGame, loading } = useAppData()
  const { navigate } = useRouter()
  const { bind } = useWindowDrag()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<LibrarySort>('hunt')
  const [status, setStatus] = useState<StatusFilter>('all')
  const { addGame, busy } = useAddGame()

  const libraryAll = useMemo(() => games.filter((g) => !g.archived), [games])
  const emptyLibrary = libraryAll.length === 0
  const searchingSteam = emptyLibrary && query.trim().length >= 2
  const steamQuery = searchingSteam ? query.trim() : ''
  const { items: steamItems, loading: steamLoading, error: steamError, query: steamReadyQuery } =
    useSteamSearch(steamQuery)
  const steamAwaiting =
    searchingSteam && (steamLoading || steamQuery !== steamReadyQuery)

  const library = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? libraryAll.filter((g) => g.name.toLowerCase().includes(q) || g.appId.includes(q))
      : libraryAll
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return compareGamesByName(a, b, bcp47)
      return compareGamesByHunt(
        a,
        b,
        gameHuntStats(achievementsByAppId[a.appId] ?? []),
        gameHuntStats(achievementsByAppId[b.appId] ?? []),
        bcp47,
      )
    })
  }, [libraryAll, query, sort, bcp47, achievementsByAppId])

  async function openGuide(appId: string) {
    await setActiveGame(appId)
    navigate('guide')
  }

  async function addFromSteam(item: SteamSearchItem) {
    const ok = await addGame(item)
    if (ok) navigate('guide')
  }

  if (loading) {
    return <div className="app-loading">{t('common.loading')}</div>
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
        <section className="archived-pane" aria-label={t('library.aria')}>
          <header className="archivedHero">
            <SidebarCollapseToggle variant="toolbar" />
            <div {...bind({ className: 'archivedHeroDrag' })} aria-hidden />
            {!emptyLibrary ? (
              <div className="librarySort" role="group" aria-label={t('library.sort.aria')} data-no-drag>
                <button
                  type="button"
                  className={`librarySortBtn${sort === 'hunt' ? ' isActive' : ''}`}
                  aria-pressed={sort === 'hunt'}
                  onClick={() => setSort('hunt')}
                >
                  {t('library.sort.hunt')}
                </button>
                <button
                  type="button"
                  className={`librarySortBtn${sort === 'name' ? ' isActive' : ''}`}
                  aria-pressed={sort === 'name'}
                  onClick={() => setSort('name')}
                >
                  {t('library.sort.name')}
                </button>
              </div>
            ) : null}
            <label className="archivedHeroSearch" data-no-drag>
              <i className="ph ph-magnifying-glass archivedSearchIcon" aria-hidden />
              <input
                type="search"
                placeholder={
                  emptyLibrary ? t('game.search.placeholder') : t('library.search.placeholder')
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                autoFocus={emptyLibrary}
              />
            </label>
            <WindowControls inline />
          </header>

          <div className="archivedGamesGrid">
            {emptyLibrary ? (
              <EmptyLibrary
                searching={searchingSteam}
                loading={steamAwaiting}
                error={steamError}
                items={steamItems}
                busy={busy}
                onAdd={(item) => void addFromSteam(item)}
              />
            ) : library.length === 0 ? (
              <div className="archivedEmpty">
                <p>{t('library.empty.search', { q: query.trim() })}</p>
              </div>
            ) : (
              library.map((game) => (
                <LibraryGameCard
                  key={game.appId}
                  game={game}
                  achievements={achievementsByAppId[game.appId] ?? []}
                  active={game.appId === activeGame?.appId}
                  onOpen={() => void openGuide(game.appId)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

function LibraryGameCard({
  game,
  achievements,
  active,
  onOpen,
}: {
  game: Game
  achievements: Parameters<typeof gameHuntStats>[0]
  active: boolean
  onOpen: () => void
}) {
  const t = useT()
  const stats = gameHuntStats(achievements)

  return (
    <button
      type="button"
      className={`archivedGameCard libraryGameCard libraryHuntCard${stats.platinum ? ' isPlatinum' : ''}${active ? ' isActive' : ''}`}
      aria-label={t('library.open', { name: game.name })}
      aria-current={active ? 'true' : undefined}
      onClick={onOpen}
    >
      <GameCover game={game} platinum={stats.platinum} persist className="libraryGameMedia" />
      <div className="libraryHuntBody">
        <div className="libraryHuntTop">
          <h2 className="libraryHuntName">{game.name}</h2>
          {stats.platinum ? (
            <Tooltip content={t('archived.platinum.tip')} side="top">
              <span className="archivedPlatinumBadge">
                <i className="ph-duotone ph-trophy" aria-hidden />
                <span>{t('archived.platinum')}</span>
              </span>
            </Tooltip>
          ) : null}
        </div>
        {stats.total === 0 ? (
          <p className="libraryHuntMeta">{t('archived.noAchievements')}</p>
        ) : (
          <>
            <p className="libraryHuntMeta">
              <span className="libraryCount">
                <span className="libraryCountDone">{stats.completed}</span>
                <span className="libraryCountSlash" aria-hidden>
                  /
                </span>
                <span className="libraryCountTotal">{stats.total}</span>
              </span>
            </p>
            <div className="libraryHuntBarRow">
              <SegmentedBar
                percent={stats.percent}
                done={stats.completed}
                pending={stats.pending}
                platinum={stats.platinum}
              />
              <span className={`libraryPct${stats.platinum ? ' isPlatinum' : ''}`}>
                {stats.percent}%
              </span>
            </div>
          </>
        )}
      </div>
    </button>
  )
}

function EmptyLibrary({
  searching,
  loading,
  error,
  items,
  busy,
  onAdd,
}: {
  searching: boolean
  loading: boolean
  error: string | null
  items: SteamSearchItem[]
  busy: boolean
  onAdd: (item: SteamSearchItem) => void
}) {
  const t = useT()

  if (!searching) {
    return (
      <div className="archivedEmpty">
        <div className="empty-icon" aria-hidden>
          <i className="ph-duotone ph-game-controller" />
        </div>
        <p>{t('library.empty.title')}</p>
        <span>{t('library.empty.hint')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="archivedEmpty">
        <p>{t('game.search.error')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="archivedEmpty">
        <p>{t('game.search.loading')}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="archivedEmpty">
        <p>{t('game.steam.none')}</p>
        <span>{t('game.search.hint')}</span>
      </div>
    )
  }

  return (
    <>
      <div className="librarySteamLabel">{t('game.steam.results')}</div>
      {items.map((item) => (
        <button
          key={item.appId}
          type="button"
          className="archivedGameCard libraryGameCard"
          disabled={busy}
          aria-label={`${t('game.status.add')} ${item.name}`}
          onClick={() => onAdd(item)}
        >
          <GameCover game={{ appId: item.appId, name: item.name, image: item.image }} />
          <div className="archivedGameBody">
            <div className="archivedGameTitleRow">
              <h2 className="archivedGameName">{item.name}</h2>
            </div>
            <p className="archivedGameMeta">
              <span className="librarySteamAdd">{t('game.status.add')}</span>
              <span className="archivedGameMetaSep" aria-hidden>
                ·
              </span>
              <span>AppID {item.appId}</span>
            </p>
          </div>
          <span className="libraryOpenHint" aria-hidden>
            <i className="ph ph-plus" />
          </span>
        </button>
      ))}
    </>
  )
}
