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
import React from 'react'
import { type Root, createRoot } from 'react-dom/client'

import { createClusterGroup } from './leafletCluster'

import Tooltip from '../components/Tooltip'

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

export const UNSPECIFIED_NETWORK_KEY = '__unspecified__'

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

function bindHeroTooltip(layer: any, thing: any) {
  const name = String(thing?.name ?? '').trim()
  if (!name) return

  const network = String(thing?.Datastreams?.[0]?.Network?.name ?? '').trim()

  const mount = document.createElement('div')
  mount.style.display = 'inline-block'
  mount.style.minWidth = '160px'

  let root: Root | null = null

  layer.bindTooltip(mount, {
    sticky: true,
    direction: 'top',
    opacity: 1,
    className: 'thing-tooltip',
  })

  const render = () => {
    if (!root) root = createRoot(mount)
    root.render(
      React.createElement(Tooltip, {
        name,
        network: network,
      })
    )
  }

  const unmount = () => {
    try {
      root?.unmount()
    } catch {}
    root = null
    mount.innerHTML = ''
  }

  layer.on('tooltipopen', render)
  layer.on('tooltipclose', unmount)
  layer.on('remove', unmount)
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

  onThingSelect?: (thing: any) => void
}) {
  const {
    L,
    proj4,
    map,
    things,
    selectedNetwork,

    networkLayers,
    overlayWrappersRef,
    enabledRef,
    didInitVisibilityRef,
    onNetworksMeta,

    observedCluster,
    observedPropertyFilter,

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
        if (!observedPropertyFilter!.has(opName)) continue

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
      e.layer?.spiderfy?.()
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

      bindHeroTooltip(m, thing)
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

      bindHeroTooltip(l, thing)
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

      bindHeroTooltip(p, thing)
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
