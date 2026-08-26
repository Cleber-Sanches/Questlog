import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useAppData } from '@/app/providers/AppDataProvider'
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALE_SETTING_KEY,
  parseLocale,
  type Locale,
} from '@/i18n/locales'
import { translate, type MessageKey } from '@/i18n'

type LocaleContextValue = {
  locale: Locale
  bcp47: string
  setLocale: (locale: Locale) => Promise<void>
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { settings, setSetting, loading } = useAppData()
  const locale = loading
    ? DEFAULT_LOCALE
    : parseLocale(settings[LOCALE_SETTING_KEY])

  useEffect(() => {
    if (loading) return
    const meta = LOCALE_META[locale]
    document.documentElement.lang = meta.bcp47
  }, [loading, locale])

  const setLocale = useCallback(
    async (next: Locale) => {
      await setSetting(LOCALE_SETTING_KEY, next)
    },
    [setSetting],
  )

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  )

  const value = useMemo(
    () => ({
      locale,
      bcp47: LOCALE_META[locale].bcp47,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale fora do LocaleProvider')
  return ctx
}

export function useT() {
  return useLocale().t
}
