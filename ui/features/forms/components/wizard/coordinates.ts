// Location coordinates in the wizard are handled in WGS84 (EPSG:4326) and
// persisted as GeoJSON [longitude, latitude] pairs without a crs.

const COORDINATE_DECIMALS = 6

function parseCoordinatePair(value?: string): [number, number] | null {
  if (!value) return null

  const parts = value.split(',').map((entry) => Number(entry.trim()))
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
    return null
  }

  return parts as [number, number]
}

// Parses a "longitude, latitude" string into WGS84 coordinates.
export function parseLonLatString(value?: string) {
  const parsed = parseCoordinatePair(value)
  if (!parsed) return null

  const [longitude, latitude] = parsed
  return { longitude, latitude }
}

// Formats a WGS84 longitude/latitude pair as the "lon, lat" field string.
export function formatLonLat(longitude: number, latitude: number) {
  return `${longitude.toFixed(COORDINATE_DECIMALS)}, ${latitude.toFixed(
    COORDINATE_DECIMALS
  )}`
}
