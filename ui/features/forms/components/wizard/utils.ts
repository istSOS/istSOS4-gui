import type {
  AssociatedDraft,
  DatastreamFormData,
  EntityKey,
  ExistingOption,
  FormDataMap,
  KeyValueItem,
  LocationFormData,
  ObservedPropertyFormData,
  SensorFormData,
  ThingFormData,
} from './types'

function toPropertiesObject(items: KeyValueItem[]) {
  const entries = items
    .filter((item) => item.key.trim().length > 0)
    .map((item) => [item.key, item.value] as const)

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function getEntityId(item: any) {
  return String(item?.['@iot.id'] ?? item?.id ?? '')
}

function getEntityName(item: any, fallback: string) {
  return String(item?.name ?? fallback)
}

function getLocationDescription(location: any, thing: any) {
  if (typeof location?.description === 'string' && location.description.trim()) {
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
  things: any[]
): Record<EntityKey, ExistingOption[]> {
  const thingOptions = uniqueOptions(
    things.map((thing, index) => ({
      value: getEntityId(thing),
      label: getEntityName(thing, `Thing ${index + 1}`),
      description: String(thing?.description ?? ''),
    }))
  )

  const locationOptions = uniqueOptions(
    things.flatMap((thing) =>
      (Array.isArray(thing?.Locations) ? thing.Locations : []).map(
        (location: any, index: number) => ({
          value: getEntityId(location),
          label: getEntityName(location, `Location ${index + 1}`),
          description: getLocationDescription(location, thing),
        })
      )
    )
  )

  const datastreams = things.flatMap((thing) =>
    Array.isArray(thing?.Datastreams) ? thing.Datastreams : []
  )

  const sensorOptions = uniqueOptions(
    datastreams
      .map((datastream: any) => datastream?.Sensor)
      .filter(Boolean)
      .map((sensor: any, index: number) => ({
        value: getEntityId(sensor),
        label: getEntityName(sensor, `Sensor ${index + 1}`),
        description: String(sensor?.description ?? ''),
      }))
  )

  const observedPropertyOptions = uniqueOptions(
    datastreams
      .map((datastream: any) => datastream?.ObservedProperty)
      .filter(Boolean)
      .map((observedProperty: any, index: number) => ({
        value: getEntityId(observedProperty),
        label: getEntityName(
          observedProperty,
          `Observed Property ${index + 1}`
        ),
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
          datastream?.description ??
          datastream?.unitOfMeasurement?.symbol ??
          ''
      ),
    }))
  )

  return {
    thing: thingOptions,
    location: locationOptions,
    sensor: sensorOptions,
    observedProperty: observedPropertyOptions,
    datastream: datastreamOptions,
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
      return {
        name: current.name,
        description: current.description,
        location_id: current.locationId || undefined,
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
        location: current.location,
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
      return {
        name: current.name,
        description: current.description,
        thing_id: current.thingId || undefined,
        sensor_id: current.sensorId || undefined,
        observedProperty_id: current.observedPropertyId || undefined,
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
