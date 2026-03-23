// Copyright 2026 SUPSI — History Mock Data
// Separate from component logic so it can later be replaced with real API calls.

export type EntityType =
  | 'Things'
  | 'Locations'
  | 'Sensors'
  | 'Datastreams'
  | 'Observations'
  | 'ObservedProperties'
  | 'FeaturesOfInterest'
  | 'HistoricalLocations'

export const ENTITY_TYPES: EntityType[] = [
  'Things',
  'Locations',
  'Sensors',
  'Datastreams',
  'Observations',
  'ObservedProperties',
  'FeaturesOfInterest',
  'HistoricalLocations',
]



export type ActionType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface CommitInfo {
  author: string
  action: ActionType
  message: string
}

export interface EntityState {
  /** Human-readable field/value pairs shown on the Entity State Card */
  fields: Record<string, string>
  validFrom: string
  commit: CommitInfo
}

export interface DiffField {
  field: string
  previous: string
  next: string
}

export interface CommitRow {
  id: string
  /** Display date, e.g. "Dec 1, 2025 · 00:00" */
  date: string
  /** ISO-ish string used to pre-fill range picker */
  isoDate: string
  author: string
  action: ActionType
  message: string
  diff: DiffField[]
  snapshot: Record<string, any>
}

export interface EntityMockData {
  /** Default date/time to pre-fill the "as_of" single-point picker */
  defaultAsOf: { date: string; time: string }
  /** Default range to pre-fill the "from_to" range picker */
  defaultRange: { fromDate: string; fromTime: string; toDate: string; toTime: string }
  /** Entity state returned by an as_of query */
  asOf: EntityState
  /** Commits returned by a from_to query */
  fromTo: CommitRow[]
}



const THINGS: EntityMockData = {
  defaultAsOf: { date: '2026-03-20', time: '12:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      name: 'IST-AQM-01',
      description: 'station:ref:001',
      properties: '{"hw_rev":"2.1","vendor":"SUPSI"}',
    },
    validFrom: 'Mar 20, 2026',
    commit: { author: 'system-sync', action: 'INSERT', message: 'auto-registration' },
  },
  fromTo: [
    {
      id: 'th1', date: 'Mar 20, 2026 · 08:00', isoDate: '2026-03-20T08:00',
      author: 'system-sync', action: 'INSERT', message: 'auto-registration',
      diff: [{ field: 'name', previous: '—', next: 'IST-AQM-01' }],
      snapshot: { name: 'IST-AQM-01', description: 'station:ref:001', properties: { hw_rev: '2.1', vendor: 'SUPSI' } },
    },
    {
      id: 'th2', date: 'Mar 21, 2026 · 14:20', isoDate: '2026-03-21T14:20',
      author: 'sts-admin', action: 'UPDATE', message: 'updated hardware property',
      diff: [{ field: 'properties', previous: '{"hw_rev":"2.0"}', next: '{"hw_rev":"2.1","vendor":"SUPSI"}' }],
      snapshot: { name: 'IST-AQM-01', description: 'station:ref:001', properties: { hw_rev: '2.1', vendor: 'SUPSI' } },
    },
  ],
}



const LOCATIONS: EntityMockData = {
  defaultAsOf: { date: '2026-03-20', time: '00:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      name: 'Lugano-Campus',
      description: 'Main campus installation',
      location: '{"type":"Point","coordinates":[8.956,46.005]}',
    },
    validFrom: 'Mar 20, 2026',
    commit: { author: 'system-sync', action: 'INSERT', message: 'location' },
  },
  fromTo: [
    {
      id: 'lo1', date: 'Mar 20, 2026 · 07:30', isoDate: '2026-03-20T07:30',
      author: 'system-sync', action: 'INSERT', message: 'location',
      diff: [{ field: 'location', previous: '—', next: '{"type":"Point","coordinates":[8.956,46.005]}' }],
      snapshot: { name: 'Lugano-Campus', location: '{"type":"Point","coordinates":[8.956,46.005]}', properties: { srs: 'EPSG:4326' } },
    },
  ],
}



