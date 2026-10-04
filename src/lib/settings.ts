export const TRAY_SETTING_KEY = 'minimize_to_tray'

export function settingEnabled(
  settings: Record<string, string>,
  key: string,
  fallback = true,
) {
  const value = settings[key]
  if (value == null || value.trim() === '') return fallback
  return value === '1' || value.toLowerCase() === 'true'
}
