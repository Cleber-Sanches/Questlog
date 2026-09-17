import { useEffect, useRef, useState } from 'react'
import { steamApi } from '@/features/steam/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { SteamSearchItem } from '@/types/steam'

export function useSteamSearch(query: string) {
  const debounced = useDebouncedValue(query, 300)
  const [items, setItems] = useState<SteamSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const q = debounced.trim()
    if (!q) {
      reqId.current += 1
      setItems([])
      setError(null)
      setLoading(false)
      return
    }

    const id = ++reqId.current
    setLoading(true)
    setError(null)

    steamApi
      .search(q)
      .then((res) => {
        if (id !== reqId.current) return
        setItems(res.items)
        setError(null)
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return
        setItems([])
        setError(String(err))
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [debounced])

  return { items, loading, error, query: debounced }
}
