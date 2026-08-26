import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { AiConnectModal } from '@/features/ai/components/AiConnectModal'
import { useAiSettings } from '@/features/ai/hooks/useAiSettings'
import { AI_PROVIDERS, type ProviderCatalogItem } from '@/features/ai/providers'
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
      <div className="stPanel">
        <div className="stRow">
          <div className="stRowLead">
            <span className="stRowIcon" aria-hidden>
              <i className="ph ph-robot" />
            </span>
            <div className="stRowCopy">
              <div className="stRowTitle">{t('settings.ai.enable.title')}</div>
              <p className="stRowDesc">{t('settings.ai.enable.desc')}</p>
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

        {ai.settings.enabled ? (
          <>
            <div className="stPanelDivider" role="separator" />

            <div className="stBlock">
              <div className="stIntegrationsGrid" role="list" aria-label={t('settings.ai.providers')}>
                {AI_PROVIDERS.map((p) => {
                  const cfg = ai.settings.providers[p.id]
                  return (
                    <IntegrationCard
                      key={p.id}
                      provider={p}
                      connected={cfg.connected}
                      enabled={cfg.enabled}
                      model={cfg.model}
                      isActive={ai.settings.activeProvider === p.id}
                      busy={ai.saving}
                      onConnect={() => openConnectModal(p.id)}
                      onDisconnect={() => void ai.disconnectProvider(p.id)}
                      onToggle={(on) => {
                        if (!cfg.connected || ai.saving) return
                        void ai.setProviderEnabled(p.id, on)
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function IntegrationCard({
  provider,
  connected,
  enabled,
  model,
  isActive,
  busy,
  onConnect,
  onDisconnect,
  onToggle,
}: {
  provider: ProviderCatalogItem
  connected: boolean
  enabled: boolean
  model: string
  isActive: boolean
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  onToggle: (on: boolean) => void
}) {
  const t = useT()
  const live = connected && enabled
  const modelLabel = model.trim() || provider.modelPlaceholder

  return (
    <article
      className={[
        'stIntegrationCard',
        connected ? 'is-connected' : '',
        live ? 'is-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
    >
      <div className="stIntegrationCardTop">
        <span className={`stIntegrationLogo brand-${provider.id}`} aria-hidden>
          <img src={provider.logo} alt="" width={22} height={22} draggable={false} />
        </span>
        <span className="stIntegrationName">{provider.name}</span>
        {connected ? (
          <span className="stIntegrationStatus">
            {live && isActive ? t('settings.ai.status.active') : t('settings.ai.status.connected')}
          </span>
        ) : null}
      </div>

      <p className="stIntegrationDesc" title={connected ? `${t(provider.blurbKey)} · ${modelLabel}` : t(provider.blurbKey)}>
        <span className="stIntegrationBlurb">{t(provider.blurbKey)}</span>
        {connected ? (
          <>
            {' '}
            <span className="stIntegrationMeta">· {modelLabel}</span>
          </>
        ) : null}
      </p>

      <div className="stIntegrationFooter">
        {connected ? (
          <>
            <div className="stIntegrationActions">
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

            <label
              className="stIntegrationToggle"
              title={connected ? undefined : t('settings.ai.connectFirst')}
            >
              <span className="stIntegrationToggleLabel">{t('settings.ai.inChat')}</span>
              <span className="settingsSwitch is-sm">
                <input
                  type="checkbox"
                  checked={live}
                  disabled={!connected || busy}
                  onChange={(e) => onToggle(e.target.checked)}
                  aria-label={t('settings.ai.useInChat', { name: provider.name })}
                />
                <span className="settingsSwitchUi" aria-hidden />
              </span>
            </label>
          </>
        ) : (
          <Button variant="primary" size="sm" onClick={onConnect} disabled={busy}>
            {t('common.connect')}
          </Button>
        )}
      </div>
    </article>
  )
}
