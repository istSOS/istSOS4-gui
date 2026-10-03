/**
 * The commit that produced the version of a record being read.
 *
 * Present on any entity read with `$expand=Commit`, in live mode and under
 * `$as_of` alike — under a snapshot it is the commit in effect at that instant,
 * which is what makes it the answer to "why does this point read this way".
 */
export type RecordCommit = {
  '@iot.id'?: string | number
  message?: string
  /** ISO-8601 instant the commit was written (transaction time). */
  date?: string
  author?: string
  /** CREATE | UPDATE | DELETE */
  actionType?: string
  /** Media type of `message` — the API sends text/plain. */
  encodingType?: string
  '@iot.selfLink'?: string
}

export type Observation = {
  phenomenonTime?: string
  resultTime?: string
  result?: unknown
  /**
   * Raw `resultQuality`, exactly as the API sends it.
   *
   * Deliberately `unknown`: the column is untyped `jsonb`, so a number, a
   * numeric string and an object are all shapes that reach here. Read it through
   * `features/observations/lib/resultQuality`, never directly.
   */
  resultQuality?: unknown
  Commit?: RecordCommit
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
  /**
   * Snapshot Things only: how `Locations` was resolved for the instant.
   * 'history' is exact; 'unplaced' means the Thing had no position yet;
   * 'lost' means it had one but it is no longer recorded (deleted since); 'link'
   * (only the current link is known) and 'live' (the snapshot could not be
   * read, so this is live data) are approximate and must be shown as such.
   */
  __asOfLocationSource?: 'history' | 'unplaced' | 'lost' | 'link' | 'live'
  Locations?: LocationRef[]
  Datastreams?: Datastream[]
}
