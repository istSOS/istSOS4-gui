import proj4 from 'proj4'

const EPSG_2056 =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +units=m +no_defs'
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs'

proj4.defs('EPSG:2056', EPSG_2056)

function parseCoordinateString(value?: string) {
  if (!value) return null

  const parts = value.split(',').map((entry) => Number(entry.trim()))
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
    return null
  }

  return parts as [number, number]
}

export function formatLv95Coordinates(east: number, north: number) {
  return `${east.toFixed(2)}, ${north.toFixed(2)}`
}

export function wgs84ToLv95(latitude: number, longitude: number) {
  const [east, north] = proj4(WGS84, 'EPSG:2056', [longitude, latitude])
  return { east, north }
}

export function lv95ToWgs84(east: number, north: number) {
  const [longitude, latitude] = proj4('EPSG:2056', WGS84, [east, north])
  return { latitude, longitude }
}

export function formatLv95FromWgs84(latitude: number, longitude: number) {
  const { east, north } = wgs84ToLv95(latitude, longitude)
  return formatLv95Coordinates(east, north)
}

export function parseLv95String(value?: string) {
  const parsed = parseCoordinateString(value)
  if (!parsed) return null

  const [east, north] = parsed
  return { east, north }
}
