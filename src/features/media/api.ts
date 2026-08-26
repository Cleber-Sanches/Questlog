import { invoke } from '@/lib/invoke'

export type SavedMedia = {
  key: string
  path: string
  token: string
}

export const mediaApi = {
  getRoot: () => invoke<string>('media_get_root'),
  saveBase64: (appId: string, data: string, mime?: string) =>
    invoke<SavedMedia>('media_save_base64', { appId, data, mime }),
  saveFromUrl: (appId: string, url: string) =>
    invoke<SavedMedia>('media_save_from_url', { appId, url }),
  resolvePath: (key: string) => invoke<string>('media_resolve_path', { key }),
}
