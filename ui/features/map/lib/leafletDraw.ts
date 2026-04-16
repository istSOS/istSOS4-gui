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
import { createClusterGroup } from './leafletCluster'

const EPSG_2056 =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +units=m +no_defs'
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs'

const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#7c3aed',
  '#db2777',
  '#0ea5e9',
  '#84cc16',
  '#f59e0b',
  '#14b8a6',
]
const TOOLTIP_VERTICAL_OFFSET = -14

export const UNSPECIFIED_NETWORK_KEY = '__unspecified__'

type TooltipLabels = {
  unspecifiedNetwork: string
  sameLocation: string
  dataSource: string
  network: string
  things: string
}

type TooltipRow = {
  source: string
  name: string
  network: string
}

export function networkKey(name: any) {
  return String(name ?? '').trim() || UNSPECIFIED_NETWORK_KEY
}

function buildNetworkColorMap(keys: string[]) {
  const sortedKeys = [...keys].sort((a, b) => {
    if (a === UNSPECIFIED_NETWORK_KEY) return 1
    if (b === UNSPECIFIED_NETWORK_KEY) return -1
    return a.localeCompare(b)
  })

  const availableColors = PALETTE.filter((color) => color !== '#f59e0b')
  const colorMap = new Map<string, string>()
  let nextColorIndex = 0

  for (const key of sortedKeys) {
    if (key === UNSPECIFIED_NETWORK_KEY) {
      colorMap.set(key, '#f59e0b')
      continue
    }

    colorMap.set(key, availableColors[nextColorIndex % availableColors.length])
    nextColorIndex += 1
  }

  return colorMap
}

function thingSourceKey(thing: any) {
  return String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')
}

function thingSourceLabel(thing: any) {
  const sourceName = String(thing?.__sourceName ?? '').trim()
  const sourceId = String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0').trim()

  if (sourceName) {
    return sourceName
  }

  return sourceId || '0'
}

function thingDisplayName(thing: any) {
  return String(thing?.name ?? '').trim() || 'Unnamed thing'
}

function resolveTooltipLabels(labels?: TooltipLabels): TooltipLabels {
  return {
    unspecifiedNetwork: labels?.unspecifiedNetwork ?? 'Unspecified',
    sameLocation: labels?.sameLocation ?? 'Same location',
    dataSource: labels?.dataSource ?? 'Data source',
    network: labels?.network ?? 'Network',
    things: labels?.things ?? 'Things',
  }
}

function buildTooltipMount(
  rows: TooltipRow[],
  labels?: TooltipLabels,
  options?: {
    heading?: string
    showSource?: boolean
  }
) {
  const t = resolveTooltipLabels(labels)
  const showSource = options?.showSource ?? false

  const mount = document.createElement('div')
  mount.className = 'thing-tooltip-card'

  if (options?.heading) {
    const heading = document.createElement('div')
    heading.className = 'thing-tooltip-heading'
    heading.textContent = options.heading
    mount.appendChild(heading)
  }

  for (const rowData of rows) {
    const networkLabel =
      rowData.network === UNSPECIFIED_NETWORK_KEY || !rowData.network
        ? t.unspecifiedNetwork
        : rowData.network

    const row = document.createElement('div')
    row.className = 'thing-tooltip-row'

    const title = document.createElement('div')
    title.className = 'thing-tooltip-name'
    title.textContent = rowData.name

    const details = document.createElement('div')
    details.className = 'thing-tooltip-meta'

    if (showSource) {
      const sourceLine = document.createElement('div')
      sourceLine.className = 'thing-tooltip-meta-line'
      sourceLine.textContent = `${t.dataSource}: ${rowData.source}`
      details.appendChild(sourceLine)
    }

    const networkLine = document.createElement('div')
    networkLine.className = 'thing-tooltip-meta-line'
    networkLine.textContent = `${t.network}: ${networkLabel}`
    details.appendChild(networkLine)

    row.appendChild(title)
    row.appendChild(details)
    mount.appendChild(row)
  }

  return mount
}

