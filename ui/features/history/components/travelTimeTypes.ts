export type ActionType = 'INSERT' | 'UPDATE' | 'DELETE'
export type QueryMode = 'current' | 'as_of' | 'from_to'
export type EntityTab = 'Details' | 'Observations' | 'History'
export type Period = 'Day' | 'Week' | 'Month'

export type EntityType =
  | 'Things'
  | 'Locations'
  | 'Sensors'
  | 'Datastreams'
  | 'ObservedProperties'
  | 'FeaturesOfInterest'
  | 'HistoricalLocations'

export const ENTITY_TYPES: EntityType[] = [
  'Things',
  'Locations',
  'HistoricalLocations',
  'Sensors',
  'Datastreams',
  'ObservedProperties',
  'FeaturesOfInterest',
]

export interface DiffField {
  field: string
  previous: string
  next: string
}

export interface CommitRow {
  id: string
  date: string
  isoDate: string
  author: string
  action: ActionType
  message: string
  diff: DiffField[]
  snapshot: Record<string, any>
}

export interface EntityState {
  fields: Record<string, string>
  validFrom: string
  commit: CommitRow
}

export interface GenericEntity {
  id: string | number
  name?: string
  [key: string]: any
}

export interface BarEntry {
  label: string
  count: number
}
