import { useEffect, useRef } from 'react'
import { useLocale } from '@/app/providers/LocaleProvider'
import { useAppData } from '@/app/providers/AppDataProvider'
import { steamApi } from '@/features/steam/api'

export function useSteamLocaleTexts(appId?: string | null) {
  const { locale } = useLocale()
  const { achievementsByAppId, refresh } = useAppData()
  const busy = useRef(false)
  const attempted = useRef<string | null>(null)

  const achievements = appId ? achievementsByAppId[appId] || [] : []

  useEffect(() => {
    attempted.current = null
  }, [locale])

  useEffect(() => {
    if (locale !== 'en' || !appId || achievements.length === 0) return
    if (achievements.every((a) => a.titleEn?.trim())) return
    if (busy.current || attempted.current === appId) return

    busy.current = true
    void steamApi
      .refreshLocaleTexts(appId)
      .then(() => refresh())
      .catch(() => {})
      .finally(() => {
        busy.current = false
        attempted.current = appId
      })
  }, [locale, appId, achievements, refresh])
}
