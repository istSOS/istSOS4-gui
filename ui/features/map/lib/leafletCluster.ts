// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
export function createClusterGroup({
  L,
  color,
  borderColor,
  options,
}: {
  L: {
    markerClusterGroup: (options: Record<string, unknown>) => unknown
    divIcon: (options: Record<string, unknown>) => unknown
    point: (x: number, y: number) => unknown
  }
  color: string | ((cluster: unknown) => string)
  borderColor?: string | ((cluster: unknown) => string)
  options?: Partial<{
    spiderfyDistanceMultiplier: number
    maxClusterRadius: number
    disableClusteringAtZoom: number
  }> &
    Record<string, unknown>
}): {
  on: (event: string, handler: (event: unknown) => void) => void
  addLayer: (layer: unknown) => void
  clearLayers?: () => void
  off?: () => void
  remove?: () => void
  refreshClusters?: () => void
} {
  return L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,

    spiderfyDistanceMultiplier: 1.2,

    ...(options ?? {}),

    iconCreateFunction: (cl: unknown) => {
      const cluster = cl as { getChildCount: () => number }
      const total = cluster.getChildCount()
      const size = total < 10 ? 'small' : total < 100 ? 'medium' : 'large'
      const resolvedColor = typeof color === 'function' ? color(cluster) : color
      const resolvedBorderColor =
        typeof borderColor === 'function'
          ? borderColor(cluster)
          : borderColor ?? '#ffffff'

      return L.divIcon({
        html: `<div class="marker-cluster-net-inner" style="background:${resolvedColor}; border: 3px solid ${resolvedBorderColor}; box-sizing: border-box;"><span>${total}</span></div>`,
        className: `marker-cluster marker-cluster-${size} marker-cluster-net`,
        iconSize: L.point(40, 40),
      })
    },
  }) as {
    on: (event: string, handler: (event: unknown) => void) => void
    addLayer: (layer: unknown) => void
    clearLayers?: () => void
    off?: () => void
    remove?: () => void
    refreshClusters?: () => void
  }
}

export function createThingMarkerIcon(
  L: {
    icon: (options: Record<string, unknown>) => unknown
  },
  color: string,
  borderColor: string
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41">
      <path d="M12.5 0.8C6.54 0.8 1.7 5.64 1.7 11.6c0 2.64 1.46 5.96 2.57 8L12.5 40.2l8.23-20.6c1.12-2.04 2.57-5.36 2.57-8 0-5.96-4.84-10.8-10.8-10.8z" fill="${color}" stroke="${borderColor}" stroke-width="2.2"/>
      <circle cx="12.5" cy="11.6" r="4.1" fill="#ffffff"/>
    </svg>
  `
  const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  return L.icon({
    iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    tooltipAnchor: [1, -34],
  })
}

export function showClusterHullPreview({
  L,
  map,
  clusterLayer,
  color,
  durationMs = 1800,
}: {
  L: {
    polygon: (hull: unknown[], options: Record<string, unknown>) => {
      addTo: (map: unknown) => void
    }
  }
  map: {
    removeLayer: (layer: unknown) => void
  } & {
    __clusterHullPreviewLayer?: unknown
    __clusterHullPreviewTimer?: ReturnType<typeof setTimeout> | null
  }
  clusterLayer: {
    getConvexHull?: () => unknown[]
  }
  color: string
  durationMs?: number
}) {
  if (!L || !map || !clusterLayer) return

  const mapState = map
  const hull = clusterLayer.getConvexHull?.()
  if (!Array.isArray(hull) || hull.length < 3) return

  if (mapState.__clusterHullPreviewLayer) {
    try {
      map.removeLayer(mapState.__clusterHullPreviewLayer)
    } catch {}
    mapState.__clusterHullPreviewLayer = null
  }

  if (mapState.__clusterHullPreviewTimer) {
    clearTimeout(mapState.__clusterHullPreviewTimer)
    mapState.__clusterHullPreviewTimer = null
  }

  const previewLayer = L.polygon(hull, {
    color,
    weight: 2,
    opacity: 0.9,
    fillColor: color,
    fillOpacity: 0.16,
    dashArray: '6 4',
    interactive: false,
  })

  previewLayer.addTo(map)
  mapState.__clusterHullPreviewLayer = previewLayer

  mapState.__clusterHullPreviewTimer = setTimeout(() => {
    if (mapState.__clusterHullPreviewLayer) {
      try {
        map.removeLayer(mapState.__clusterHullPreviewLayer)
      } catch {}
      mapState.__clusterHullPreviewLayer = null
    }
    mapState.__clusterHullPreviewTimer = null
  }, durationMs)
}
