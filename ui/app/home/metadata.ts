import { normalizeEndpoint } from './utils'
import { Datastream, EntityRef, Thing } from '@/types/domain'

type SourceMeta = {
  __sourceId?: string
  __sourceName?: string
  __sourceEndpoint?: string
}

export function enrichThingsWithSourceMetadata({
  items,
  primaryEndpoint,
  primarySourceName,
}: {
  items: Thing[]
  primaryEndpoint: string
  primarySourceName: string
}) {
  return items.map((thing) => {
    const sourceEndpoint = normalizeEndpoint(
      String(thing?.__sourceEndpoint ?? primaryEndpoint)
    )
    const datastreams = Array.isArray(thing?.Datastreams)
      ? thing.Datastreams.map((datastream: Datastream & SourceMeta) => ({
          ...datastream,
          __sourceId: String(
            datastream?.__sourceId ?? thing?.__sourceId ?? sourceEndpoint
          ),
          __sourceName: String(
            datastream?.__sourceName ?? thing?.__sourceName ?? primarySourceName
          ),
          __sourceEndpoint: normalizeEndpoint(
            String(datastream?.__sourceEndpoint ?? sourceEndpoint)
          ),
        }))
      : thing?.Datastreams

    return {
      ...thing,
      __sourceId: String(thing?.__sourceId ?? sourceEndpoint),
      __sourceName: String(thing?.__sourceName ?? primarySourceName),
      __sourceEndpoint: sourceEndpoint,
      Datastreams: datastreams,
    }
  })
}

export function enrichEntitiesWithSourceMetadata({
  items,
  primaryEndpoint,
  primarySourceName,
}: {
  items: Array<EntityRef & SourceMeta>
  primaryEndpoint: string
  primarySourceName: string
}) {
  return items.map((entity) => {
    const sourceEndpoint = normalizeEndpoint(
      String(entity?.__sourceEndpoint ?? primaryEndpoint)
    )

    return {
      ...entity,
      __sourceId: String(entity?.__sourceId ?? sourceEndpoint),
      __sourceName: String(entity?.__sourceName ?? primarySourceName),
      __sourceEndpoint: sourceEndpoint,
    }
  })
}
