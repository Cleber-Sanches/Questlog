import { useEffect, useState } from 'react'
import { Modal } from '@/components/overlay/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useModal } from '@/app/providers/ModalProvider'
import { useT } from '@/app/providers/LocaleProvider'
import { findProvider } from '@/features/ai/providers'
import type { AiDetectResult, AiProvider, AiProviderConfig } from '@/types/ai'

type AiConnectModalProps = {
  provider: AiProvider
  initial: AiProviderConfig
  onDetect: (cliPath: string) => Promise<AiDetectResult | null>
  onTestAuth: (cliPath: string) => Promise<{ ok: boolean } | null>
  onCliLogin: (cliPath: string) => Promise<unknown>
  onSave: (config: AiProviderConfig) => Promise<void>
}

export function AiConnectModal({
  provider,
  initial,
  onDetect,
  onTestAuth,
  onCliLogin,
  onSave,
}: AiConnectModalProps) {
  const t = useT()
  const { closeModal } = useModal()
  const meta = findProvider(provider)
  const [cliPath, setCliPath] = useState(initial.cliPath)
  const [detect, setDetect] = useState<AiDetectResult | null>(null)
  const [authOk, setAuthOk] = useState(initial.connected)
  const [detecting, setDetecting] = useState(false)
  const [testingAuth, setTestingAuth] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCliPath(initial.cliPath)
    setAuthOk(initial.connected)
    setDetect(null)
  }, [initial.cliPath, initial.connected, provider])

  if (!meta) return null

  const busy = detecting || testingAuth || loggingIn || saving

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const res = await onDetect(cliPath)
      setDetect(res)
      if (res?.found && res.path) setCliPath(res.path)
      if (meta.auth === 'terminal' && res?.found) setAuthOk(true)
    } finally {
      setDetecting(false)
    }
  }

  const handleVerify = async () => {
    setTestingAuth(true)
    try {
      const res = await onTestAuth(cliPath)
      if (res) setAuthOk(res.ok)
    } finally {
      setTestingAuth(false)
    }
  }

  const handleConnect = async () => {
    setLoggingIn(true)
    try {
      await onCliLogin(cliPath)
    } finally {
      setLoggingIn(false)
    }
  }

  const canSave =
    cliPath.trim().length > 0 &&
    (meta.auth === 'terminal' ? Boolean(detect?.found || authOk) : authOk)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        cliPath: cliPath.trim(),
        model: initial.model.trim() || meta.modelPlaceholder,
        connected: true,
        enabled: true,
      })
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('settings.ai.connect.title', { name: meta.name })} wide>
      <p className="stModalIntro">{t(meta.blurbKey)}</p>

      <div className="stFieldStack">
        <div className="stFieldRow">
          <label className="stFieldRowLabel" htmlFor={`ai-modal-cli-${provider}`}>
            CLI
          </label>
          <div className="stPathRow">
            <Input
              id={`ai-modal-cli-${provider}`}
              value={cliPath}
              onChange={(e) => setCliPath(e.target.value)}
              placeholder={meta.cliPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="stPathActions">
              <Button variant="secondary" size="sm" onClick={() => void handleDetect()} disabled={busy}>
                {detecting ? '…' : t('settings.ai.detect')}
              </Button>
            </div>
          </div>
          {detect ? (
            <p className={`stNote${detect.found ? ' is-ok' : ' is-err'}`} role="status">
              {detect.found
                ? `${detect.path}${detect.version ? ` · ${detect.version}` : ''}`
                : detect.error}
            </p>
          ) : null}
        </div>

        {meta.auth === 'browser' ? (
          <div className="stFieldRow">
            <div className="stPathActions">
              <Button variant="secondary" size="sm" onClick={() => void handleConnect()} disabled={busy}>
                {loggingIn ? '…' : t('settings.ai.openLogin')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void handleVerify()} disabled={busy}>
                {testingAuth ? '…' : t('settings.ai.verify')}
              </Button>
            </div>
            <p className={`stNote${authOk ? ' is-ok' : ''}`} role="status">
              {authOk ? t('settings.ai.auth.ok') : t('settings.ai.auth.hint')}
            </p>
          </div>
        ) : (
          <p className="stNote" role="status">
            {t(meta.authHelpKey ?? 'settings.ai.auth.opencode')}
          </p>
        )}

        <p className="stNote">{t('settings.ai.modelHint')}</p>
      </div>

      <div className="modal-actions">
        <Button onClick={closeModal} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} disabled={busy || !canSave}>
          {saving ? t('common.saving') : t('settings.ai.saveConnection')}
        </Button>
      </div>
    </Modal>
  )
}
