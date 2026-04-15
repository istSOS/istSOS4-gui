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
import { parseLv95String } from './coordinates'

import { siteConfig } from '@/config/site'

export type ExistingEntities = {
  things: any[]
  locations: any[]
  sensors: any[]
  observedProperties: any[]
  datastreams: any[]
  networks: any[]
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
  const parsed = parseLv95String(value)
  if (!parsed) {
    return value
  }

  const { east, north } = parsed

  return {
    type: 'Point',
    coordinates: [east, north],
  }
}

function getEntityId(item: any) {
  return String(item?.['@iot.id'] ?? item?.id ?? '')
}

function getEntityName(item: any, fallback: string) {
  return String(item?.name ?? fallback)
}

function getLocationDescription(location: any, thing: any) {
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

    if (
      typeof rawLocation?.latitude === 'number' &&
      typeof rawLocation?.longitude === 'number'
    ) {
      return `${rawLocation.latitude}, ${rawLocation.longitude}`
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
    locations.map((location: any, index: number) => ({
      value: getEntityId(location),
      label: getEntityName(location, `Location ${index + 1}`),
      description: getLocationDescription(location, null),
    }))
  )

  const sensorOptions = uniqueOptions(
    sensors.map((sensor: any, index: number) => ({
      value: getEntityId(sensor),
      label: getEntityName(sensor, `Sensor ${index + 1}`),
      description: String(sensor?.description ?? ''),
    }))
  )

  const observedPropertyOptions = uniqueOptions(
    observedProperties.map((observedProperty: any, index: number) => ({
      value: getEntityId(observedProperty),
      label: getEntityName(observedProperty, `Observed Property ${index + 1}`),
      description: String(
        observedProperty?.definition ?? observedProperty?.description ?? ''
      ),
    }))
  )

  const datastreamOptions = uniqueOptions(
    datastreams.map((datastream: any, index: number) => ({
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
    networks.map((network: any, index: number) => ({
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
      return {
        name: current.name,
        description: current.description,
        encodingType: current.encodingType,
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
function fromPropertiesObject(obj?: Record<string, any>): KeyValueItem[] {
  if (!obj) return []
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

export function toThingFormData(thing: any): ThingFormData {
  return {
    name: thing?.name ?? '',
    description: thing?.description ?? '',
    locationId: getEntityId(thing?.Locations?.[0]),
    properties: fromPropertiesObject(thing?.properties),
  }
}

export function toLocationFormData(location: any): LocationFormData {
  const loc = location?.location
  let locStr = ''
  if (typeof loc === 'string') {
    locStr = loc
  } else if (loc?.type === 'Point' && Array.isArray(loc?.coordinates)) {
    locStr = `${loc.coordinates[0]}, ${loc.coordinates[1]}`
  }

  return {
    name: location?.name ?? '',
    description: location?.description ?? '',
    encodingType: location?.encodingType ?? '',
    location: locStr,
    properties: fromPropertiesObject(location?.properties),
  }
}

export function toSensorFormData(sensor: any): SensorFormData {
  return {
    name: sensor?.name ?? '',
    description: sensor?.description ?? '',
    encodingType: sensor?.encodingType ?? '',
    metadata: sensor?.metadata ?? '',
    properties: fromPropertiesObject(sensor?.properties),
  }
}

export function toObservedPropertyFormData(op: any): ObservedPropertyFormData {
  return {
    name: op?.name ?? '',
    definition: op?.definition ?? '',
    description: op?.description ?? '',
    properties: fromPropertiesObject(op?.properties),
  }
}

export function toDatastreamFormData(ds: any): DatastreamFormData {
  return {
    name: ds?.name ?? '',
    description: ds?.description ?? '',
    observationType: ds?.observationType ?? '',
    thingId: getEntityId(ds?.Thing),
    sensorId: getEntityId(ds?.Sensor),
    observedPropertyId: getEntityId(ds?.ObservedProperty),
    networkId: getEntityId(ds?.Network),
    unitOfMeasurement: fromPropertiesObject(ds?.unitOfMeasurement),
    properties: fromPropertiesObject(ds?.properties),
  }
}
