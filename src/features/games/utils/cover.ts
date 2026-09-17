import { steamApi } from '@/features/steam/api'

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

/** Header hashed da Store (jogos novos sem `/header.jpg` na raiz). */
export function fetchHashedStoreCover(appId: string) {
  const id = appId.trim()
  if (!id) return Promise.resolve(null)
  const hit = cache.get(id)
  if (hit) return Promise.resolve(hit)
  const running = pending.get(id)
  if (running) return running

  const job = steamApi
    .clientIcon(id)
    .then((res) => {
      const cover = res.cover?.trim() || null
      if (cover) cache.set(id, cover)
      pending.delete(id)
      return cover
    })
    .catch(() => {
      pending.delete(id)
      return null
    })

  pending.set(id, job)
  return job
}
