import type { SelectableMapLayer } from './leafletCluster'

type Position = { lat: number; lng: number }
type FocusLayer = SelectableMapLayer & {
  getLatLng?: () => Position
  getBounds?: () => {
    getCenter: () => Position
    getSouthWest?: () => Position
    getNorthEast?: () => Position
    isValid?: () => boolean
  }
  _preSpiderfyLatlng?: Position
}

/** Fit the actual rendered Things, including clustered points and vector extents. */
export function fitThingsOnMap(
  map: Pick<FocusMap, 'stop' | 'fitBounds' | 'getMaxZoom'>,
  groups: MapFocusGroup[],
  animate = true,
  thingKeys?: ReadonlySet<string>
) {
  const positions: [number, number][] = []
  const add = (position?: Position) => {
    if (
      position &&
      Number.isFinite(position.lat) &&
      Number.isFinite(position.lng)
    ) {
      positions.push([position.lat, position.lng])
    }
  }
  for (const group of groups) {
    group.eachLayer?.((layer) => {
      if (!layer.__thingKey || (thingKeys && !thingKeys.has(layer.__thingKey)))
        return
      const position = layer._preSpiderfyLatlng ?? layer.getLatLng?.()
      if (position) add(position)
      else {
        const bounds = layer.getBounds?.()
        if (bounds && bounds.isValid?.() !== false) {
          add(bounds.getSouthWest?.())
          add(bounds.getNorthEast?.())
        }
      }
    })
  }
  if (positions.length === 0) return false
  map.stop()
  map.fitBounds(positions, {
    padding: [64, 64],
    maxZoom: Math.min(map.getMaxZoom(), 15),
    animate,
  })
  return true
}
export type MapFocusGroup = {
  eachLayer?: (callback: (layer: FocusLayer) => void) => void
  zoomToShowLayer?: (layer: FocusLayer, callback: () => void) => void
}
type FocusMap = {
  getZoom: () => number
  getMaxZoom: () => number
  stop: () => void
  setView: (
    center: [number, number],
    zoom: number,
    options?: { animate: boolean }
  ) => void
  fitBounds: (
    bounds: unknown,
    options: { padding: [number, number]; maxZoom: number; animate: boolean }
  ) => void
}

/** Focus a rendered layer so snapshot positions and source visibility stay authoritative. */
export function focusThingOnMap(
  map: FocusMap,
  groups: MapFocusGroup[],
  thingKey: string
) {
  for (const group of groups) {
    let target: FocusLayer | undefined
    group.eachLayer?.((layer) => {
      if (!target && layer.__thingKey === thingKey) target = layer
    })
    if (!target) continue
    const zoom = Math.min(map.getMaxZoom(), Math.max(map.getZoom(), 15))
    const position = target.getLatLng?.()
    if (
      position &&
      Number.isFinite(position.lat) &&
      Number.isFinite(position.lng)
    ) {
      map.stop()
      map.setView([position.lat, position.lng], zoom, { animate: true })
      // Reveal a point even when its station shares a cluster or location.
      group.zoomToShowLayer?.(target, () => {})
      return true
    }
    const bounds = target.getBounds?.()
    if (bounds && bounds.isValid?.() !== false) {
      map.stop()
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: zoom, animate: true })
      return true
    }
  }
  return false
}
