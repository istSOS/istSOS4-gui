import type {
  AggregationEntityOption,
  AggregationTargetPayload,
  AggregationTargetTemplate,
} from '@/features/aggregations/lib/types'

import {
  AggregationError,
  aggregationCollection,
  aggregationContext,
  aggregationUpstream,
} from './aggregations'

type Context = Awaited<ReturnType<typeof aggregationContext>>

export async function aggregationTargetTemplate(
  context: Context,
  datastreamId: string | null
): Promise<AggregationTargetTemplate> {
  if (!datastreamId || !/^[1-9]\d*$/.test(datastreamId))
    throw new AggregationError('request', 400)
  const entities = async (
    collection: 'Things' | 'Sensors' | 'ObservedProperties' | 'Networks'
  ): Promise<AggregationEntityOption[]> => {
    const rows = await aggregationCollection(
      context,
      collection,
      collection === 'Networks'
        ? '$select=id,name'
        : '$select=id,name,description'
    )
    return rows
      .map((raw) => {
        if (raw['@iot.id'] == null || typeof raw.name !== 'string')
          throw new AggregationError('response', 502)
        return {
          id: String(raw['@iot.id']),
          name: raw.name,
          description:
            typeof raw.description === 'string' ? raw.description : '',
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  const [source, things, sensors, observedProperties, networks] =
    await Promise.all([
      aggregationUpstream(
        context,
        `Datastreams(${datastreamId})?$select=id,name,unitOfMeasurement&$expand=Thing($select=id),ObservedProperty($select=id)${context.networkEnabled ? ',Network($select=id)' : ''}`
      ),
      entities('Things'),
      entities('Sensors'),
      entities('ObservedProperties'),
      context.networkEnabled ? entities('Networks') : Promise.resolve([]),
    ])
  if (source['@iot.id'] == null || typeof source.name !== 'string')
    throw new AggregationError('response', 502)
  const unit = source.unitOfMeasurement
  const unitField = (key: string) =>
    typeof unit?.[key] === 'string' ? unit[key] : ''
  return {
    source: {
      id: String(source['@iot.id']),
      name: source.name,
      thingId: String(source.Thing?.['@iot.id'] ?? ''),
      observedPropertyId: String(source.ObservedProperty?.['@iot.id'] ?? ''),
      networkId: String(source.Network?.['@iot.id'] ?? ''),
      unitOfMeasurement: {
        name: unitField('name'),
        symbol: unitField('symbol'),
        definition: unitField('definition'),
      },
    },
    things,
    sensors,
    observedProperties,
    networks,
    networkEnabled: context.networkEnabled,
  }
}

export function validateAggregationTarget(
  raw: unknown,
  networkEnabled: boolean
): AggregationTargetPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new AggregationError('request', 400)
  const input = raw as Record<string, unknown>
  const allowed = [
    'name',
    'description',
    'observationType',
    'unitOfMeasurement',
    'Thing',
    'Sensor',
    'ObservedProperty',
    ...(networkEnabled ? ['Network'] : []),
  ]
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new AggregationError('request', 400)
  const text = (value: unknown, required = false) => {
    if (typeof value !== 'string' || (required && !value.trim()))
      throw new AggregationError('request', 400)
    return value.trim()
  }
  const reference = (key: string) => {
    const value = input[key] as Record<string, unknown> | undefined
    if (
      !value ||
      Object.keys(value).length !== 1 ||
      !Number.isSafeInteger(value['@iot.id']) ||
      Number(value['@iot.id']) < 1
    )
      throw new AggregationError('request', 400)
    return { '@iot.id': Number(value['@iot.id']) }
  }
  const unit = input.unitOfMeasurement as Record<string, unknown> | undefined
  if (
    !unit ||
    Array.isArray(unit) ||
    Object.keys(unit).some(
      (key) => !['name', 'symbol', 'definition'].includes(key)
    )
  )
    throw new AggregationError('request', 400)
  if (
    input.observationType !==
    'http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement'
  )
    throw new AggregationError('request', 400)
  return {
    name: text(input.name, true),
    description: text(input.description, true),
    observationType: input.observationType,
    Thing: reference('Thing'),
    Sensor: reference('Sensor'),
    ObservedProperty: reference('ObservedProperty'),
    ...(networkEnabled ? { Network: reference('Network') } : {}),
    unitOfMeasurement: {
      name: text(unit.name),
      symbol: text(unit.symbol),
      definition: text(unit.definition),
    },
  }
}

export async function createAggregationTarget(context: Context, raw: unknown) {
  const payload = validateAggregationTarget(raw, context.networkEnabled)
  const filter = encodeURIComponent(
    `name eq '${payload.name.replace(/'/g, "''")}'`
  )
  const existing = await aggregationUpstream(
    context,
    `Datastreams?$filter=${filter}&$select=id&$top=1`
  )
  if (!Array.isArray(existing.value))
    throw new AggregationError('response', 502)
  if (existing.value.length) throw new AggregationError('targetExists', 409)
  let created: Record<string, unknown>
  try {
    created = await aggregationUpstream(
      context,
      'Datastreams',
      'POST',
      payload,
      {
        headers: { 'commit-message': 'Create aggregation target from GUI' },
        allowEmpty: true,
      }
    )
  } catch (error) {
    if (
      error instanceof AggregationError &&
      error.status >= 400 &&
      error.status < 500
    )
      throw error.status === 409
        ? new AggregationError('targetExists', 409)
        : error
    throw new AggregationError('targetUnknown', 503)
  }
  let id = created['@iot.id'] ?? created.id
  if (id == null && typeof created.location === 'string') {
    try {
      const location = new URL(created.location, `${context.endpoint}/`)
      id = location.pathname.match(/\/Datastreams\(([1-9]\d*)\)\/?$/)?.[1]
    } catch {
      throw new AggregationError('targetUnknown', 502)
    }
  }
  if (
    (typeof id === 'number' && !Number.isSafeInteger(id)) ||
    !/^[1-9]\d*$/.test(String(id ?? ''))
  )
    throw new AggregationError('targetUnknown', 502)
  // Return the confirmed identity immediately. A failed follow-up read must
  // never hide a successful creation and encourage another create attempt.
  return {
    id: String(id),
    name: payload.name,
    thing: '',
    unit: payload.unitOfMeasurement.symbol,
  }
}