const SENSORS: EntityMockData = {
  defaultAsOf: { date: '2025-12-01', time: '00:00' },
  defaultRange: { fromDate: '2025-10-01', fromTime: '00:00', toDate: '2026-03-21', toTime: '23:59' },
  asOf: {
    fields: {
      name: 'PMS7003 Dust Sensor',
      description: 'Laser particle counter for PM2.5 / PM10',
      encodingType: 'application/pdf',
      metadata: 'https://cdn.plantower.com/PMS7003.pdf',
    },
    validFrom: 'Oct 15, 2025',
    commit: { author: 'admin', action: 'INSERT', message: 'sensor spec added' },
  },
  fromTo: [
    {
      id: 'se1', date: 'Oct 15, 2025 · 08:05', isoDate: '2025-10-15T08:05',
      author: 'admin', action: 'INSERT', message: 'sensor spec added',
      diff: [{ field: 'name', previous: '—', next: 'PMS7003 Dust Sensor' }],
      snapshot: { name: 'PMS7003 Dust Sensor', encodingType: 'application/pdf', metadata: 'https://cdn.plantower.com/PMS7003.pdf', properties: { frequency: '5min' } },
    },
    {
      id: 'se2', date: 'Feb 1, 2026 · 10:00', isoDate: '2026-02-01T10:00',
      author: 'technician', action: 'UPDATE', message: 'updated metadata URL',
      diff: [{ field: 'metadata', previous: 'https://old-url.com/spec.pdf', next: 'https://cdn.plantower.com/PMS7003.pdf' }],
      snapshot: { name: 'PMS7003 Dust Sensor', encodingType: 'application/pdf', metadata: 'https://cdn.plantower.com/PMS7003.pdf', properties: { frequency: '5min' } },
    },
    {
      id: 'se3', date: 'Mar 5, 2026 · 16:30', isoDate: '2026-03-05T16:30',
      author: 'admin', action: 'UPDATE', message: 'added description',
      diff: [{ field: 'description', previous: '—', next: 'Laser particle counter for PM2.5 / PM10' }],
      snapshot: { name: 'PMS7003 Dust Sensor', description: 'Laser particle counter for PM2.5 / PM10', encodingType: 'application/pdf', metadata: 'https://cdn.plantower.com/PMS7003.pdf', properties: { frequency: '5min' } },
    },
  ],
}



const DATASTREAMS: EntityMockData = {
  defaultAsOf: { date: '2026-03-20', time: '00:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      name: 'STS-DAT-001',
      description: 'PM2.5 concentrations',
      observationType: 'OM_Measurement',
      unitOfMeasurement: '{"name":"PM2.5","symbol":"ug/m3"}',
    },
    validFrom: 'Mar 18, 2026',
    commit: { author: 'system-sync', action: 'INSERT', message: 'stream:init' },
  },
  fromTo: [
    {
      id: 'ds1', date: 'Mar 18, 2026 · 00:00', isoDate: '2026-03-18T00:00',
      author: 'system-sync', action: 'INSERT', message: 'stream:init',
      diff: [{ field: 'unitOfMeasurement', previous: '—', next: '{"name":"PM2.5","symbol":"ug/m3"}' }],
      snapshot: { name: 'STS-DAT-001', unitOfMeasurement: '{"name":"PM2.5","symbol":"ug/m3"}', properties: { sampling: '300s' } },
    },
  ],
}



const OBSERVATIONS: EntityMockData = {
  defaultAsOf: { date: '2026-03-22', time: '09:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      result: '42.8',
      phenomenonTime: '2026-03-22T09:00:00Z',
      resultQuality: 'QC_PASSED',
    },
    validFrom: 'Mar 22, 2026',
    commit: { author: 'sensor-agent', action: 'INSERT', message: 'auto-ingested reading' },
  },
  fromTo: [
    {
      id: 'ob1', date: 'Mar 22, 2026 · 09:00', isoDate: '2026-03-22T09:00',
      author: 'sts-ingest', action: 'INSERT', message: 'auto-ingested reading',
      diff: [{ field: 'result', previous: '—', next: '42.8' }],
      snapshot: { result: '42.8', phenomenonTime: '2026-03-22T09:00:00Z', resultQuality: 'QC_PASSED' },
    },
  ],
}



