import type { Thing } from '@/types/domain'

import {
  buildObservedPropertyKey,
  getThingKey,
  getThingSourceKey,
} from './leafletMapHelpers'
import { type MapFacet, getMapDatastreamKey } from './mapCrossfilter'

export type MapEntityFocus = {
  facet: MapFacet
  key: string
}

/** Resolve a focus within the currently visible data without changing filters. */
export function resolveMapSelection(
  things: Thing[],
  focus: MapEntityFocus | null,
  visible: {
    matchingThingKeys: ReadonlySet<string>
    matchingDatastreamKeys: ReadonlySet<string>
  }
) {
  const thingKeys = new Set<string>()
  const datastreamKeys = new Set<string>()
  if (!focus) return { thingKeys, datastreamKeys }

  for (const thing of things) {
    const thingKey = getThingKey(thing)
    if (!visible.matchingThingKeys.has(thingKey)) continue
    const isThing = focus.facet === 'things' && focus.key === thingKey
    if (isThing) thingKeys.add(thingKey)
    for (const [index, ds] of (thing.Datastreams ?? []).entries()) {
      const dsKey = getMapDatastreamKey(thing, ds, index)
      if (!visible.matchingDatastreamKeys.has(dsKey)) continue
      const property = ds.ObservedProperty?.name?.trim()
      const matches =
        isThing ||
        (focus.facet === 'datastreams' && focus.key === dsKey) ||
        (focus.facet === 'properties' &&
          property &&
          focus.key ===
            buildObservedPropertyKey(getThingSourceKey(thing), property))
      if (matches) {
        thingKeys.add(thingKey)
        datastreamKeys.add(dsKey)
      }
    }
  }
  return { thingKeys, datastreamKeys }
}
