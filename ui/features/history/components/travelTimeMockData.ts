import { EntityType, CommitRow, GenericEntity, BarEntry, Period } from './travelTimeTypes'

export const MOCK_COMMITS: Record<EntityType, CommitRow[]> = {
  Things: [
    { id: 'th1', date: 'Mar 20, 2026 · 08:00', isoDate: '2026-03-20T08:00', author: 'system-sync', action: 'INSERT', message: 'auto-registration', diff: [{ field: 'name', previous: '—', next: 'IST-AQM-01' }], snapshot: { name: 'IST-AQM-01', description: 'station:ref:001', properties: { hw_rev: '2.1', vendor: 'SUPSI' } } },
  ],
  Locations: [
    { id: 'lo1', date: 'Mar 20, 2026 · 07:30', isoDate: '2026-03-20T07:30', author: 'system-sync', action: 'INSERT', message: 'Location mapping', diff: [{ field: 'location', previous: '—', next: '{"type":"Point","coordinates":[8.956,46.005]}' }], snapshot: { name: 'Lugano-Campus', location: '{"type":"Point","coordinates":[8.956,46.005]}', properties: { srs: 'EPSG:4326' } } },
  ],
  Sensors: [
    { id: 'se1', date: 'Mar 15, 2026 · 08:00', isoDate: '2026-03-15T08:00', author: 'admin-sts', action: 'INSERT', message: 'setup:sensor:pm25', diff: [{ field: 'name', previous: '—', next: 'SENS-PM25-X1' }], snapshot: { name: 'SENS-PM25-X1', metadata: 'http://istsos.org/def/sensor/pm25', description: 'optical-sensor-v2', properties: { calib: '2026-01-10' } } },
    { id: 'se2', date: 'Mar 21, 2026 · 14:30', isoDate: '2026-03-21T14:30', author: 'tech-ref', action: 'UPDATE', message: 'meta:update:v2.1', diff: [{ field: 'metadata', previous: 'v2.0.pdf', next: 'v2.1.pdf' }], snapshot: { name: 'SENS-PM25-X1', metadata: 'v2.1.pdf', properties: { calib: '2026-01-10' } } },
  ],
  Datastreams: [
    { id: 'ds1', date: 'Mar 18, 2026 · 00:00', isoDate: '2026-03-18T00:00', author: 'system-sync', action: 'INSERT', message: 'stream:init', diff: [{ field: 'unitOfMeasurement', previous: '—', next: '{"name":"PM2.5","symbol":"ug/m3"}' }], snapshot: { name: 'STS-DAT-001', unitOfMeasurement: '{"name":"PM2.5","symbol":"ug/m3"}', properties: { sampling: '300s' } } },
  ],
  ObservedProperties: [
    { id: 'op1', date: 'Mar 10, 2026 · 09:00', isoDate: '2026-03-10T09:00', author: 'admin-sts', action: 'INSERT', message: 'prop:reg:pm25', diff: [{ field: 'name', previous: '—', next: 'PM2.5' }], snapshot: { name: 'PM2.5', definition: 'urn:ogc:def:phenomenon:pm25', properties: { domain: 'air_quality' } } },
  ],
  FeaturesOfInterest: [
    { id: 'fo1', date: 'Mar 20, 2026 · 08:10', isoDate: '2026-03-20T08:10', author: 'system-sync', action: 'INSERT', message: 'foi:mapping', diff: [{ field: 'feature', previous: '—', next: '{"type":"Point","coordinates":[8.956,46.005]}' }], snapshot: { name: 'FOI-AQM-01', feature: '{"type":"Point","coordinates":[8.956,46.005]}', properties: { type: 'SamplingPoint' } } },
  ],
  HistoricalLocations: [
    { id: 'hl1', date: 'Mar 20, 2026 · 07:30', isoDate: '2026-03-20T07:30', author: 'system-sync', action: 'INSERT', message: 'historical:loc:init', diff: [{ field: 'time', previous: '—', next: '2026-03-20T07:30Z' }], snapshot: { time: '2026-03-20T07:30Z', thing_id: '1', commit_id: 'c4' } },
  ],
}

