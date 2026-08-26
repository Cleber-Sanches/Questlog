import { BR, US } from 'country-flag-icons/react/3x2'
import type { Locale } from '@/i18n/locales'

const FLAGS = {
  pt: BR,
  en: US,
} satisfies Record<Locale, typeof BR>

export function LocaleFlag({
  locale,
  className,
  title,
}: {
  locale: Locale
  className?: string
  title?: string
}) {
  const Flag = FLAGS[locale]
  return (
    <span className={className} title={title} aria-hidden={!title}>
      <Flag />
    </span>
  )
}
