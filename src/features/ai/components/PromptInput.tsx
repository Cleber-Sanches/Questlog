import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react'
import { useT } from '@/app/providers/LocaleProvider'
import { Button } from '@/components/ui/Button'
import { PromptPicker } from '@/features/ai/components/PromptPicker'
import { useProviderModels } from '@/features/ai/hooks/useProviderModels'
import { normalizeProviderModel } from '@/features/ai/providers'
import { SPRING_SWAP } from '@/lib/motion/ease'
import type { AiProvider } from '@/types/ai'

export type PromptProviderOption = {
  id: AiProvider
  name: string
  logo: string
  modelPlaceholder: string
}

export type PromptInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  loading?: boolean
  onStop?: () => void
  disabled?: boolean
  placeholder?: string
  providers?: PromptProviderOption[]
  provider?: AiProvider | null
  onProviderChange?: (provider: AiProvider) => void
  model?: string
  onModelChange?: (model: string) => void
  onModelBlur?: () => void
  overlay?: ReactNode
  minRows?: number
  maxRows?: number
  className?: string
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onClick?: TextareaHTMLAttributes<HTMLTextAreaElement>['onClick']
  onKeyUp?: TextareaHTMLAttributes<HTMLTextAreaElement>['onKeyUp']
  onSelect?: TextareaHTMLAttributes<HTMLTextAreaElement>['onSelect']
}

export const PromptInput = forwardRef(function PromptInput(
  {
    value,
    onValueChange,
    onSubmit,
    loading = false,
    onStop,
    disabled,
    placeholder,
    providers = [],
    provider,
    onProviderChange,
    model = '',
    onModelChange,
    onModelBlur,
    overlay,
    minRows = 2,
    maxRows = 6,
    className,
    onKeyDown,
    onClick,
    onKeyUp,
    onSelect,
  }: PromptInputProps,
  ref: Ref<HTMLTextAreaElement>,
) {
  const t = useT()
  const reduce = useReducedMotion() ?? false
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const canSubmit = Boolean(value.trim()) && !disabled && !loading
  const activeProvider = providers.find((p) => p.id === provider)
  const showProviderPicker = providers.length > 1
  const resolvedPlaceholder = placeholder ?? t('chat.input.placeholder')
  const { models: remoteModels, loading: modelsLoading, refresh: refreshModels } = useProviderModels(
    provider ?? null,
    Boolean(provider) && !disabled,
  )

  const modelCatalog = useMemo(
    () =>
      remoteModels.map((item) => ({
        value: item.id,
        label: item.name,
        provider: item.provider,
      })),
    [remoteModels],
  )

  const modelValue = normalizeProviderModel(provider, model, modelCatalog)
  const modelOptions = useMemo(() => {
    const known = modelCatalog.some((item) => item.value === modelValue)
    if (known || !modelValue) return modelCatalog
    // Modelos Anthropic salvos no OpenCode são redundantes — não listar.
    if (provider === 'opencode' && /anthropic|claude/i.test(modelValue)) {
      return modelCatalog
    }
    return [...modelCatalog, { value: modelValue, label: modelValue, provider: '' }]
  }, [modelCatalog, modelValue, provider])

  useEffect(() => {
    if (!provider || modelsLoading || !modelCatalog.length || !onModelChange) return
    const known = modelCatalog.some((item) => item.value === model.trim())
    if (known) return
    if (provider === 'opencode' || !model.trim()) {
      onModelChange(modelCatalog[0].value)
    }
  }, [model, modelCatalog, modelsLoading, onModelChange, provider])

  const providerOptions = useMemo(
    () =>
      providers.map((item) => ({
        value: item.id,
        label: item.name,
        logo: item.logo,
      })),
    [providers],
  )

  const mergeRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    const measurement = measurementRef.current
    if (!textarea || !measurement || textarea.value !== value) return

    const lineHeight = 24
    const nextHeight = Math.min(
      Math.max(measurement.scrollHeight, minRows * lineHeight),
      maxRows * lineHeight,
    )
    const height = `${nextHeight}px`
    if (textarea.style.height !== height) textarea.style.height = height
  }, [maxRows, minRows, value])

  useLayoutEffect(() => {
    resizeTextarea()
  }, [resizeTextarea])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resizeTextarea)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [resizeTextarea])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!canSubmit) return
    onSubmit()
    textareaRef.current?.focus({ preventScroll: true })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    submit()
  }

  return (
    <form
      className={`aiPromptInput${className ? ` ${className}` : ''}`}
      onSubmit={submit}
    >
      {overlay ? <div className="aiPromptOverlay">{overlay}</div> : null}

      <div ref={measurementRef} aria-hidden="true" className="aiPromptMeasure">
        {`${value}\u200b`}
      </div>

      <textarea
        ref={mergeRef}
        value={value}
        disabled={disabled}
        placeholder={resolvedPlaceholder}
        aria-label={t('chat.input.placeholder')}
        rows={minRows}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onClick={onClick}
        onKeyUp={onKeyUp}
        onSelect={onSelect}
        className="aiPromptTextarea"
      />

      <div className="aiPromptToolbar">
        <div className="aiPromptPickers">
          {showProviderPicker ? (
            <PromptPicker
              className="aiPromptPickerProvider"
              value={provider ?? ''}
              options={providerOptions}
              disabled={disabled || loading}
              ariaLabel={t('chat.picker.provider')}
              logo={activeProvider?.logo}
              onChange={(next) => onProviderChange?.(next as AiProvider)}
            />
          ) : null}

          {provider ? (
            <PromptPicker
              className={`aiPromptPickerModel${provider === 'opencode' ? ' is-wide' : ''}`}
              value={modelValue}
              options={modelOptions.map((item) => ({
                value: item.value,
                label: item.label,
                group: item.provider,
              }))}
              grouped={provider === 'opencode'}
              disabled={disabled || loading}
              loading={modelsLoading}
              ariaLabel={t('chat.picker.model')}
              logo={!showProviderPicker ? activeProvider?.logo : undefined}
              placeholder={activeProvider?.modelPlaceholder ?? t('chat.picker.model')}
              onChange={(next) => onModelChange?.(next)}
              onOpen={() => void refreshModels()}
              onClose={() => onModelBlur?.()}
            />
          ) : null}
        </div>

        <Button
          type={loading ? 'button' : 'submit'}
          variant="primary"
          size="icon"
          className="aiPromptSend"
          disabled={loading ? !onStop : !canSubmit}
          aria-label={loading ? t('chat.stop') : t('chat.send')}
          onClick={loading ? onStop : undefined}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={loading ? 'stop' : 'send'}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 3, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.8 }}
              transition={reduce ? { duration: 0 } : SPRING_SWAP}
              className="aiPromptSendIcon"
            >
              {loading ? (
                <i className="ph-fill ph-stop" aria-hidden />
              ) : (
                <i className="ph-bold ph-arrow-up" aria-hidden />
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </form>
  )
})
