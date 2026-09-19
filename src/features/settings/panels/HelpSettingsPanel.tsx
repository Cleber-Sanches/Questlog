import { useT } from '@/app/providers/LocaleProvider'
import type { MessageKey } from '@/i18n'

const BLOCKS: Array<{ icon: string; titleKey: MessageKey; bodyKeys: MessageKey[] }> = [
  {
    icon: 'ph-fill ph-arrows-clockwise',
    titleKey: 'settings.help.sync.title',
    bodyKeys: ['settings.help.sync.p1', 'settings.help.sync.p2', 'settings.help.sync.p3', 'settings.help.sync.p4'],
  },
  {
    icon: 'ph-fill ph-book-open',
    titleKey: 'settings.help.guide.title',
    bodyKeys: ['settings.help.guide.p1', 'settings.help.guide.p2', 'settings.help.guide.p3'],
  },
  {
    icon: 'ph-fill ph-robot',
    titleKey: 'settings.help.ai.title',
    bodyKeys: ['settings.help.ai.p1', 'settings.help.ai.p2'],
  },
]

const SHORTCUTS = [
  {
    keys: ['Ctrl', 'K'],
    labelKey: 'settings.help.keys.search' as const,
  },
  {
    keys: ['Esc'],
    labelKey: 'settings.help.keys.esc' as const,
  },
  {
    keys: ['?'],
    labelKey: 'settings.help.keys.help' as const,
  },
]

export function HelpSettingsPanel() {
  const t = useT()

  return (
    <div className="stStack">
      <div className="stPanelHead">
        <h2 className="stPanelTitle">{t('settings.help.title')}</h2>
        <p className="stPanelSubtitle">{t('settings.help.subtitle')}</p>
      </div>

      {BLOCKS.map((block) => (
        <section key={block.titleKey} className="stSection">
          <div className="stPanel">
            <article className="stHelpArticle">
              <span className="stRowIcon" aria-hidden>
                <i className={block.icon} />
              </span>
              <div className="stHelpBody">
                <h3 className="stHelpTitle">{t(block.titleKey)}</h3>
                {block.bodyKeys.map((key) => (
                  <p key={key} className="stHelpP">
                    {t(key)}
                  </p>
                ))}
              </div>
            </article>
          </div>
        </section>
      ))}

      <section className="stSection">
        <div className="stPanel">
          <div className="stHelpArticle">
            <span className="stRowIcon" aria-hidden>
              <i className="ph-fill ph-keyboard" />
            </span>
            <div className="stHelpBody">
              <h3 className="stHelpTitle">{t('settings.help.keys.title')}</h3>
            </div>
          </div>
          {SHORTCUTS.map((item) => (
            <div key={item.labelKey} className="stHelpKeyRow">
              <span className="stHelpKeys" aria-hidden>
                {item.keys.map((key) => (
                  <kbd key={key} className="stKbd">
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="stHelpKeyLabel">{t(item.labelKey)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
