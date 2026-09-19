import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { BellIcon } from '@/components/icons/raycast'
import { Button } from '@/components/ui/Button'
import { useAppData } from '@/app/providers/AppDataProvider'
import { useLocale, useT } from '@/app/providers/LocaleProvider'
import { useNotifications } from '@/app/providers/NotificationProvider'
import { useRouter } from '@/app/router'
import type { MessageKey } from '@/i18n'
import type { Achievement } from '@/types/achievement'
import type { Game } from '@/types/game'

type HistoryItem = {
  id: string
  title: string
  body?: string
  icon?: string | null
  createdAt: number
  read: boolean
  appId?: string
  gameName?: string
}

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string
type Scope = 'all' | 'game'

const SESSION_START = Date.now()

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatWhen(ts: number, t: Translate, bcp47: string) {
  if (!ts || Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('time.now')
  if (min < 60) return t('time.minutesAgo', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('time.hoursAgo', { n: h })
  const d = Math.floor(h / 24)
  if (d < 7) return t('time.daysAgo', { n: d })
  try {
    return new Intl.DateTimeFormat(bcp47, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString(bcp47)
  }
}

function dayLabel(ts: number, t: Translate, bcp47: string) {
  const now = new Date()
  const day = new Date(ts)
  if (sameDay(now, day)) return t('notif.group.today')
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(yesterday, day)) return t('notif.group.yesterday')
  try {
    return new Intl.DateTimeFormat(bcp47, { day: 'numeric', month: 'long' }).format(day)
  } catch {
    return day.toLocaleDateString(bcp47)
  }
}

function buildUnlockHistory(
  games: Game[],
  byAppId: Record<string, Achievement[]>,
  unreadIds: Set<string>,
  t: Translate,
): HistoryItem[] {
  const gameById = new Map(games.map((game) => [game.appId, game]))
  const out: HistoryItem[] = []
  for (const [appId, list] of Object.entries(byAppId)) {
    const game = gameById.get(appId)
    for (const achievement of list) {
      if (!achievement.completed) continue
      const parsed = achievement.unlockedAt ? Date.parse(achievement.unlockedAt) : NaN
      const id = `unlock-${achievement.id}`
      out.push({
        id,
        title: achievement.title || t('achievement.fallback'),
        body: achievement.completedManual ? t('notif.manualComplete') : undefined,
        icon: achievement.icon,
        createdAt: Number.isFinite(parsed) ? parsed : achievement.id,
        read: !unreadIds.has(id),
        appId,
        gameName: game?.name,
      })
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export function NotificationBell() {
  const t = useT()
  const { bcp47 } = useLocale()
  const { navigate } = useRouter()
  const { games, achievementsByAppId, activeGame, setActiveGame } = useAppData()
  const { items, mergeUnlockHistory, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>('all')
  const rootRef = useRef<HTMLDivElement>(null)

  const unreadKey = useMemo(
    () =>
      items
        .filter((n) => !n.read)
        .map((n) => n.id)
        .sort()
        .join('|'),
    [items],
  )
  const unreadIds = useMemo(
    () => new Set(unreadKey ? unreadKey.split('|') : []),
    [unreadKey],
  )

  const history = useMemo(
    () => buildUnlockHistory(games, achievementsByAppId, unreadIds, t),
    [games, achievementsByAppId, unreadIds, t],
  )

  const scoped = useMemo(() => {
    if (scope !== 'game' || !activeGame) return history
    return history.filter((item) => item.appId === activeGame.appId)
  }, [history, scope, activeGame])

  const groups = useMemo(() => {
    const buckets: { key: number; label: string; items: HistoryItem[] }[] = []
    const index = new Map<number, number>()
    for (const item of scoped) {
      const key = startOfDay(item.createdAt)
      const existing = index.get(key)
      if (existing == null) {
        index.set(key, buckets.length)
        buckets.push({ key, label: dayLabel(item.createdAt, t, bcp47), items: [item] })
      } else {
        buckets[existing].items.push(item)
      }
    }
    return buckets
  }, [scoped, t, bcp47])

  const todayCount = useMemo(() => {
    const start = startOfDay(Date.now())
    return scoped.filter((item) => item.createdAt >= start).length
  }, [scoped])

  const sessionCount = useMemo(
    () => scoped.filter((item) => item.createdAt >= SESSION_START).length,
    [scoped],
  )

  const badgeCount = useMemo(() => history.filter((h) => !h.read).length, [history])

  useEffect(() => {
    mergeUnlockHistory(
      history.map((h) => ({
        id: h.id,
        title: h.title,
        body: h.body,
        icon: h.icon,
        createdAt: h.createdAt,
      })),
    )
  }, [history, mergeUnlockHistory])

  useEffect(() => {
    if (!open) return
    markAllRead()
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, markAllRead])

  useEffect(() => {
    if (!activeGame && scope === 'game') setScope('all')
  }, [activeGame, scope])

  async function openItem(item: HistoryItem) {
    setOpen(false)
    if (!item.appId) return
    if (activeGame?.appId !== item.appId) await setActiveGame(item.appId)
    navigate('guide')
  }

  return (
    <div className="notifBell" ref={rootRef}>
      <Button
        variant="secondary"
        size="icon"
        className={open ? 'is-open' : undefined}
        title={open ? undefined : t('notif.title')}
        tooltipSide="bottom"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notif.title')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BellIcon width={16} height={16} className="btnIcon" aria-hidden />
        {badgeCount > 0 ? (
          <span
            className={`notifBellBadge${badgeCount === 1 ? ' is-dot' : ''}`}
            aria-hidden
          >
            {badgeCount === 1 ? null : badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="notifPanel" role="dialog" aria-label={t('notif.title')}>
          <div className="notifPanelHead">
            <span className="notifPanelTitle">{t('notif.heading')}</span>
            {scoped.length > 0 ? (
              <span className="notifPanelCount">{scoped.length}</span>
            ) : null}
          </div>
          {activeGame ? (
            <div className="notifFilters" role="tablist" aria-label={t('notif.filter.aria')}>
              <button
                type="button"
                className={scope === 'all' ? 'isActive' : undefined}
                onClick={() => setScope('all')}
              >
                {t('notif.filter.all')}
              </button>
              <button
                type="button"
                className={scope === 'game' ? 'isActive' : undefined}
                onClick={() => setScope('game')}
              >
                {t('notif.filter.game')}
              </button>
            </div>
          ) : null}
          {scope === 'game' && scoped.length > 0 ? (
            <p className="notifScope">
              {t('notif.scope.today', { n: todayCount })}
              {' · '}
              {t('notif.scope.session', { n: sessionCount })}
            </p>
          ) : null}
          {scoped.length === 0 ? (
            <p className="notifEmpty">{t('notif.empty')}</p>
          ) : (
            <ul className="notifList">
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <li className="notifGroupLabel">{group.label}</li>
                  {group.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={n.read ? 'notifItem' : 'notifItem is-unread'}
                        onClick={() => void openItem(n)}
                      >
                        {n.icon ? (
                          <img className="notifItemIcon" src={n.icon} alt="" width={28} height={28} />
                        ) : (
                          <span className="notifItemIconFallback" aria-hidden>
                            <BellIcon width={14} height={14} />
                          </span>
                        )}
                        <div className="notifItemBody">
                          <p className="notifItemTitle">{n.title}</p>
                          {n.gameName && scope === 'all' ? (
                            <p className="notifItemText">{n.gameName}</p>
                          ) : null}
                          {n.body ? <p className="notifItemText">{n.body}</p> : null}
                          <p className="notifItemWhen">{formatWhen(n.createdAt, t, bcp47)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