function bindSelectThing(
  layer: any,
  thing: any,
  onThingSelect?: (t: any) => void
) {
  if (!onThingSelect) return
  layer.on('click', (e: any) => {
    e.originalEvent?.preventDefault?.()
    e.originalEvent?.stopPropagation?.()
    onThingSelect(thing)
  })
}

function bindHeroTooltip(
  layer: any,
  thing: any,
  options?: {
    labels?: TooltipLabels
  }
) {
  const name = thingDisplayName(thing)
  if (!name) return

  const mount = buildTooltipMount(
    [
      {
        source: thingSourceLabel(thing),
        name,
        network: String(thing?.Datastreams?.[0]?.Network?.name ?? '').trim(),
      },
    ],
    options?.labels,
    {
      showSource: true,
    }
  )

  layer.bindTooltip(mount, {
    sticky: false,
    interactive: false,
    direction: 'top',
    offset: [0, TOOLTIP_VERTICAL_OFFSET],
    opacity: 1,
    className: 'thing-tooltip',
  })
}

function makeTextMarker(L: any, latlng: [number, number], text: string) {
  const html = `<div class="thing-value-wrap"><span class="thing-value-text">${escapeHtml(
    text
  )}</span></div>`

  const icon = L.divIcon({
    className: 'thing-value-icon',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })

  const m = L.marker(latlng, { icon, interactive: true })
  m.setZIndexOffset?.(1000)
  return m
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function latestObservationOfDatastream(ds: any): any | null {
  const obsArr = Array.isArray(ds?.Observations) ? ds.Observations : []
  if (!obsArr.length) return null

  let best: any = null
  let bestT = -Infinity

  for (const obs of obsArr) {
    const t = obs?.resultTime ? Date.parse(obs.resultTime) : NaN
    if (!Number.isFinite(t)) continue
    if (t > bestT) {
      bestT = t
      best = obs
    }
  }
  return best
}

function valueTextForDatastream(ds: any): string | null {
  const obs = latestObservationOfDatastream(ds)
  if (!obs) return null

  const val = obs?.result
  if (val === undefined || val === null) return null

  const uom = ds?.unitOfMeasurement?.symbol ?? ds?.unitOfMeasurement?.name
  const v =
    typeof val === 'number' ? String(Math.round(val * 100) / 100) : String(val)

  return uom ? `${v} ${uom}` : v
}

export function drawNetworkLayers(args: {
  L: any
  proj4: any
  map: any
  things: any[]
  isThingVisible?: (thing: any) => boolean
  selectedNetwork?: string

  networkLayers: Map<string, { cluster: any; vectors: any }>
  overlayWrappersRef: { current: Map<string, any> }
  enabledRef: { current: Map<string, boolean> }
  didInitVisibilityRef: { current: boolean }
  onNetworksMeta?: (
    items: Array<{ key: string; color: string; enabled: boolean }>
  ) => void

  observedOverlay: any
  observedCluster: any
  observedPropertyFilter?: Set<string>

  labels?: TooltipLabels
  onThingSelect?: (thing: any) => void
}) {
  const {
    L,
    proj4,
    map,
    things,
    isThingVisible,
    selectedNetwork,

    networkLayers,
    overlayWrappersRef,
    enabledRef,
    didInitVisibilityRef,
    onNetworksMeta,

    observedCluster,
    observedPropertyFilter,

    labels,
    onThingSelect,
  } = args

  const toLatLng = (x: number, y: number): [number, number] | null => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const [lng, lat] = proj4(EPSG_2056, WGS84, [x, y])
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
  }

  const isObservedMode =
    !!observedPropertyFilter && observedPropertyFilter.size > 0

  try {
    observedCluster?.clearLayers?.()
  } catch {}

  if (isObservedMode) {
    for (const thing of things) {
      const geom = thing?.Locations?.[0]?.location
      if (!geom) continue

      let centerLL: [number, number] | null = null

      if (geom.type === 'Point') {
        const [x, y] = geom.coordinates ?? []
        centerLL = toLatLng(x, y)
      } else if (geom.type === 'LineString') {
        const latlngs = (geom.coordinates ?? [])
          .map(([x, y]: [number, number]) => toLatLng(x, y))
          .filter(Boolean) as [number, number][]
        if (latlngs.length >= 2) {
          try {
            const l = L.polyline(latlngs)
            const c = l.getBounds().getCenter()
            centerLL = [c.lat, c.lng]
          } catch {}
        }
      } else if (geom.type === 'Polygon') {
        const rings = (geom.coordinates ?? [])
          .map((ring: [number, number][]) =>
            ring.map(([x, y]) => toLatLng(x, y)).filter(Boolean)
          )
          .map((ring: any[]) => ring as [number, number][])
          .filter((ring) => ring.length >= 3)
        if (rings.length) {
          try {
            const p = L.polygon(rings)
            const c = p.getBounds().getCenter()
            centerLL = [c.lat, c.lng]
          } catch {}
        }
      }

      if (!centerLL) continue

      const dss = Array.isArray(thing?.Datastreams) ? thing.Datastreams : []
      for (const ds of dss) {
        const opName = ds?.ObservedProperty?.name
        if (typeof opName !== 'string') continue
        const sourceKey = String(
          ds?.__sourceId ?? thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0'
        )
        const observedPropertyKey = `${sourceKey}||${opName.trim()}`
        if (!observedPropertyFilter!.has(observedPropertyKey)) continue

        const text = valueTextForDatastream(ds)
        if (!text) continue

        const t = makeTextMarker(L, centerLL, text)
        bindSelectThing(t, thing, onThingSelect)
        observedCluster.addLayer(t)
      }
    }

    return
  }

  const networks = new Set<string>()
  for (const t of things)
    networks.add(networkKey(t?.Datastreams?.[0]?.Network?.name))
  const networkKeys = Array.from(networks)
  const networkColors = buildNetworkColorMap(networkKeys)

  for (const [netKey, grp] of networkLayers) {
    if (networks.has(netKey)) continue
    grp.cluster?.clearLayers?.()
    grp.cluster?.off?.()
    grp.cluster?.remove?.()
    grp.vectors?.clearLayers?.()
    grp.vectors?.remove?.()
    networkLayers.delete(netKey)

    overlayWrappersRef.current.get(netKey)?.remove?.()
    overlayWrappersRef.current.delete(netKey)
    enabledRef.current.delete(netKey)
  }

  for (const netKey of networks) {
    if (networkLayers.has(netKey)) continue

    const color = networkColors.get(netKey) ?? PALETTE[0]
    const cluster = createClusterGroup({ L, color })
    const vectors = L.layerGroup()

    cluster.on('clusterclick', (e: any) => {
      e.originalEvent?.preventDefault?.()
      e.originalEvent?.stopPropagation?.()
      e.layer?.closeTooltip?.()
      e.layer?.unbindTooltip?.()
      e.layer?.spiderfy?.()
    })

    cluster.on('clustermouseover', (e: any) => {
      const clusterLayer = e.layer
      const childMarkers = clusterLayer?.getAllChildMarkers?.() ?? []
      const dedup = new Map<string, TooltipRow>()

      for (const child of childMarkers) {
        const row = (child as any)?.__tooltipRow as TooltipRow | undefined
        if (!row) continue

        const key = `${row.source}::${row.name}::${row.network}`
        if (!dedup.has(key)) dedup.set(key, row)
      }

      if (!dedup.size) return

      const rows = Array.from(dedup.values()).sort((a, b) => {
        const sourceCompare = a.source.localeCompare(b.source)
        if (sourceCompare !== 0) return sourceCompare
        return a.name.localeCompare(b.name)
      })

      const resolvedLabels = resolveTooltipLabels(labels)
      const showSource =
        rows.length === 1 || new Set(rows.map((row) => row.source)).size > 1
      const mount = buildTooltipMount(rows, resolvedLabels, {
        showSource,
      })

      clusterLayer.unbindTooltip?.()
      clusterLayer.bindTooltip(mount, {
        sticky: false,
        interactive: false,
        direction: 'top',
        offset: [0, TOOLTIP_VERTICAL_OFFSET],
        opacity: 1,
        className: 'thing-tooltip',
      })
      clusterLayer.openTooltip?.()
    })

    cluster.on('clustermouseout', (e: any) => {
      const clusterLayer = e.layer
      clusterLayer.closeTooltip?.()
      clusterLayer.unbindTooltip?.()
    })

    networkLayers.set(netKey, { cluster, vectors })
  }

  for (const [netKey, grp] of networkLayers) {
    if (!overlayWrappersRef.current.has(netKey)) {
      const wrapper = L.layerGroup([grp.cluster, grp.vectors])
      overlayWrappersRef.current.set(netKey, wrapper)
    }
  }

  if (selectedNetwork || !didInitVisibilityRef.current) {
    const selectedKey = selectedNetwork
      ? networkKey(selectedNetwork)
      : undefined

    for (const netKey of networks) {
      const shouldOn = selectedKey ? netKey === selectedKey : true
      enabledRef.current.set(netKey, shouldOn)

      const wrapper = overlayWrappersRef.current.get(netKey)
      if (!wrapper) continue
      shouldOn ? map.addLayer(wrapper) : map.removeLayer(wrapper)
    }
    didInitVisibilityRef.current = true
  } else {
    for (const netKey of networks) {
      if (enabledRef.current.has(netKey)) continue
      enabledRef.current.set(netKey, true)
      const wrapper = overlayWrappersRef.current.get(netKey)
      if (wrapper) map.addLayer(wrapper)
    }
  }

  for (const { cluster, vectors } of networkLayers.values()) {
    cluster.clearLayers()
    vectors.clearLayers()
  }

  for (const thing of things) {
    if (isThingVisible && !isThingVisible(thing)) continue
    const geom = thing?.Locations?.[0]?.location
    if (!geom) continue

    const netKey = networkKey(thing?.Datastreams?.[0]?.Network?.name)
    const grp = networkLayers.get(netKey)
    if (!grp) continue

    const base = networkColors.get(netKey) ?? PALETTE[0]

    if (geom.type === 'Point') {
      const [x, y] = geom.coordinates ?? []
      const ll = toLatLng(x, y)
      if (!ll) continue

      const m = L.circleMarker(ll, {
        radius: 8,
        color: base,
        fillColor: base,
        fillOpacity: 0.85,
        weight: 2,
      })

      ;(m as any).__tooltipRow = {
        source: thingSourceLabel(thing),
        name: thingDisplayName(thing),
        network: String(thing?.Datastreams?.[0]?.Network?.name ?? '').trim(),
      } as TooltipRow

      bindHeroTooltip(m, thing, { labels })
      bindSelectThing(m, thing, onThingSelect)
      grp.cluster.addLayer(m)
      continue
    }

    if (geom.type === 'LineString') {
      const latlngs = (geom.coordinates ?? [])
        .map(([x, y]: [number, number]) => toLatLng(x, y))
        .filter(Boolean) as [number, number][]

      if (latlngs.length < 2) continue

      const l = L.polyline(latlngs, {
        color: base,
        weight: 3,
        opacity: 0.8,
      })

      bindHeroTooltip(l, thing, { labels })
      bindSelectThing(l, thing, onThingSelect)
      grp.vectors.addLayer(l)
      continue
    }

    if (geom.type === 'Polygon') {
      const rings = (geom.coordinates ?? [])
        .map((ring: [number, number][]) =>
          ring.map(([x, y]) => toLatLng(x, y)).filter(Boolean)
        )
        .map((ring: any[]) => ring as [number, number][])
        .filter((ring) => ring.length >= 3)

      if (!rings.length) continue

      const p = L.polygon(rings, {
        color: base,
        weight: 2,
        fillColor: base,
        fillOpacity: 0.25,
      })

      bindHeroTooltip(p, thing, { labels })
      bindSelectThing(p, thing, onThingSelect)
      grp.vectors.addLayer(p)
      continue
    }
  }

  for (const [netKey, grp] of networkLayers) {
    const enabled = enabledRef.current.get(netKey) !== false
    if (enabled) grp.cluster.refreshClusters?.()
  }

  onNetworksMeta?.(
    networkKeys.map((key) => ({
      key,
      color: networkColors.get(key) ?? PALETTE[0],
      enabled: enabledRef.current.get(key) !== false,
    }))
  )
}