export const MOCK_COLLECTIONS: Record<EntityType, GenericEntity[]> = {
  Things: [
    { id: 1, name: 'IST-AQM-01', description: 'station:ref:001', properties: { vendor: 'SUPSI', model: 'IST-X1' }, commit_id: 'c1', systemTimeValidity: '2026-03-20' },
    { id: 2, name: 'IST-AQM-02', description: 'station:ref:002', properties: { deployment: 'internal' }, commit_id: 'c2', systemTimeValidity: '2026-03-21' },
  ],
  Locations: [
    { id: 1, name: 'Lugano-Campus', description: 'Main laboratory office', encodingType: 'application/vnd.geo+json', location: '{"type":"Point","coordinates":[8.956,46.005]}', properties: { srs: 'EPSG:4326' }, commit_id: 'c3', systemTimeValidity: '2026-03-20' },
  ],
  HistoricalLocations: [
    { id: 1, time: '2026-03-20T08:00Z', thing_id: '1', commit_id: 'c4', systemTimeValidity: '2026-03-20' },
  ],
  Sensors: [
    { id: 1, name: 'SENS-TEMP-01', description: 'thermistor-r1', encodingType: 'application/pdf', metadata: 'http://istsos.org/def/sensor/temp', properties: { precision: '0.1' }, commit_id: 'c5' },
  ],
  Datastreams: [
    { id: 1, name: 'STS-DAT-001', description: 'PM2.5 primary stream', unitOfMeasurement: '{"name":"PM2.5","symbol":"ug/m3"}', observationType: 'http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement', fenomenonTime: '2026-03-01/2026-03-20', resultTime: '2026-03-20', properties: { sampling: '300s' }, thing_id: '1', sensor_id: '1', observed_property_id: '1' },
  ],
  ObservedProperties: [
    { id: 1, name: 'PM2.5', definition: 'urn:ogc:def:phenomenon:pm25', description: 'Particulates', properties: { domain: 'air_quality' }, commit_id: 'c6' },
  ],
  FeaturesOfInterest: [
    { id: 1, name: 'FOI-AQM-01', description: 'Sampling point at campus', encodingType: 'application/vnd.geo+json', feature: '{"type":"Point","coordinates":[8.956,46.005]}', properties: { type: 'SamplingPoint' }, commit_id: 'c7' },
  ],
}

export const TABLE_COLUMNS: Record<EntityType, { label: string; key: string }[]> = {
  Things: [
    { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Properties', key: 'properties' }, { label: 'SystemTime', key: 'systemTimeValidity' },
  ],
  Locations: [
    { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Encoding', key: 'encodingType' }, { label: 'Location', key: 'location' }, { label: 'Properties', key: 'properties' },
  ],
  HistoricalLocations: [
    { label: 'ID', key: 'id' }, { label: 'Time', key: 'time' }, { label: 'Thing', key: 'thing_id' }, { label: 'SystemTime', key: 'systemTimeValidity' },
  ],
  Sensors: [
    { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Encoding', key: 'encodingType' }, { label: 'Metadata', key: 'metadata' },
  ],
  Datastreams: [
    { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Unit', key: 'unitOfMeasurement' }, { label: 'Obs.Type', key: 'observationType' }, { label: 'PhenomenonTime', key: 'phenomenonTime' }, { label: 'Thing', key: 'thing_id' },
  ],
  ObservedProperties: [
    { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Definition', key: 'definition' }, { label: 'Description', key: 'description' }, { label: 'Properties', key: 'properties' },
  ],
  FeaturesOfInterest: [
    { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Encoding', key: 'encodingType' }, { label: 'Feature', key: 'feature' },
  ],
}

export const CHART_H = 96
export const PERIOD_BARS: Record<Period, BarEntry[]> = {
  Day: [
    { label: '00:00', count: 0 }, { label: '02:00', count: 0 }, { label: '04:00', count: 1 },
    { label: '06:00', count: 0 }, { label: '08:00', count: 2 }, { label: '10:00', count: 3 },
    { label: '12:00', count: 1 }, { label: '14:00', count: 0 }, { label: '16:00', count: 2 },
    { label: '18:00', count: 0 }, { label: '20:00', count: 1 }, { label: '22:00', count: 0 },
  ],
  Week: [
    { label: 'Mon', count: 2 }, { label: 'Tue', count: 5 }, { label: 'Wed', count: 1 },
    { label: 'Thu', count: 0 }, { label: 'Fri', count: 3 }, { label: 'Sat', count: 0 },
    { label: 'Sun', count: 1 },
  ],
  Month: [
    { label: 'Mar 01', count: 2 }, { label: 'Mar 04', count: 0 }, { label: 'Mar 07', count: 5 },
    { label: 'Mar 10', count: 1 }, { label: 'Mar 13', count: 0 }, { label: 'Mar 16', count: 3 },
    { label: 'Mar 19', count: 2 }, { label: 'Mar 21', count: 4 },
  ],
}
