import type {
  AggregationTargetPayload,
  AggregationTargetTemplate,
} from './types'

export type AggregationTargetDraft = {
  name: string
  description: string
  thingId: string
  sensorId: string
  observedPropertyId: string
  networkId: string
  unitName: string
  unitSymbol: string
  unitDefinition: string
  unitsReviewed: boolean
}

export class AggregationTargetError extends Error {
  constructor(public field: keyof AggregationTargetDraft) {
    super(field)
  }
}

export function suggestAggregationTarget(
  template: AggregationTargetTemplate,
  interval: string,
  description: string
): AggregationTargetDraft {
  const suffix =
    {
      '10 minutes': '10min',
      '1 hour': 'hourly',
      '1 day': 'daily',
      '1 year': 'yearly',
    }[interval] ?? interval
  return {
    name: `${template.source.name}_${suffix}`,
    description,
    thingId: template.source.thingId,
    sensorId: '',
    observedPropertyId: template.source.observedPropertyId,
    networkId: template.source.networkId,
    unitName: template.source.unitOfMeasurement.name,
    unitSymbol: template.source.unitOfMeasurement.symbol,
    unitDefinition: template.source.unitOfMeasurement.definition,
    unitsReviewed: false,
  }
}

export function buildAggregationTarget(
  draft: AggregationTargetDraft,
  template: AggregationTargetTemplate
): AggregationTargetPayload {
  if (!draft.unitsReviewed) throw new AggregationTargetError('unitsReviewed')
  for (const field of ['name', 'description'] as const)
    if (!draft[field].trim()) throw new AggregationTargetError(field)
  const reference = (
    field: 'thingId' | 'sensorId' | 'observedPropertyId' | 'networkId',
    options: Array<{ id: string }>
  ) => {
    if (!options.some((option) => option.id === draft[field]))
      throw new AggregationTargetError(field)
    const id = Number(draft[field])
    if (!Number.isSafeInteger(id) || id < 1)
      throw new AggregationTargetError(field)
    return { '@iot.id': id }
  }
  // Construct a minimal payload: raw-source properties (especially QC checks),
  // extents and observations must never be cloned into the derived series.
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    observationType:
      'http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement',
    Thing: reference('thingId', template.things),
    Sensor: reference('sensorId', template.sensors),
    ObservedProperty: reference(
      'observedPropertyId',
      template.observedProperties
    ),
    ...(template.networkEnabled
      ? { Network: reference('networkId', template.networks) }
      : {}),
    unitOfMeasurement: {
      name: draft.unitName.trim(),
      symbol: draft.unitSymbol.trim(),
      definition: draft.unitDefinition.trim(),
    },
  }
}
