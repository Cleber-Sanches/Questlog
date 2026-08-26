import type { Locale } from './locales'
import type { MessageKey } from './messages/pt'
import { pt } from './messages/pt'
import { en } from './messages/en'

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  pt,
  en,
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const table = catalogs[locale] ?? catalogs.pt
  let text = table[key] ?? catalogs.pt[key] ?? String(key)
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export type { MessageKey }
