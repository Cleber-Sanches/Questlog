import { useEffect, useMemo, useState } from 'react'
import { initials } from '@/lib/format'
import { gameListIconCandidates } from '@/lib/gameImages'

export function GameListIcon({
  appId,
  name,
  image,
  className,
}: {
  appId: string
  name: string
  image?: string | null
  className?: string
}) {
  const candidates = useMemo(() => gameListIconCandidates(appId, image), [appId, image])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [appId])

  const src = index < candidates.length ? candidates[index] : ''
  const show = !!src

  return (
    <span className={className ?? 'onboardGameIcon'}>
      {show ? (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          onError={() => setIndex((i) => i + 1)}
        />
      ) : null}
      <span className="onboardGameIconFallback" hidden={show}>
        {initials(name || 'GC')}
      </span>
    </span>
  )
}
