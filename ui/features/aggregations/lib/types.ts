export type AggregationSource = {
  id: string
  name: string
  endpoint: string
  authorizationEnabled: boolean
  isPrimary: boolean
}

export type AggregationDatastream = {
  id: string
  name: string
  thing: string
  unit: string
}

export type AggregationEntityOption = {
  id: string
  name: string
  description?: string
}
export type AggregationTargetPayload = {
  name: string
  description: string
  observationType: string
  Thing: { '@iot.id': number }
  Sensor: { '@iot.id': number }
  ObservedProperty: { '@iot.id': number }
  Network?: { '@iot.id': number }
  unitOfMeasurement: { name: string; symbol: string; definition: string }
}
export type AggregationTargetTemplate = {
  source: {
    id: string
    name: string
    thingId: string
    observedPropertyId: string
    networkId: string
    unitOfMeasurement: AggregationTargetPayload['unitOfMeasurement']
  }
  things: AggregationEntityOption[]
  sensors: AggregationEntityOption[]
  observedProperties: AggregationEntityOption[]
  networks: AggregationEntityOption[]
  networkEnabled: boolean
}

export const bucketIntervals = [
  '10 minutes',
  '1 hour',
  '1 day',
  '1 year',
] as const
export const aggregationFunctions = [
  'SUM',
  'SUM_NULL_AS_ONE',
  'COUNT',
  'AVG',
  'MIN',
  'MAX',
] as const

export type AggregationSettings = {
  bucketInterval?: (typeof bucketIntervals)[number]
  aggregation?: (typeof aggregationFunctions)[number]
  bucketTimezone?: string
  conversionFactor?: number
  minObservations?: number | null
  expectedObservationInterval?: string | null
  maxConsecutiveMissing?: number | null
  bucketsToRecompute?: number
  boundaryMode?: 'right_closed' | 'left_closed'
  resultQualityKey?: string | null
  resultQualityAllowed?: number[] | null
  resultQualityMin?: number | null
  resultQualityMax?: number | null
  availabilityMaxAge?: string | null
  emptyBucketPolicy?: 'missing' | 'zero_when_available'
  emptyBucketResultQuality?: number
  systemTimeIncremental?: boolean
  systemTimeOverlap?: string
  scheduleInterval?: string
  scheduleDelay?: string
  scheduleTimezone?: string
  fixedSchedule?: boolean
  enabled: boolean
}

export type AggregationCreate = AggregationSettings & {
  sourceDatastream: string
  targetDatastream: string
  availabilityDatastreams?: string[]
}

export type AggregationJob = AggregationSettings & {
  id: number
  sourceDatastream: { id: number | null; name: string | null }
  targetDatastream: { id: number | null; name: string | null }
  availabilityDatastreams?: Array<{ id: number; name: string | null }>
  nextRunAt?: string | null
  lastRunStartedAt?: string | null
  lastSuccessfulFinish?: string | null
  lastRunStatus?: string | null
  jobStatus?: string | null
  lastRunDuration?: string | null
  totalRuns?: number
  totalSuccesses?: number
  totalFailures?: number
}
