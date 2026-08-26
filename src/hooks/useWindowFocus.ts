import { useEffect } from 'react'

export function useWindowFocus(onFocus: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('focus', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [onFocus])
}
