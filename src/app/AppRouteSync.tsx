import { useEffect } from 'react'
import { useRouter } from '@/app/router'

export function AppRouteSync() {
  const { route } = useRouter()

  useEffect(() => {
    document.documentElement.dataset.route = route
    return () => {
      delete document.documentElement.dataset.route
    }
  }, [route])

  return null
}
