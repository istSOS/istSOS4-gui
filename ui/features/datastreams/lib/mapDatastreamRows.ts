import type { Datastream, Thing } from '@/types/domain'

import { getThingSourceLabel } from '../../map/lib/leafletMapHelpers'
import { getMapDatastreamKey } from '../../map/lib/mapCrossfilter'

export type MapDatastreamRow = Datastream & { __mapKey: string; __thing: Thing }

export function buildMapDatastreamRows(
  things: Thing[],
  matchingKeys: ReadonlySet<string>
): MapDatastreamRow[] {
  return things.flatMap((thing) => {
    return (thing.Datastreams ?? []).flatMap((ds, index) => {
      const key = getMapDatastreamKey(thing, ds, index)
      return matchingKeys.has(key)
        ? [
            {
              ...ds,
              __sourceId: thing.__sourceId ?? ds.__sourceId,
              __sourceEndpoint: thing.__sourceEndpoint ?? ds.__sourceEndpoint,
              __sourceName: getThingSourceLabel(thing),
              __mapKey: key,
              __thing: thing,
            },
          ]
        : []
    })
  })
}
