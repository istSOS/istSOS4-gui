export type Observation = {
  phenomenonTime?: string
  resultTime?: string
  result?: unknown
}

export type ObservedPropertyRef = {
  '@iot.id'?: string | number
  id?: string | number
  name?: string
  definition?: string
  description?: string
  properties?: Record<string, unknown>
}

export type UnitOfMeasurementRef = {
  symbol?: string
  name?: string
}

export type EntityRef = {
  '@iot.id'?: string | number
  id?: string | number
  name?: string
  description?: string
}

export type SensorRef = EntityRef & {
  encodingType?: string
  metadata?: string
  properties?: Record<string, unknown>
}

export type LocationRef = EntityRef & {
  __sourceEndpoint?: string
  encodingType?: string
  location?:
    | { type: 'Point'; coordinates?: [number, number] }
    | { type: 'LineString'; coordinates?: [number, number][] }
    | { type: 'Polygon'; coordinates?: [number, number][][] }
  properties?: Record<string, unknown>
}

export type Datastream = {
  '@iot.id'?: string | number
  id?: string | number
  name?: string
  description?: string
  observationType?: string
  phenomenonTime?: string
  properties?: Record<string, unknown> & {
    acquisitionFrequency?: string
  }
  __sourceEndpoint?: string
  __sourceId?: string
  __sourceName?: string
  Observations?: Observation[]
  ObservedProperty?: ObservedPropertyRef
  unitOfMeasurement?: UnitOfMeasurementRef
  Network?: EntityRef
  Sensor?: SensorRef
  Thing?: EntityRef
}

export type Thing = {
  '@iot.id'?: string | number
  id?: string | number
  name?: string
  description?: string
  properties?: Record<string, unknown>
  __sourceEndpoint?: string
  __sourceId?: string
  __sourceName?: string
  Locations?: LocationRef[]
  Datastreams?: Datastream[]
}
