const STORAGE_KEY = 'istsos.plot.showOnHover'
const listeners = new Set<() => void>()
let snapshot: boolean | undefined

function readStorage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  snapshot = readStorage()
  listeners.forEach((notify) => notify())
}

export const plotTooltipPreference = {
  getSnapshot: () => (snapshot ??= readStorage()),
  getServerSnapshot: () => true,
  subscribe(notify: () => void) {
    if (!listeners.size) window.addEventListener('storage', onStorage)
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
      if (!listeners.size) window.removeEventListener('storage', onStorage)
    }
  },
  set(enabled: boolean) {
    snapshot = enabled
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // Keep the preference for this session when storage is unavailable.
    }
    listeners.forEach((notify) => notify())
  },
}