const OBSERVED_PROPERTIES: EntityMockData = {
  defaultAsOf: { date: '2026-03-01', time: '00:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      name: 'PM2.5',
      definition: 'urn:ogc:def:phenomenon:pm25',
      description: 'Particulate matter ≤ 2.5 µm',
    },
    validFrom: 'Mar 10, 2026',
    commit: { author: 'sts-admin', action: 'INSERT', message: 'prop:reg:pm25' },
  },
  fromTo: [
    {
      id: 'op1', date: 'Mar 10, 2026 · 09:00', isoDate: '2026-03-10T09:00',
      author: 'sts-admin', action: 'INSERT', message: 'prop:reg:pm25',
      diff: [{ field: 'name', previous: '—', next: 'PM2.5' }],
      snapshot: { name: 'PM2.5', definition: 'urn:ogc:def:phenomenon:pm25' },
    },
  ],
}



const FEATURES_OF_INTEREST: EntityMockData = {
  defaultAsOf: { date: '2026-03-20', time: '00:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      name: 'FOI-AQM-01',
      description: 'Sampling point at Lugano campus',
      feature: '{"type":"Point","coordinates":[8.956,46.005]}',
    },
    validFrom: 'Mar 20, 2026',
    commit: { author: 'system-sync', action: 'INSERT', message: 'foi:mapping' },
  },
  fromTo: [
    {
      id: 'fo1', date: 'Mar 20, 2026 · 08:10', isoDate: '2026-03-20T08:10',
      author: 'system-sync', action: 'INSERT', message: 'foi:mapping',
      diff: [{ field: 'feature', previous: '—', next: '{"type":"Point","coordinates":[8.956,46.005]}' }],
      snapshot: { name: 'FOI-AQM-01', feature: '{"type":"Point","coordinates":[8.956,46.005]}' },
    },
  ],
}



const HISTORICAL_LOCATIONS: EntityMockData = {
  defaultAsOf: { date: '2026-03-20', time: '08:00' },
  defaultRange: { fromDate: '2026-03-01', fromTime: '00:00', toDate: '2026-03-31', toTime: '23:59' },
  asOf: {
    fields: {
      time: '2026-03-20T08:00:00Z',
      thing_id: '1',
      commit_id: 'c4',
    },
    validFrom: 'Mar 20, 2026',
    commit: { author: 'system-sync', action: 'INSERT', message: 'historical:loc:init' },
  },
  fromTo: [
    {
      id: 'hl1', date: 'Mar 20, 2026 · 07:30', isoDate: '2026-03-20T07:30',
      author: 'system-sync', action: 'INSERT', message: 'historical:loc:init',
      diff: [{ field: 'time', previous: '—', next: '2026-03-20T07:30Z' }],
      snapshot: { time: '2026-03-20T07:30Z', thing_id: '1', commit_id: 'c4' },
    },
  ],
}



export const HISTORY_MOCK: Record<EntityType, EntityMockData> = {
  Things: THINGS,
  Locations: LOCATIONS,
  Sensors: SENSORS,
  Datastreams: DATASTREAMS,
  Observations: OBSERVATIONS,
  ObservedProperties: OBSERVED_PROPERTIES,
  FeaturesOfInterest: FEATURES_OF_INTEREST,
  HistoricalLocations: HISTORICAL_LOCATIONS,
}

/** All commits across all entities, sorted newest first — used by CommitHistoryTab */
export const ALL_COMMITS_GLOBAL: (CommitRow & { entity: EntityType })[] = (
  Object.entries(HISTORY_MOCK) as [EntityType, EntityMockData][]
).flatMap(([entity, data]) =>
  data.fromTo.map((c) => ({ ...c, entity }))
).sort((a, b) => b.isoDate.localeCompare(a.isoDate))
