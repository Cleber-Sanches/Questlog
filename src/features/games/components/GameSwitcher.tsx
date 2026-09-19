import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { useSteamSearch } from '@/features/steam/hooks/useSteamSearch'
import { useAddGame } from '@/features/games/hooks/useAddGame'
import { gamesApi } from '@/features/games/api'
import { initials } from '@/lib/format'
import { useRouter } from '@/app/router'
import { useModal } from '@/app/providers/ModalProvider'
import { GameLinksEditor } from './GameLinksEditor'
import type { Game } from '@/types/game'

function GameRowMenu({
  game,
  isOpen,
  onToggle,
  onClose,
  onLinks,
  onArchive,
  onDelete,
}: {
  game: Game
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onLinks: (game: Game) => void
  onArchive: (appId: string) => void
  onDelete: (game: Game) => void
}) {
  const t = useT()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  return (
    <div className={`gameSwitcherRowMenuWrap${isOpen ? ' isOpen' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="gameSwitcherRowMoreBtn"
        aria-label={t('game.options.aria', { name: game.name })}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <i className="ph ph-dots-three" aria-hidden />
      </button>
      {isOpen ? (
        <div className="gameSwitcherRowMenu" role="menu">
          <button
            type="button"
            className="gameSwitcherRowMenuItem"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              onLinks(game)
              onClose()
            }}
          >
            <i className="ph ph-link" aria-hidden />
            <span>{t('game.links.title')}</span>
          </button>
          <button
            type="button"
            className="gameSwitcherRowMenuItem"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              onArchive(game.appId)
              onClose()
            }}
          >
            <i className="ph ph-archive-box" aria-hidden />
            <span>{t('game.archive')}</span>
          </button>
          <button
            type="button"
            className="gameSwitcherRowMenuItem isDanger"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(game)
              onClose()
            }}
          >
            <i className="ph ph-trash" aria-hidden />
            <span>{t('game.remove')}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function GameIcon({
  image,
  name,
  size = 'md',
}: {
  image?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md'
}) {
  const [broken, setBroken] = useState(false)
  const showImg = !!image && !broken
  const className =
    size === 'xs'
      ? 'gameSwitcherIconXs'
      : size === 'sm'
        ? 'gameSwitcherChipIcon'
        : 'gameSwitcherIcon'
  const fallbackClass =
    size === 'xs'
      ? 'gameSwitcherIconXsFallback'
      : size === 'sm'
        ? 'gameSwitcherChipFallback'
        : 'gameSwitcherIconFallback'

  return (
    <span className="gameSwitcherIconBox">
      {showImg ? (
        <img className={className} src={image} alt="" onError={() => setBroken(true)} />
      ) : null}
      <span className={fallbackClass} hidden={showImg} aria-hidden={showImg}>
        {initials(name || 'GC')}
      </span>
    </span>
  )
}

export function GameSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const t = useT()
  const { games, activeGame, setActiveGame, refresh } = useAppData()
  const { navigate, route } = useRouter()
  const { openModal } = useModal()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rowMenuId, setRowMenuId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const searching = query.trim().length >= 2
  const steamQuery = searching ? query.trim() : ''
  const { items: steamItems, loading, error } = useSteamSearch(steamQuery)
  const { addGame, busy } = useAddGame()

  const library = useMemo(() => {
    const active = games.filter((g) => !g.archived)
    const q = query.trim().toLowerCase()
    const filtered = q
      ? active.filter((g) => g.name.toLowerCase().includes(q) || g.appId.includes(q))
      : active
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [games, query])

  const archivedCount = games.filter((g) => g.archived).length
  const showLibrary = !(searching && library.length === 0)
  const libraryLabel = searching
    ? t('game.library.filtered', { n: library.length })
    : library.length > 0
      ? t('game.library.count', { n: library.length })
      : t('game.library')

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setRowMenuId(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rowMenuId) setRowMenuId(null)
        else setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, rowMenuId])

  async function selectGame(appId: string) {
    await setActiveGame(appId)
    setOpen(false)
    setRowMenuId(null)
    setQuery('')
    if (route !== 'guide') navigate('guide')
  }

  async function archiveGame(appId: string) {
    await gamesApi.setArchived(appId, true)
    await refresh()
  }

  async function deleteGame(game: Game) {
    if (!window.confirm(t('game.remove.confirm', { name: game.name }))) {
      return
    }
    await gamesApi.delete(game.appId)
    await refresh()
  }

  function openLinks(game: Game) {
    setOpen(false)
    setRowMenuId(null)
    openModal(<GameLinksEditor game={game} />)
  }

  function steamStatus(appId: string) {
    const existing = games.find((g) => g.appId === appId)
    if (!existing) return { label: t('game.status.add'), className: 'gameSwitcherMenuItemMeta isAdd' }
    if (existing.archived) return { label: t('game.status.archived'), className: 'gameSwitcherMenuItemMeta' }
    return { label: t('game.status.inLibrary'), className: 'gameSwitcherMenuItemMeta' }
  }

  let hint: string | null = null
  if (error) hint = t('game.search.error')
  else if (loading) hint = t('game.search.loading')
  else if (searching && !loading && steamItems.length === 0) {
    hint = t('game.search.hint')
  }

  function toggleOpen() {
    setRowMenuId(null)
    setOpen((v) => !v)
  }

  return (
    <div
      className={`gameSwitcher sidebar-top${collapsed ? ' isCollapsed' : ''}`}
      id="gameSwitcher"
      ref={rootRef}
    >
      <button
        type="button"
        className={`gameSwitcherTriggerCard${collapsed ? ' isCollapsed' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          collapsed
            ? activeGame?.name
              ? t('game.active.aria', { name: activeGame.name })
              : t('game.select')
            : undefined
        }
        onClick={toggleOpen}
      >
        <span className="gameSwitcherTriggerMain">
          <GameIcon
            image={activeGame?.image || activeGame?.icon}
            name={activeGame?.name || 'GC'}
            size="xs"
          />
          {!collapsed ? (
            <span className="gameSwitcherTriggerText">
              <span className="gameSwitcherTriggerName">
                {activeGame?.name || t('game.select')}
              </span>
              <span className="gameSwitcherTriggerMeta">
                {activeGame ? `AppID ${activeGame.appId}` : t('game.select.hint')}
              </span>
            </span>
          ) : null}
        </span>
        {!collapsed ? (
          <span className="gameSwitcherTriggerMore" aria-hidden>
            <i className="ph ph-dots-three" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="gameSwitcherMenu" role="listbox">
          <div className="gameSwitcherMenuInner">
            <div className="gameSwitcherSearch">
              <i className="ph ph-magnifying-glass" aria-hidden />
              <input
                type="search"
                placeholder={t('game.search.placeholder')}
                autoComplete="off"
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="gameSwitcherMenuBody">
              {showLibrary ? (
                <>
                  <div className="gameSwitcherSectionLabel">{libraryLabel}</div>
                  <div className="gameSwitcherList">
                    {library.length === 0 ? (
                      <div className="gameSwitcherMenuEmpty">
                        {searching ? t('game.library.emptySearch') : t('game.library.empty')}
                      </div>
                    ) : null}
                    {library.map((g) => {
                      const isActive = g.appId === activeGame?.appId
                      return (
                        <div
                          key={g.appId}
                          className={`gameSwitcherMenuItemRow${isActive ? ' isActive' : ''}${rowMenuId === g.appId ? ' hasRowMenu' : ''}`}
                        >
                          <button
                            type="button"
                            className="gameSwitcherMenuItem"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => void selectGame(g.appId)}
                          >
                            <GameIcon image={g.image || g.icon} name={g.name} size="xs" />
                            <span className="gameSwitcherMenuItemText">
                              <span className="gameSwitcherMenuItemName">{g.name}</span>
                              <span className="gameSwitcherMenuItemMeta">AppID {g.appId}</span>
                            </span>
                          </button>
                          {isActive ? (
                            <span className="gameSwitcherMenuItemCheckSlot" aria-hidden>
                              <i className="ph ph-check" />
                            </span>
                          ) : (
                            <GameRowMenu
                              game={g}
                              isOpen={rowMenuId === g.appId}
                              onToggle={() =>
                                setRowMenuId((id) => (id === g.appId ? null : g.appId))
                              }
                              onClose={() => setRowMenuId(null)}
                              onLinks={openLinks}
                              onArchive={(appId) => void archiveGame(appId)}
                              onDelete={(game) => void deleteGame(game)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : null}

              {searching ? (
                <>
                  <div className="gameSwitcherSectionLabel">{t('game.steam.results')}</div>
                  <div className="gameSwitcherList">
                    {loading ? (
                      <div className="gameSwitcherMenuItem isDisabled">{t('common.searching')}</div>
                    ) : null}
                    {!loading && steamItems.length === 0 ? (
                      <div className="gameSwitcherMenuItem isDisabled">{t('game.steam.none')}</div>
                    ) : null}
                    {!loading
                      ? steamItems.map((item) => {
                          const status = steamStatus(item.appId)
                          return (
                            <button
                              key={item.appId}
                              type="button"
                              className={`gameSwitcherMenuItem${status.className.includes('isAdd') ? ' isAdd' : ''}`}
                              disabled={busy}
                              onClick={async () => {
                                const ok = await addGame(item)
                                if (!ok) return
                                setOpen(false)
                                setQuery('')
                                navigate('guide')
                              }}
                            >
                              <GameIcon image={item.image} name={item.name} size="xs" />
                              <span className="gameSwitcherMenuItemText">
                                <span className="gameSwitcherMenuItemName">{item.name}</span>
                                <span className={status.className}>{status.label}</span>
                              </span>
                              <span className="gameSwitcherMenuItemCheckSlot" aria-hidden />
                            </button>
                          )
                        })
                      : null}
                  </div>
                </>
              ) : null}

              {hint ? (
                <p className={`gameSwitcherHint${error ? ' isError' : ''}`}>{hint}</p>
              ) : null}
            </div>

            <div className="gameSwitcherMenuDivider" aria-hidden />

            <button
              type="button"
              className="gameSwitcherMenuAction"
              onClick={() => {
                setOpen(false)
                navigate('archived')
              }}
            >
              <i className="ph ph-archive-box" aria-hidden />
              <span>{t('nav.archived')}</span>
              {archivedCount > 0 ? (
                <span className="gameSwitcherMenuActionMeta">{archivedCount}</span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
