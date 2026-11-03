import type { AggregationCreate, AggregationDatastream } from './types'

export const initialAggregationForm = {
  sourceDatastream: '',
  targetDatastream: '',
  aggregation: 'SUM' as NonNullable<AggregationCreate['aggregation']>,
  bucketInterval: '10 minutes' as NonNullable<
    AggregationCreate['bucketInterval']
  >,
  bucketTimezone: 'Etc/GMT-1',
  conversionFactor: '1',
  minObservations: '',
  expectedObservationInterval: '',
  maxConsecutiveMissing: '',
  bucketsToRecompute: '3',
  boundaryMode: 'right_closed' as NonNullable<
    AggregationCreate['boundaryMode']
  >,
  resultQualityKey: '',
  resultQualityAllowed: '',
  resultQualityMin: '',
  resultQualityMax: '',
  availabilityDatastreams: [] as string[],
  availabilityMaxAge: '',
  emptyBucketPolicy: 'missing' as NonNullable<
    AggregationCreate['emptyBucketPolicy']
  >,
  emptyBucketResultQuality: '1',
  systemTimeIncremental: false,
  systemTimeOverlap: '5 minutes',
  scheduleInterval: '',
  scheduleDelay: '3 minutes',
  scheduleTimezone: '',
  fixedSchedule: true,
  enabled: true,
}

export type AggregationFormValues = typeof initialAggregationForm
export class AggregationFormError extends Error {
  constructor(
    public code: string,
    public field: keyof AggregationFormValues
  ) {
    super(code)
  }
}

export function buildAggregationPayload(
  form: AggregationFormValues,
  streams: AggregationDatastream[],
  newTargetName?: string
): AggregationCreate {
  const streamName = (id: string, field: keyof AggregationFormValues) => {
    const stream = streams.find((item) => item.id === id)
    if (!stream) throw new AggregationFormError('required', field)
    return stream.name
  }
  const sourceDatastream = streamName(form.sourceDatastream, 'sourceDatastream')
  const targetDatastream =
    newTargetName?.trim() ||
    streamName(form.targetDatastream, 'targetDatastream')
  if (sourceDatastream === targetDatastream)
    throw new AggregationFormError('differentStreams', 'targetDatastream')

  const required = (field: keyof AggregationFormValues) => {
    const value = String(form[field]).trim()
    if (!value) throw new AggregationFormError('required', field)
    return value
  }
  const numeric = (field: keyof AggregationFormValues, integer = false) => {
    const raw = String(form[field]).trim()
    if (!raw) return undefined
    const value = Number(raw)
    if (
      integer
        ? !/^\d+$/.test(raw) || value > 2147483647
        : !Number.isFinite(value)
    )
      throw new AggregationFormError(integer ? 'count' : 'number', field)
    return value
  }
  const minObservations = numeric('minObservations', true)
  const maxConsecutiveMissing = numeric('maxConsecutiveMissing', true)
  const expectedObservationInterval = form.expectedObservationInterval.trim()
  if (maxConsecutiveMissing !== undefined && !expectedObservationInterval)
    throw new AggregationFormError(
      'cadenceRequired',
      'expectedObservationInterval'
    )
  const bucketsToRecompute = numeric('bucketsToRecompute', true)
  if (!bucketsToRecompute)
    throw new AggregationFormError('positiveCount', 'bucketsToRecompute')
  required('conversionFactor')
  required('emptyBucketResultQuality')
  const resultQualityMin = numeric('resultQualityMin')
  const resultQualityMax = numeric('resultQualityMax')
  if (
    resultQualityMin !== undefined &&
    resultQualityMax !== undefined &&
    resultQualityMin > resultQualityMax
  )
    throw new AggregationFormError('qualityRange', 'resultQualityMax')
  let resultQualityAllowed: number[] | undefined
  if (form.resultQualityAllowed.trim()) {
    const parts = form.resultQualityAllowed
      .split(',')
      .map((part) => part.trim())
    if (parts.some((part) => !part || !Number.isFinite(Number(part))))
      throw new AggregationFormError('qualityList', 'resultQualityAllowed')
    resultQualityAllowed = [...new Set(parts.map(Number))]
  }
  const availabilityDatastreams = form.availabilityDatastreams.map((id) =>
    streamName(id, 'availabilityDatastreams')
  )
  if (
    (availabilityDatastreams.length ||
      form.emptyBucketPolicy === 'zero_when_available') &&
    !form.availabilityMaxAge.trim()
  )
    throw new AggregationFormError('availabilityRequired', 'availabilityMaxAge')
  if (
    form.emptyBucketPolicy === 'zero_when_available' &&
    !availabilityDatastreams.length
  )
    throw new AggregationFormError(
      'availabilityRequired',
      'availabilityDatastreams'
    )

  return {
    sourceDatastream,
    targetDatastream,
    aggregation: form.aggregation,
    bucketInterval: form.bucketInterval,
    bucketTimezone: required('bucketTimezone'),
    conversionFactor: numeric('conversionFactor'),
    ...(minObservations !== undefined ? { minObservations } : {}),
    ...(expectedObservationInterval ? { expectedObservationInterval } : {}),
    ...(maxConsecutiveMissing !== undefined ? { maxConsecutiveMissing } : {}),
    bucketsToRecompute,
    boundaryMode: form.boundaryMode,
    ...(form.resultQualityKey.trim()
      ? { resultQualityKey: form.resultQualityKey.trim() }
      : {}),
    ...(resultQualityAllowed ? { resultQualityAllowed } : {}),
    ...(resultQualityMin !== undefined ? { resultQualityMin } : {}),
    ...(resultQualityMax !== undefined ? { resultQualityMax } : {}),
    availabilityDatastreams,
    ...(form.availabilityMaxAge.trim()
      ? { availabilityMaxAge: form.availabilityMaxAge.trim() }
      : {}),
    emptyBucketPolicy: form.emptyBucketPolicy,
    emptyBucketResultQuality: numeric('emptyBucketResultQuality'),
    systemTimeIncremental: form.systemTimeIncremental,
    systemTimeOverlap: required('systemTimeOverlap'),
    ...(form.scheduleInterval.trim()
      ? { scheduleInterval: form.scheduleInterval.trim() }
      : {}),
    scheduleDelay: required('scheduleDelay'),
    ...(form.scheduleTimezone.trim()
      ? { scheduleTimezone: form.scheduleTimezone.trim() }
      : {}),
    fixedSchedule: form.fixedSchedule,
    enabled: form.enabled,
  }
}
