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
export type SelectableMapLayer = {
  __thingKey?: string
  __selected?: boolean
  options?: { icon?: { options?: { className?: string } } }
  getElement?: () => Element | null
  setZIndexOffset?: (offset: number) => void
}

export function setMarkerSelected(
  layer: SelectableMapLayer,
  selected: boolean
) {
  layer.__selected = selected
  // MarkerCluster can recreate the element after an add or a refresh.
  // Keep the icon's stored classes in sync with the visible element.
  const icon = layer.options?.icon?.options
  if (icon) {
    const classes = (icon.className ?? '')
      .split(/\s+/)
      .filter((name) => name && name !== 'map-marker-selected')
    if (selected) classes.push('map-marker-selected')
    icon.className = classes.join(' ')
  }
  layer.getElement?.()?.classList.toggle('map-marker-selected', selected)
  layer.setZIndexOffset?.(selected ? 1000 : 0)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function markerWarningHtml(label: string) {
  return `<span class="map-marker-warning" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">!</span>`
}

export function snapshotLabelHtml(label?: string | null) {
  return label
    ? `<span class="map-snapshot-label">${escapeHtml(label)}</span>`
    : ''
}

export function createClusterGroup({
  L,
  warningLabel = 'Some readings are delayed',
  options,
}: {
  L: {
    markerClusterGroup: (options: Record<string, unknown>) => unknown
    divIcon: (options: Record<string, unknown>) => unknown
    point: (x: number, y: number) => unknown
  }
  warningLabel?: string
  options?: Partial<{
    spiderfyDistanceMultiplier: number
    maxClusterRadius: number
    disableClusteringAtZoom: number
  }> &
    Record<string, unknown>
}): {
  on: (event: string, handler: (event: unknown) => void) => void
  addLayer: (layer: unknown) => void
  eachLayer?: (callback: (layer: SelectableMapLayer) => void) => void
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
      const cluster = cl as {
        getChildCount: () => number
        getAllChildMarkers?: () => Array<
          SelectableMapLayer & { __freshnessStatus?: string }
        >
      }
      const total = cluster.getChildCount()
      const children = cluster.getAllChildMarkers?.() ?? []
      const warning = children.some((child) =>
        ['stale', 'mixed'].includes(child.__freshnessStatus)
      )
      const selected = children.some((child) => child.__selected)
      const size = total < 100 ? 32 : 38
      return L.divIcon({
        html: `<span class="map-cluster-count">${total}</span>${warning ? markerWarningHtml(warningLabel) : ''}`,
        className: `map-cluster-icon${selected ? ' map-marker-selected' : ''}`,
        iconSize: L.point(size, size),
        iconAnchor: L.point(size / 2, size / 2),
      })
    },
  }) as ReturnType<typeof createClusterGroup>
}

export function createThingMarkerIcon(
  L: { divIcon: (options: Record<string, unknown>) => unknown },
  color: string,
  {
    warning,
    snapshotLabel,
    value,
  }: {
    warning?: string
    snapshotLabel?: string
    value?: { text: string; description: string }
  } = {}
) {
  return L.divIcon({
    html: `<span class="map-station-dot" style="--map-source-color:${escapeHtml(color)}">${warning ? markerWarningHtml(warning) : ''}</span>${snapshotLabelHtml(snapshotLabel)}${value ? `<button type="button" class="map-station-value" aria-label="${escapeHtml(value.description)}" style="--map-source-color:${escapeHtml(color)}"><span>${escapeHtml(value.text)}</span></button>` : ''}`,
    className: 'map-station-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [0, -8],
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
    polygon: (
      hull: unknown[],
      options: Record<string, unknown>
    ) => {
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
