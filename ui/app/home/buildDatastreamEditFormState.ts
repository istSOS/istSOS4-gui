import { siteConfig } from '@/config/site'
import { Datastream, Thing } from '@/types/domain'

import { normalizeEndpoint, toEntityId, toKeyValueItems, toLocationValue } from './utils'

export type FormTabKey =
  | 'thing'
  | 'location'
  | 'sensor'
  | 'observedProperty'
  | 'datastream'

export function buildDatastreamEditFormState({
  datastream,
  selectedThing,
}: {
  datastream: Datastream
  selectedThing: Thing | null
}) {
  const datastreamId = toEntityId(datastream)
  if (!datastreamId) return null

  const sourceEndpoint = normalizeEndpoint(
    String(
      datastream?.__sourceEndpoint ??
        selectedThing?.__sourceEndpoint ??
        siteConfig.api_root
    )
  )
  const selectedThingLocation = Array.isArray(selectedThing?.Locations)
    ? selectedThing.Locations[0]
    : null
  const thingId = toEntityId(selectedThing)
  const locationId = toEntityId(selectedThingLocation)
  const sensorId = toEntityId(datastream?.Sensor)
  const observedPropertyId = toEntityId(datastream?.ObservedProperty)
  const networkId = toEntityId(datastream?.Network)

  const datastreamDraft = {
    name: String(datastream?.name ?? ''),
    description: String(datastream?.description ?? ''),
    observationType: String(datastream?.observationType ?? ''),
    thingId,
    sensorId,
    observedPropertyId,
    networkId,
    unitOfMeasurement: toKeyValueItems(datastream?.unitOfMeasurement),
    properties: toKeyValueItems(datastream?.properties),
  }
  const thingDraft = {
    name: String(selectedThing?.name ?? ''),
    description: String(selectedThing?.description ?? ''),
    locationId,
    properties: toKeyValueItems(selectedThing?.properties),
  }
  const locationDraft = {
    name: String(selectedThingLocation?.name ?? ''),
    description: String(selectedThingLocation?.description ?? ''),
    encodingType: String(
      selectedThingLocation?.encodingType ?? 'application/geo+json'
    ),
    location: toLocationValue(selectedThingLocation?.location),
    properties: toKeyValueItems(selectedThingLocation?.properties),
  }
  const sensorDraft = {
    name: String(datastream?.Sensor?.name ?? ''),
    description: String(datastream?.Sensor?.description ?? ''),
    encodingType: String(datastream?.Sensor?.encodingType ?? ''),
    metadata: String(datastream?.Sensor?.metadata ?? ''),
    properties: toKeyValueItems(datastream?.Sensor?.properties),
  }
  const observedPropertyDraft = {
    name: String(datastream?.ObservedProperty?.name ?? ''),
    definition: String(datastream?.ObservedProperty?.definition ?? ''),
    description: String(datastream?.ObservedProperty?.description ?? ''),
    properties: toKeyValueItems(datastream?.ObservedProperty?.properties),
  }

  const editTargets: Partial<Record<FormTabKey, string>> = {
    datastream: datastreamId,
    ...(thingId ? { thing: thingId } : {}),
    ...(locationId ? { location: locationId } : {}),
    ...(sensorId ? { sensor: sensorId } : {}),
    ...(observedPropertyId ? { observedProperty: observedPropertyId } : {}),
  }

  return {
    sourceEndpoint,
    initialSingleDraft: {
      thing: thingDraft,
      location: locationDraft,
      sensor: sensorDraft,
      observedProperty: observedPropertyDraft,
      datastream: datastreamDraft,
    },
    editTargets,
  }
}
