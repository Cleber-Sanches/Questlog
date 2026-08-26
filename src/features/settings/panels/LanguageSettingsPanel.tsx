import { useState } from 'react'
import { useLocale } from '@/app/providers/LocaleProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/locales'
import { LocaleFlag } from '@/i18n/LocaleFlag'

export function LanguageSettingsPanel() {
  const { locale, setLocale, t } = useLocale()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const pick = async (next: Locale) => {
    if (next === locale || saving) return
    setSaving(true)
    try {
      await setLocale(next)
      toast(t('settings.language.saved'), 'success')
    } catch {
      toast(t('settings.language.saveError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stStack">
      <div className="stPanelHead">
        <h2 className="stPanelTitle">{t('settings.language.title')}</h2>
        <p className="stPanelSubtitle">{t('settings.language.subtitle')}</p>
      </div>

      <div className="stPanel">
        <div className="stLangGrid" role="radiogroup" aria-label={t('settings.language.title')}>
          {LOCALES.map((id) => {
            const meta = LOCALE_META[id]
            const active = locale === id
            const hint =
              id === 'pt' ? t('settings.language.pt.hint') : t('settings.language.en.hint')
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`stLangCard${active ? ' is-active' : ''}`}
                disabled={saving}
                onClick={() => void pick(id)}
              >
                <span className="stLangFlagWrap" aria-hidden>
                  <LocaleFlag locale={id} className="stLangFlag" title={meta.nativeName} />
                </span>
                <span className="stLangCopy">
                  <span className="stLangName">{meta.nativeName}</span>
                  <span className="stLangHint">{hint}</span>
                </span>
                <span className={`stLangCheck${active ? ' is-on' : ''}`} aria-hidden>
                  <i className="ph-bold ph-check" />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
