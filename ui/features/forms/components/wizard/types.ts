export type EntityKey =
  | 'thing'
  | 'location'
  | 'sensor'
  | 'observedProperty'
  | 'datastream'

export type FormTabKey = EntityKey
export type WizardMode = 'single' | 'associated'
export type SourceMode = 'new' | 'existing'

export type KeyValueItem = {
  key: string
  value: string
}

export type UnitOfMeasurement = KeyValueItem[]

export type ThingFormData = {
  name: string
  description: string
  locationId: string
  properties: KeyValueItem[]
}

export type LocationFormData = {
  name: string
  description: string
  encodingType: string
  location: string
  properties: KeyValueItem[]
}

export type SensorFormData = {
  name: string
  description: string
  encodingType: string
  metadata: string
  properties: KeyValueItem[]
}

export type ObservedPropertyFormData = {
  name: string
  definition: string
  description: string
  properties: KeyValueItem[]
}

export type DatastreamFormData = {
  name: string
  description: string
  observationType: string
  thingId: string
  sensorId: string
  observedPropertyId: string
  unitOfMeasurement: UnitOfMeasurement
  properties: KeyValueItem[]
}

export type FormDataMap = {
  thing: ThingFormData
  location: LocationFormData
  sensor: SensorFormData
  observedProperty: ObservedPropertyFormData
  datastream: DatastreamFormData
}

export type EntityDraft<K extends EntityKey = EntityKey> = {
  source: SourceMode
  formData: FormDataMap[K]
  existingId: string
}

export type AssociatedDraft = {
  [K in EntityKey]: EntityDraft<K>
}

export type ExistingOption = {
  value: string
  label: string
  description?: string
}

export const ENTITY_ORDER: EntityKey[] = [
  'thing',
  'location',
  'sensor',
  'observedProperty',
  'datastream',
]

export function createEmptyKeyValue(): KeyValueItem {
  return { key: '', value: '' }
}

export function createThingFormData(): ThingFormData {
  return { name: '', description: '', locationId: '', properties: [] }
}

export function createLocationFormData(
  latitude?: number,
  longitude?: number
): LocationFormData {
  return {
    name: '',
    description: '',
    encodingType: '',
    location:
      latitude !== undefined && longitude !== undefined
        ? `${latitude}, ${longitude}`
        : '',
    properties: [],
  }
}

export function createSensorFormData(): SensorFormData {
  return {
    name: '',
    description: '',
    encodingType: '',
    metadata: '',
    properties: [],
  }
}

export function createObservedPropertyFormData(): ObservedPropertyFormData {
  return {
    name: '',
    definition: '',
    description: '',
    properties: [],
  }
}

export function createDatastreamFormData(): DatastreamFormData {
  return {
    name: '',
    description: '',
    observationType: '',
    thingId: '',
    sensorId: '',
    observedPropertyId: '',
    unitOfMeasurement: [],
    properties: [],
  }
}

export function createInitialSingleDraft(
  latitude?: number,
  longitude?: number
): FormDataMap {
  return {
    thing: createThingFormData(),
    location: createLocationFormData(latitude, longitude),
    sensor: createSensorFormData(),
    observedProperty: createObservedPropertyFormData(),
    datastream: createDatastreamFormData(),
  }
}

export function createInitialAssociatedDraft(
  latitude?: number,
  longitude?: number
): AssociatedDraft {
  return {
    thing: {
      source: 'existing',
      formData: createThingFormData(),
      existingId: '',
    },
    location: {
      source: 'existing',
      formData: createLocationFormData(latitude, longitude),
      existingId: '',
    },
    sensor: {
      source: 'existing',
      formData: createSensorFormData(),
      existingId: '',
    },
    observedProperty: {
      source: 'existing',
      formData: createObservedPropertyFormData(),
      existingId: '',
    },
    datastream: {
      source: 'existing',
      formData: createDatastreamFormData(),
      existingId: '',
    },
  }
}
