import type {
  AssociatedDraft,
  DatastreamFormData,
  EntityKey,
  ExistingEntitySelectKey,
  ExistingOption,
  FormDataMap,
  KeyValueItem,
  LocationFormData,
  ObservedPropertyFormData,
  SensorFormData,
  ThingFormData,
} from './types'
import { parseLonLatString } from './coordinates'
import { Datastream, EntityRef, LocationRef, ObservedPropertyRef, SensorRef, Thing } from '@/types/domain'

import { siteConfig } from '@/config/site'

export type ExistingEntities = {
  things: Thing[]
  locations: LocationRef[]
  sensors: SensorRef[]
  observedProperties: ObservedPropertyRef[]
  datastreams: Datastream[]
  networks: EntityRef[]
}

export type ExistingOptionsMap = Record<ExistingEntitySelectKey, ExistingOption[]>

function toPropertiesObject(items: KeyValueItem[]) {
  const entries = items
    .filter((item) => item.key.trim().length > 0)
    .map((item) => [item.key, item.value] as const)

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function toEntityReferenceId(id: string) {
  const trimmed = id.trim()
  if (!trimmed) return undefined

  const numericId = Number(trimmed)
  return Number.isFinite(numericId) ? numericId : trimmed
}

function toPointGeometry(value: string) {
  const parsed = parseLonLatString(value)
  if (!parsed) {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return value

    // Allow pasting a GeoJSON object as string in the coordinates field.
    if (trimmed.startsWith('{')) {
      try {
        const parsedJson = JSON.parse(trimmed)
        if (
          parsedJson &&
          typeof parsedJson === 'object' &&
          parsedJson.type === 'Point' &&
          Array.isArray(parsedJson.coordinates)
        ) {
          return parsedJson
        }
      } catch {
        return value
      }
    }

    return value
  }

  const { longitude, latitude } = parsed

  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  }
}

type EntityLike = {
  '@iot.id'?: string | number
  id?: string | number
  name?: string
}

function getEntityId(item: EntityLike | null | undefined) {
  return String(item?.['@iot.id'] ?? item?.id ?? '')
}

function getEntityName(item: EntityLike | null | undefined, fallback: string) {
  return String(item?.name ?? fallback)
}

function getLocationDescription(
  location: LocationRef | null | undefined,
  thing: Thing | null | undefined
) {
  if (
    typeof location?.description === 'string' &&
    location.description.trim()
  ) {
    return location.description
  }

  const rawLocation = location?.location

  if (typeof rawLocation === 'string') {
    return rawLocation
  }

  if (rawLocation && typeof rawLocation === 'object') {
    if (Array.isArray(rawLocation?.coordinates)) {
      return rawLocation.coordinates.join(', ')
    }

    const raw = rawLocation as { latitude?: unknown; longitude?: unknown }
    if (
      typeof raw.latitude === 'number' &&
      typeof raw.longitude === 'number'
    ) {
      return `${raw.latitude}, ${raw.longitude}`
    }
  }

  return String(thing?.name ?? thing?.description ?? '')
}

