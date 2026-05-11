import { Thing } from '@/types/domain'

export const OBSERVED_KEY_SEPARATOR = '||'

export type ObservedToggleItem = {
  key: string
  label?: string
  enabled: boolean
}

export function getThingKey(thing: Thing) {
  const sourceKey = String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')
  const thingId = String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
  return `${sourceKey}::${thingId}`
}

export function getThingSourceKey(thing: Thing) {
  return String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')
}

export function getThingSourceLabel(thing: Thing) {
  const sourceName = String(thing?.__sourceName ?? '').trim()
  const sourceId = String(thing?.__sourceId ?? '').trim()
  if (sourceName) return sourceName
  return sourceId
    ? `Data source ${sourceId}`
    : `Data source ${getThingSourceKey(thing)}`
}

export function buildObservedPropertyKey(
  sourceKey: string,
  observedPropertyName: string
) {
  return `${sourceKey}${OBSERVED_KEY_SEPARATOR}${observedPropertyName.trim()}`
}

export function parseObservedPropertyKey(key: string) {
  const separatorIndex = key.indexOf(OBSERVED_KEY_SEPARATOR)
  if (separatorIndex < 0) return { sourceKey: '0', observedPropertyName: key }

  return {
    sourceKey: key.slice(0, separatorIndex),
    observedPropertyName: key.slice(
      separatorIndex + OBSERVED_KEY_SEPARATOR.length
    ),
  }
}
