import { siteConfig } from '@/config/site'
import { Datastream, LocationRef, Thing } from '@/types/domain'

type SourceScoped = {
  __sourceEndpoint?: string
  '@iot.id'?: string | number
  id?: string | number
}

type NetworkRef = {
  '@iot.id'?: string | number
  id?: string | number
  name?: string
  __sourceEndpoint?: string
}

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
export const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
export const mapThingsApiPath = `${normalizedBasePath}/api/data-sources/things`

export const normalizeEndpoint = (value: string) =>
  value.trim().replace(/\/+$/, '')

export const getThingKey = (thing: Thing) => {
  const sourceId = String(
    thing?.__sourceId ?? thing?.__sourceEndpoint ?? siteConfig.api_root
  )
  const thingId = String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
  return `${sourceId}::${thingId}`
}

export const toKeyValueItems = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
    .filter(([key]) => String(key).trim().length > 0)
    .map(([key, entryValue]) => ({
      key: String(key),
      value: String(entryValue ?? ''),
    }))
}

export const toEntityId = (value: SourceScoped | null | undefined) =>
  String(value?.['@iot.id'] ?? value?.id ?? '').trim()

export const toLocationValue = (value: LocationRef['location']) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  const coordinates = Array.isArray(value?.coordinates) ? value.coordinates : null
  if (
    coordinates &&
    coordinates.length >= 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  ) {
    return `${Number(coordinates[0]).toFixed(2)}, ${Number(
      coordinates[1]
    ).toFixed(2)}`
  }

  return ''
}

export function buildLocationsForForm({
  locations,
  localThings,
  primaryEndpoint,
}: {
  locations: LocationRef[]
  localThings: Thing[]
  primaryEndpoint: string
}) {
  const byKey = new Map<string, LocationRef & { __sourceEndpoint: string }>()

  const addLocation = (location: LocationRef, sourceEndpoint: string) => {
    const locationId = String(location?.['@iot.id'] ?? location?.id ?? '').trim()
    if (!locationId) return

    const normalizedSourceEndpoint =
      normalizeEndpoint(sourceEndpoint || primaryEndpoint) || primaryEndpoint
    const dedupKey = `${normalizedSourceEndpoint}::${locationId}`
    if (byKey.has(dedupKey)) return

    byKey.set(dedupKey, {
      ...location,
      __sourceEndpoint: normalizedSourceEndpoint,
    })
  }

  for (const location of locations) {
    addLocation(location, String(location?.__sourceEndpoint ?? primaryEndpoint))
  }

  for (const thing of localThings) {
    const sourceEndpoint = String(thing?.__sourceEndpoint ?? primaryEndpoint)
    const thingLocations = Array.isArray(thing?.Locations) ? thing.Locations : []
    for (const location of thingLocations) {
      addLocation(location, sourceEndpoint)
    }
  }

  return Array.from(byKey.values())
}

export function buildNetworksForForm({
  localNetworks,
  localThings,
  primaryEndpoint,
}: {
  localNetworks: NetworkRef[]
  localThings: Thing[]
  primaryEndpoint: string
}) {
  const byKey = new Map<string, NetworkRef & { __sourceEndpoint: string }>()

  const addNetwork = (network: NetworkRef, sourceEndpoint: string) => {
    const networkId = String(network?.['@iot.id'] ?? network?.id ?? '').trim()
    if (!networkId) return

    const normalizedSourceEndpoint =
      normalizeEndpoint(sourceEndpoint || primaryEndpoint) || primaryEndpoint
    const dedupKey = `${normalizedSourceEndpoint}::${networkId}`
    if (byKey.has(dedupKey)) return

    byKey.set(dedupKey, {
      ...network,
      __sourceEndpoint: normalizedSourceEndpoint,
    })
  }

  for (const network of localNetworks) {
    addNetwork(network, String(network?.__sourceEndpoint ?? primaryEndpoint))
  }

  for (const thing of localThings) {
    const sourceEndpoint = String(thing?.__sourceEndpoint ?? primaryEndpoint)
    const thingDatastreams = Array.isArray(thing?.Datastreams)
      ? thing.Datastreams
      : []
    for (const datastream of thingDatastreams) {
      if (!datastream?.Network) continue
      addNetwork(
        datastream.Network as Datastream['Network'] & NetworkRef,
        String(datastream?.__sourceEndpoint ?? sourceEndpoint)
      )
    }
  }

  return Array.from(byKey.values())
}