function uniqueOptions(options: ExistingOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

export function buildExistingOptions(
  entities: ExistingEntities
): ExistingOptionsMap {
  const { things, locations, sensors, observedProperties, datastreams, networks } =
    entities

  const thingOptions = uniqueOptions(
    things.map((thing, index) => ({
      value: getEntityId(thing),
      label: getEntityName(thing, `Thing ${index + 1}`),
      description: String(thing?.description ?? ''),
    }))
  )

  const locationOptions = uniqueOptions(
    locations.map((location, index: number) => ({
      value: getEntityId(location),
      label: getEntityName(location, `Location ${index + 1}`),
      description: getLocationDescription(location, null),
    }))
  )

  const sensorOptions = uniqueOptions(
    sensors.map((sensor, index: number) => ({
      value: getEntityId(sensor),
      label: getEntityName(sensor, `Sensor ${index + 1}`),
      description: String(sensor?.description ?? ''),
    }))
  )

  const observedPropertyOptions = uniqueOptions(
    observedProperties.map((observedProperty, index: number) => ({
      value: getEntityId(observedProperty),
      label: getEntityName(observedProperty, `Observed Property ${index + 1}`),
      description: String(
        observedProperty?.definition ?? observedProperty?.description ?? ''
      ),
    }))
  )

  const datastreamOptions = uniqueOptions(
    datastreams.map((datastream, index: number) => ({
      value: getEntityId(datastream),
      label: getEntityName(datastream, `Datastream ${index + 1}`),
      description: String(
        datastream?.ObservedProperty?.name ??
          datastream?.Sensor?.name ??
          datastream?.Thing?.name ??
          datastream?.description ??
          datastream?.unitOfMeasurement?.symbol ??
          ''
      ),
    }))
  )

  const networkOptions = uniqueOptions(
    networks.map((network, index: number) => ({
      value: getEntityId(network),
      label: getEntityName(network, `Network ${index + 1}`),
      description: String(network?.description ?? ''),
    }))
  )

  return {
    thing: thingOptions,
    location: locationOptions,
    sensor: sensorOptions,
    observedProperty: observedPropertyOptions,
    datastream: datastreamOptions,
    network: networkOptions,
  }
}

export function normalizeEntityPayload(
  entity: EntityKey,
  formData: FormDataMap[EntityKey]
) {
  switch (entity) {
    case 'thing': {
      const current = formData as ThingFormData
      const properties = toPropertiesObject(current.properties)
      const locationId = toEntityReferenceId(current.locationId)
      return {
        name: current.name,
        description: current.description,
        ...(locationId ? { Locations: [{ '@iot.id': locationId }] } : {}),
        properties,
      }
    }
    case 'location': {
      const current = formData as LocationFormData
      const properties = toPropertiesObject(current.properties)
      const encodingType = current.encodingType.trim() || 'application/vnd.geo+json'
      return {
        name: current.name,
        description: current.description,
        encodingType,
        location: toPointGeometry(current.location),
        properties,
      }
    }
    case 'sensor': {
      const current = formData as SensorFormData
      const properties = toPropertiesObject(current.properties)
      return {
        name: current.name,
        description: current.description,
        encodingType: current.encodingType,
        metadata: current.metadata,
        properties,
      }
    }
    case 'observedProperty': {
      const current = formData as ObservedPropertyFormData
      const properties = toPropertiesObject(current.properties)
      return {
        name: current.name,
        definition: current.definition,
        description: current.description,
        properties,
      }
    }
    case 'datastream': {
      const current = formData as DatastreamFormData
      const properties = toPropertiesObject(current.properties)
      const unitOfMeasurement = toPropertiesObject(current.unitOfMeasurement)
      const thingId = toEntityReferenceId(current.thingId)
      const sensorId = toEntityReferenceId(current.sensorId)
      const observedPropertyId = toEntityReferenceId(current.observedPropertyId)
      const networkId = toEntityReferenceId(current.networkId)
      return {
        name: current.name,
        description: current.description,
        ...(thingId ? { Thing: { '@iot.id': thingId } } : {}),
        ...(sensorId ? { Sensor: { '@iot.id': sensorId } } : {}),
        ...(observedPropertyId
          ? { ObservedProperty: { '@iot.id': observedPropertyId } }
          : {}),
        ...(siteConfig.networkEnabled && networkId
          ? { Network: { '@iot.id': networkId } }
          : {}),
        unitOfMeasurement,
        observationType: current.observationType,
        properties,
      }
    }
  }
}

export function buildAssociatedDraftPayload(draft: AssociatedDraft) {
  const refOrPayload = (entity: EntityKey) => {
    const current = draft[entity]
    if (current.source === 'existing') {
      return current.existingId ? { '@iot.id': current.existingId } : undefined
    }
    return normalizeEntityPayload(entity, current.formData)
  }

  const thing = refOrPayload('thing')
  const location = refOrPayload('location')
  const sensor = refOrPayload('sensor')
  const observedProperty = refOrPayload('observedProperty')
  const datastream = refOrPayload('datastream')

  return {
    thing,
    location,
    sensor,
    observedProperty,
    datastream,
    nestedThingPayload:
      draft.thing.source === 'new'
        ? {
            ...normalizeEntityPayload('thing', draft.thing.formData),
            ...(location ? { Locations: [location] } : {}),
            ...(datastream
              ? {
                  Datastreams: [
                    {
                      ...normalizeEntityPayload(
                        'datastream',
                        draft.datastream.formData
                      ),
                      ...(sensor ? { Sensor: sensor } : {}),
                      ...(observedProperty
                        ? { ObservedProperty: observedProperty }
                        : {}),
                    },
                  ],
                }
              : {}),
          }
        : null,
  }
}
