'use client'

import { useSyncExternalStore } from 'react'

import {
  EMPTY_APPEARANCES,
  SERIES_APPEARANCE_KEY,
  type SeriesAppearance,
  type SeriesAppearances,
  readAppearances,
  validAppearance,
} from './seriesAppearance'

let snapshot: SeriesAppearances | undefined
const listeners = new Set<() => void>()
function readStorage() {
  try {
    return readAppearances(window.localStorage.getItem(SERIES_APPEARANCE_KEY))
  } catch {
    return {}
  }
}
function getSnapshot() {
  return (snapshot ??= readStorage())
}
function getServerSnapshot() {
  return EMPTY_APPEARANCES
}
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== SERIES_APPEARANCE_KEY) return
  snapshot = readStorage()
  listeners.forEach((notify) => notify())
}
function subscribe(notify: () => void) {
  if (!listeners.size) window.addEventListener('storage', onStorage)
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
    if (!listeners.size) window.removeEventListener('storage', onStorage)
  }
}
export function useSeriesAppearances() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
export function saveSeriesAppearance(
  key: string,
  style: SeriesAppearance | null
) {
  const next = { ...getSnapshot() }
  if (style === null) delete next[key]
  else next[key] = validAppearance(style)
  snapshot = next
  try {
    window.localStorage.setItem(SERIES_APPEARANCE_KEY, JSON.stringify(next))
  } catch {
    /* Keep this session's appearance if browser storage is unavailable. */
  }
  listeners.forEach((notify) => notify())
}
