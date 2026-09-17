import { useEffect, useMemo, useRef, useState } from 'react'
import { initials } from '@/lib/format'
import { gameCoverCandidates, isStoreCoverUrl } from '@/lib/gameImages'
import { fetchHashedStoreCover } from '@/features/games/utils/cover'
import { gamesApi } from '@/features/games/api'
import { useAppData } from '@/app/providers/AppDataProvider'
import type { Game } from '@/types/game'

const MIN_COVER_PX = 160

export function GameCover({
  game,
  platinum = false,
  className,
  persist = false,
}: {
  game: Pick<Game, 'appId' | 'name' | 'image' | 'icon'> & Partial<Game>
  platinum?: boolean
  className?: string
  persist?: boolean
}) {
  const { upsertGameLocal } = useAppData()
  const staticCandidates = useMemo(() => gameCoverCandidates(game), [game])
  const [index, setIndex] = useState(0)
  const [hashed, setHashed] = useState<string | null>(null)
  const hashedTried = useRef(false)
  const persisted = useRef(false)

  const candidates = useMemo(() => {
    if (!hashed) return staticCandidates
    return [...new Set([hashed, ...staticCandidates])]
  }, [hashed, staticCandidates])

  const src = index < candidates.length ? candidates[index] : ''
  const showImg = !!src

  useEffect(() => {
    setIndex(0)
    setHashed(null)
    hashedTried.current = false
    persisted.current = false
  }, [game.appId])

  useEffect(() => {
    if (!hashed || !persist || persisted.current || !game.appId) return
    if (game.image === hashed || isStoreCoverUrl(game.image)) return
    persisted.current = true
    const next = { ...game, image: hashed, links: game.links ?? [] } as Game
    upsertGameLocal(next)
    void gamesApi.upsert(next)
  }, [hashed, persist, game, upsertGameLocal])

  function reject() {
    if (index + 1 < candidates.length) {
      setIndex(index + 1)
      return
    }
    if (hashedTried.current || !game.appId) {
      setIndex(candidates.length)
      return
    }
    hashedTried.current = true
    void fetchHashedStoreCover(game.appId).then((url) => {
      if (!url) {
        setIndex(candidates.length)
        return
      }
      setHashed(url)
      setIndex(0)
    })
  }

  return (
    <div className={['archivedGameMedia', className].filter(Boolean).join(' ')}>
      {platinum ? <span className="archivedPlatinumShine" aria-hidden /> : null}
      {showImg ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={reject}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth < MIN_COVER_PX) reject()
          }}
        />
      ) : null}
      <span className="archivedGameFallback" hidden={showImg}>
        {initials(game.name || 'GC')}
      </span>
    </div>
  )
}
