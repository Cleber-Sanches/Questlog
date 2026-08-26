export type Locale = 'pt' | 'en'

export const LOCALES: readonly Locale[] = ['pt', 'en'] as const

export const LOCALE_SETTING_KEY = 'locale'

export const DEFAULT_LOCALE: Locale = 'pt'

export type LocaleMeta = {
  id: Locale
  /** Nome nativo do idioma (sempre no próprio idioma). */
  nativeName: string
  /** Código curto (acessibilidade / fallback). */
  short: string
  /** Código ISO do país da bandeira (country-flag-icons). */
  flagCountry: 'BR' | 'US'
  /** BCP 47 para document.documentElement.lang e Intl. */
  bcp47: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  pt: {
    id: 'pt',
    nativeName: 'Português',
    short: 'PT',
    flagCountry: 'BR',
    bcp47: 'pt-BR',
  },
  en: {
    id: 'en',
    nativeName: 'English',
    short: 'EN',
    flagCountry: 'US',
    bcp47: 'en-US',
  },
}

export function parseLocale(value: string | null | undefined): Locale {
  const v = value?.trim().toLowerCase()
  if (v === 'en' || v === 'en-us' || v === 'en-gb') return 'en'
  if (v === 'pt' || v === 'pt-br' || v === 'pt-pt') return 'pt'
  return DEFAULT_LOCALE
}
