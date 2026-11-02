import type { Datastream, Thing } from '@/types/domain'

/** Datastream IDs are local to a source; comparisons may span sources. */
export function datastreamKey(
  datastream: Datastream | null | undefined
): string {
  const id = String(datastream?.['@iot.id'] ?? datastream?.id ?? '').trim()
  const endpoint = datastream?.__sourceEndpoint?.trim().replace(/\/+$/, '')
  return endpoint ? JSON.stringify([endpoint, id]) : id
}

export type DatastreamChoice = {
  key: string
  label: string
  datastream: Datastream
  thing: Thing | null
}

export function datastreamChoice(
  datastream: Datastream,
  thing: Thing | null,
  primaryEndpoint: string
): DatastreamChoice {
  const endpoint = (
    datastream.__sourceEndpoint ??
    thing?.__sourceEndpoint ??
    primaryEndpoint
  ).replace(/\/+$/, '')
  const scoped = { ...datastream, __sourceEndpoint: endpoint }
  const name = String(
    datastream.name ?? datastream['@iot.id'] ?? datastream.id ?? ''
  )
  const label = [
    thing?.__sourceName ?? datastream.__sourceName,
    thing?.name,
    name,
    datastream.ObservedProperty?.name,
    datastream.unitOfMeasurement?.symbol,
  ]
    .filter(Boolean)
    .join(' · ')
  return { key: datastreamKey(scoped), label, datastream: scoped, thing }
}

export function datastreamChoices(
  things: Thing[],
  primaryEndpoint: string
): DatastreamChoice[] {
  const choices = new Map<string, DatastreamChoice>()
  for (const thing of things)
    for (const datastream of thing.Datastreams ?? []) {
      if (datastream['@iot.id'] == null && datastream.id == null) continue
      const choice = datastreamChoice(datastream, thing, primaryEndpoint)
      choices.set(choice.key, choice)
    }
  return [...choices.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/** A grey stream fills B or replaces it; A stays until explicitly hidden. */
export function toggleDatastream(
  active: string[],
  key: string,
  snapshots = false
): string[] {
  if (snapshots) return [key]
  if (active.includes(key))
    return active.length > 1 ? active.filter((id) => id !== key) : active
  return active.length ? [active[0], key] : [key]
}
export function searchDatastreams(
  choices: DatastreamChoice[],
  query: string
): DatastreamChoice[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return choices.filter((choice) => {
    const haystack = [
      choice.label,
      choice.thing?.name,
      choice.thing?.__sourceName,
      choice.datastream.name,
      choice.datastream.ObservedProperty?.name,
      choice.datastream.__sourceName,
      choice.datastream.__sourceEndpoint,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
