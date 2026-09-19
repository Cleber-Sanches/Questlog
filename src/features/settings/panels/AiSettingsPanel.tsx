import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { AiConnectModal } from '@/features/ai/components/AiConnectModal'
import { useAiSettings } from '@/features/ai/hooks/useAiSettings'
import {
  AI_PROVIDERS,
  type ProviderCatalogItem,
} from '@/features/ai/providers'
import type { AiProvider } from '@/types/ai'

export function AiSettingsPanel() {
  const t = useT()
  const ai = useAiSettings()
  const { openModal } = useModal()

  const setEnabled = (enabled: boolean) => {
    void ai.save({ ...ai.settings, enabled })
  }

  const openConnectModal = (providerId: AiProvider) => {
    const cfg = ai.settings.providers[providerId]
    openModal(
      <AiConnectModal
        provider={providerId}
        initial={cfg}
        onDetect={(cliPath) => ai.runDetect(providerId, cliPath)}
        onTestAuth={(cliPath) => ai.runTestAuth(providerId, cliPath)}
        onCliLogin={(cliPath) => ai.runCliLogin(providerId, cliPath)}
        onSave={async (config) => {
          await ai.connectProvider(providerId, config)
        }}
      />,
    )
  }

  if (ai.loading) {
    return (
      <div className="stStack">
        <p className="stEmptyHint">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="stStack">
      <div className="stPanelHead">
        <h2 className="stPanelTitle">{t('settings.nav.ai')}</h2>
        <p className="stPanelSubtitle">{t('settings.ai.enable.desc')}</p>
      </div>

      <section className="stSection">
        <div className="stPanel">
          <div className="stRow">
            <div className="stRowLead">
              <span className="stRowIcon" aria-hidden>
                <i className="ph-fill ph-robot" />
              </span>
              <div className="stRowCopy">
                <div className="stRowTitle">{t('settings.ai.enable.title')}</div>
                <p className="stRowDesc">{t('settings.ai.enable.hint')}</p>
              </div>
            </div>
            <label className="settingsSwitch">
              <input
                type="checkbox"
                checked={ai.settings.enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label={t('settings.ai.enable.title')}
              />
              <span className="settingsSwitchUi" aria-hidden />
            </label>
          </div>
        </div>
      </section>

      {ai.settings.enabled ? (
        <section className="stSection">
          <h3 className="stSectionTitle">{t('settings.ai.providers')}</h3>
          <div className="stPanel">
            {AI_PROVIDERS.map((p, index) => {
              const cfg = ai.settings.providers[p.id]
              return (
                <div key={p.id}>
                  {index > 0 ? <div className="stPanelDivider" role="separator" /> : null}
                  <ProviderRow
                    provider={p}
                    connected={cfg.connected}
                    enabled={cfg.enabled}
                    busy={ai.saving}
                    onConnect={() => openConnectModal(p.id)}
                    onDisconnect={() => void ai.disconnectProvider(p.id)}
                    onToggle={(on) => {
                      if (!cfg.connected || ai.saving) return
                      void ai.setProviderEnabled(p.id, on)
                    }}
                  />
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ProviderRow({
  provider,
  connected,
  enabled,
  busy,
  onConnect,
  onDisconnect,
  onToggle,
}: {
  provider: ProviderCatalogItem
  connected: boolean
  enabled: boolean
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  onToggle: (on: boolean) => void
}) {
  const t = useT()
  const live = connected && enabled
  const desc = connected ? t('settings.ai.status.connected') : t(provider.blurbKey)

  return (
    <div className="stRow stAiProvider">
      <div className="stRowLead">
        <span className={`stIntegrationLogo brand-${provider.id}`} aria-hidden>
          <img src={provider.logo} alt="" width={22} height={22} draggable={false} />
        </span>
        <div className="stRowCopy">
          <div className="stRowTitle">{provider.name}</div>
          <p className="stRowDesc">{desc}</p>
          {connected ? (
            <div className="stAiActions">
              <Button variant="secondary" size="sm" onClick={onConnect} disabled={busy}>
                {t('common.configure')}
              </Button>
              <button
                type="button"
                className="stIntegrationLink"
                onClick={onDisconnect}
                disabled={busy}
              >
                {t('common.disconnect')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {connected ? (
        <label className="stAiToggle">
          <span className="stAiToggleLabel">{t('settings.ai.inChat')}</span>
          <span className="settingsSwitch is-sm">
            <input
              type="checkbox"
              checked={live}
              disabled={busy}
              onChange={(e) => onToggle(e.target.checked)}
              aria-label={t('settings.ai.useInChat', { name: provider.name })}
            />
            <span className="settingsSwitchUi" aria-hidden />
          </span>
        </label>
      ) : (
        <Button variant="secondary" size="md" onClick={onConnect} disabled={busy}>
          {t('common.connect')}
        </Button>
      )}
    </div>
  )
}
