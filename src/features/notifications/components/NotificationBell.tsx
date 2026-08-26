import { useEffect, useMemo, useRef, useState } from 'react'
import { BellIcon } from '@/components/icons/raycast'
import { Button } from '@/components/ui/Button'
import { useLocale, useT } from '@/app/providers/LocaleProvider'
import { useNotifications } from '@/app/providers/NotificationProvider'
import type { MessageKey } from '@/i18n'
import type { Achievement } from '@/types/achievement'

type HistoryItem = {
  id: string
  title: string
  body?: string
  icon?: string | null
  createdAt: number
  read: boolean
}

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

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

function buildUnlockHistory(
  achievements: Achievement[],
  unreadIds: Set<string>,
  t: Translate,
): HistoryItem[] {
  return achievements
    .filter((a) => a.completed)
    .map((a) => {
      const parsed = a.unlockedAt ? Date.parse(a.unlockedAt) : NaN
      const id = `unlock-${a.id}`
      return {
        id,
        title: a.title || t('achievement.fallback'),
        body: a.completedManual ? t('notif.manualComplete') : undefined,
        icon: a.icon,
        createdAt: Number.isFinite(parsed) ? parsed : a.id,
        read: !unreadIds.has(id),
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function NotificationBell({ achievements = [] }: { achievements?: Achievement[] }) {
  const t = useT()
  const { bcp47 } = useLocale()
  const { items, mergeUnlockHistory, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
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
    () => buildUnlockHistory(achievements, unreadIds, t),
    [achievements, unreadIds, t],
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
            {history.length > 0 ? (
              <span className="notifPanelCount">{history.length}</span>
            ) : null}
          </div>
          {history.length === 0 ? (
            <p className="notifEmpty">{t('notif.empty')}</p>
          ) : (
            <ul className="notifList">
              {history.map((n) => (
                <li key={n.id} className={n.read ? 'notifItem' : 'notifItem is-unread'}>
                  {n.icon ? (
                    <img className="notifItemIcon" src={n.icon} alt="" width={28} height={28} />
                  ) : (
                    <span className="notifItemIconFallback" aria-hidden>
                      <BellIcon width={14} height={14} />
                    </span>
                  )}
                  <div className="notifItemBody">
                    <p className="notifItemTitle">{n.title}</p>
                    {n.body ? <p className="notifItemText">{n.body}</p> : null}
                    <p className="notifItemWhen">{formatWhen(n.createdAt, t, bcp47)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
