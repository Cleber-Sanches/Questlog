export const GUIDE_CHAT_OPEN_EVENT = 'questlog:open-guide-chat'

export function openGuideChat() {
  window.dispatchEvent(new Event(GUIDE_CHAT_OPEN_EVENT))
}
