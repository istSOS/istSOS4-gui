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

export type GeoJsonNamedCrs = {
  crs?: {
    type?: string
    properties?: { name?: string }
  }
}

export type LocationRef = EntityRef & {
  __sourceEndpoint?: string
  encodingType?: string
  location?:
    | ({ type: 'Point'; coordinates?: [number, number] } & GeoJsonNamedCrs)
    | ({ type: 'LineString'; coordinates?: [number, number][] } & GeoJsonNamedCrs)
    | ({ type: 'Polygon'; coordinates?: [number, number][][] } & GeoJsonNamedCrs)
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
