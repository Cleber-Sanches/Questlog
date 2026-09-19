import type { MessageKey } from '@/i18n'

export type SettingsSectionId = 'backup' | 'ai' | 'steam' | 'language' | 'update' | 'help'

export type SettingsNavItem = {
  id: SettingsSectionId
  labelKey: MessageKey
  descriptionKey: MessageKey
  groupKey: MessageKey
  icon: string
}

/** Lista plana — a sidebar renderiza grupos a partir do campo `groupKey`. */
export const SETTINGS_ITEMS: SettingsNavItem[] = [
  {
    id: 'backup',
    labelKey: 'settings.nav.backup',
    descriptionKey: 'settings.nav.backup.desc',
    groupKey: 'settings.group.data',
    icon: 'ph-duotone ph-hard-drives',
  },
  {
    id: 'ai',
    labelKey: 'settings.nav.ai',
    descriptionKey: 'settings.nav.ai.desc',
    groupKey: 'settings.group.tools',
    icon: 'ph-duotone ph-robot',
  },
  {
    id: 'steam',
    labelKey: 'settings.nav.steam',
    descriptionKey: 'settings.nav.steam.desc',
    groupKey: 'settings.group.tools',
    icon: 'ph-duotone ph-game-controller',
  },
  {
    id: 'language',
    labelKey: 'settings.nav.language',
    descriptionKey: 'settings.nav.language.desc',
    groupKey: 'settings.group.interface',
    icon: 'ph-duotone ph-translate',
  },
  {
    id: 'update',
    labelKey: 'settings.nav.update',
    descriptionKey: 'settings.nav.update.desc',
    groupKey: 'settings.group.interface',
    icon: 'ph-duotone ph-arrows-clockwise',
  },
  {
    id: 'help',
    labelKey: 'settings.nav.help',
    descriptionKey: 'settings.nav.help.desc',
    groupKey: 'settings.group.interface',
    icon: 'ph-duotone ph-question',
  },
]

export function findSettingsSection(id: SettingsSectionId): SettingsNavItem | undefined {
  return SETTINGS_ITEMS.find((i) => i.id === id)
}

export function groupSettingsItems(items: SettingsNavItem[]) {
  const groups: { groupKey: MessageKey; items: SettingsNavItem[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.groupKey === item.groupKey) {
      last.items.push(item)
    } else {
      groups.push({ groupKey: item.groupKey, items: [item] })
    }
  }
  return groups
}
