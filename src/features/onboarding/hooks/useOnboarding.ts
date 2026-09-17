import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import { ONBOARDING_SETTING_KEY } from '../keys'

export function useOnboarding() {
  const { loading, games, settings, setSetting } = useAppData()
  const launchedEmpty = useRef<boolean | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading) return
    if (launchedEmpty.current !== null) {
      setReady(true)
      return
    }
    const hasGames = games.length > 0
    launchedEmpty.current = !hasGames
    if (hasGames && settings[ONBOARDING_SETTING_KEY] !== '1') {
      void setSetting(ONBOARDING_SETTING_KEY, '1')
    }
    setReady(true)
  }, [loading, games.length, settings, setSetting])

  const complete = useCallback(async () => {
    await setSetting(ONBOARDING_SETTING_KEY, '1')
  }, [setSetting])

  const active =
    ready && launchedEmpty.current === true && settings[ONBOARDING_SETTING_KEY] !== '1'

  return { active, complete }
}
