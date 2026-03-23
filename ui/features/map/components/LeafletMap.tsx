'use client'

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
import { BasemapKey } from '@/types'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'

import { BASEMAPS, siteConfig } from '@/config/site'

import LayersControl, { ToggleItem } from './LayersControl'
import MapContextMenu from './MapContextMenu'
import MapMenu from './MapMenu'

import { createClusterGroup } from '../lib/leafletCluster'
import { drawNetworkLayers, networkKey } from '../lib/leafletDraw'

function getThingKey(thing: any) {
  return String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
}

export default function LeafletMap({
  things,
  selectedNetwork,
  onThingSelect,
  onCreateThingAt,
}: {
  things: any[] | { value: any[] }
  selectedNetwork?: string
  onThingSelect?: (thing: any) => void
  onCreateThingAt?: (point: { latitude: number; longitude: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const proj4Ref = useRef<any>(null)

  const roRef = useRef<ResizeObserver | null>(null)

  const tileLayerRef = useRef<any>(null)
  const [basemap, setBasemap] = useState<BasemapKey>('pixelGray')

  const networkLayersRef = useRef<Map<string, { cluster: any; vectors: any }>>(
    new Map()
  )
  const overlayWrappersRef = useRef<Map<string, any>>(new Map())
  const enabledRef = useRef<Map<string, boolean>>(new Map())
  const didInitVisibilityRef = useRef(false)
  const [networksMeta, setNetworksMeta] = useState<ToggleItem[]>([])

  const observedOverlayRef = useRef<any>(null)
  const observedClusterRef = useRef<any>(null)

  const [observedPropsMeta, setObservedPropsMeta] = useState<ToggleItem[]>([])
  const observedEnabledRef = useRef<Map<string, boolean>>(new Map())
  const [thingEnabled, setThingEnabled] = useState<Record<string, boolean>>({})
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    latitude: number
    longitude: number
  } | null>(null)

  const thingsArr = useMemo(() => {
    if (Array.isArray(things)) return things
    const v = (things as any)?.value
    return Array.isArray(v) ? v : []
  }, [things])

  useEffect(() => {
    setThingEnabled((prev) => {
      const next: Record<string, boolean> = {}

      for (const thing of thingsArr) {
        const key = getThingKey(thing)
        if (!key) continue
        next[key] = prev[key] ?? true
      }

      return next
    })
  }, [thingsArr])

  useEffect(() => {
    const set = new Set<string>()
    for (const t of thingsArr) {
      const dss = Array.isArray(t?.Datastreams) ? t.Datastreams : []
      for (const ds of dss) {
        const name = ds?.ObservedProperty?.name
        if (typeof name === 'string' && name.trim()) set.add(name.trim())
      }
    }
    const keys = Array.from(set).sort((a, b) => a.localeCompare(b))

    setObservedPropsMeta((prev) => {
      const prevEnabled = new Map(prev.map((p) => [p.key, p.enabled] as const))
      const next = keys.map((k) => ({
        key: k,
        enabled: prevEnabled.get(k) ?? false,
      }))
      observedEnabledRef.current = new Map(next.map((p) => [p.key, p.enabled]))
      return next
    })
  }, [thingsArr])

  const getActiveObservedProps = () => {
    const active = new Set<string>()
    for (const [k, en] of observedEnabledRef.current.entries()) {
      if (en) active.add(k)
    }
    return active
  }

  const isObservedMode = useMemo(() => {
    return observedPropsMeta.some((p) => p.enabled)
  }, [observedPropsMeta])

  const applyModeLayers = () => {
    const map = mapRef.current
    if (!map) return

    if (isObservedMode) {
      // hide networks overlay
      for (const wrapper of overlayWrappersRef.current.values()) {
        try {
          map.removeLayer(wrapper)
        } catch {}
      }
      // show observed overlay
      if (observedOverlayRef.current) {
        try {
          map.addLayer(observedOverlayRef.current)
        } catch {}
      }
    } else {
      // hide observed overlay
      if (observedOverlayRef.current) {
        try {
          map.removeLayer(observedOverlayRef.current)
        } catch {}
      }
      // show networks overlay respecting enabledRef
      for (const [key, wrapper] of overlayWrappersRef.current.entries()) {
        const enabled = enabledRef.current.get(key) !== false
        try {
          enabled ? map.addLayer(wrapper) : map.removeLayer(wrapper)
        } catch {}
      }
    }
  }

  const redraw = () => {
    const map = mapRef.current
    const L = LRef.current
    const proj4 = proj4Ref.current
    if (!map || !L || !proj4) return

    drawNetworkLayers({
      L,
      proj4,
      map,
      things: thingsArr,
      isThingVisible: (thing) => {
        const key = getThingKey(thing)
        return key ? thingEnabled[key] !== false : true
      },

      selectedNetwork:
        isObservedMode || !siteConfig.networkEnabled
          ? undefined
          : selectedNetwork,

      networkLayers: networkLayersRef.current,
      overlayWrappersRef: { current: overlayWrappersRef.current },
      enabledRef,
      didInitVisibilityRef,
      onNetworksMeta: setNetworksMeta,

      observedOverlay: observedOverlayRef.current,
      observedCluster: observedClusterRef.current,
      observedPropertyFilter: getActiveObservedProps(),

      onThingSelect,
    })
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const el = containerRef.current
      if (!el || mapRef.current) return

      const leafletMod: any = await import('leaflet')
      const proj4Mod: any = await import('proj4')
      await import('leaflet.markercluster')

      if (!mounted) return

      const L = leafletMod?.default ?? leafletMod
      const proj4 = proj4Mod?.default ?? proj4Mod

      LRef.current = L
      proj4Ref.current = proj4

      const map = L.map(el, { preferCanvas: true }).setView([46.005, 8.956], 9)

      const bm = BASEMAPS[basemap]
      tileLayerRef.current = L.tileLayer(bm.url, {
        attribution: bm.attribution,
      })
      tileLayerRef.current.addTo(map)

      observedOverlayRef.current = L.layerGroup()
      observedClusterRef.current = createClusterGroup({
        L,
        color: '#ff0000',
        options: { spiderfyDistanceMultiplier: 2.6 },
      })

      observedClusterRef.current.on('clusterclick', (e: any) => {
        e.originalEvent?.preventDefault?.()
        e.originalEvent?.stopPropagation?.()
        e.layer?.spiderfy?.()
      })

      observedOverlayRef.current.addLayer(observedClusterRef.current)

      mapRef.current = map

      map.on('contextmenu', (e: any) => {
        const point = map.mouseEventToContainerPoint(e.originalEvent)
        setContextMenu({
          x: point.x,
          y: point.y,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        })
      })

      map.on('click', () => setContextMenu(null))
      map.on('movestart', () => setContextMenu(null))

      redraw()
      applyModeLayers()

      roRef.current = new ResizeObserver(() => map.invalidateSize())
      roRef.current.observe(el)
    })()

    return () => {
      mounted = false
      roRef.current?.disconnect()
      roRef.current = null

      try {
        observedClusterRef.current?.clearLayers?.()
        observedClusterRef.current?.off?.()
        observedClusterRef.current?.remove?.()
      } catch {}
      observedClusterRef.current = null

      try {
        observedOverlayRef.current?.clearLayers?.()
        observedOverlayRef.current?.remove?.()
      } catch {}
      observedOverlayRef.current = null

      for (const w of overlayWrappersRef.current.values()) w?.remove?.()
      overlayWrappersRef.current.clear()
      enabledRef.current.clear()

      for (const { cluster, vectors } of networkLayersRef.current.values()) {
        cluster?.clearLayers?.()
        cluster?.off?.()
        cluster?.remove?.()
        vectors?.clearLayers?.()
        vectors?.remove?.()
      }
      networkLayersRef.current.clear()

      try {
        tileLayerRef.current?.remove?.()
      } catch {}
      tileLayerRef.current = null

      mapRef.current?.remove?.()
      mapRef.current = null

      LRef.current = null
      proj4Ref.current = null
      didInitVisibilityRef.current = false
    }
  }, [])

  useEffect(() => {
    redraw()
  }, [thingsArr, selectedNetwork, thingEnabled])

  useEffect(() => {
    redraw()
  }, [observedPropsMeta])

  useEffect(() => {
    applyModeLayers()
  }, [isObservedMode])

  useEffect(() => {
    const map = mapRef.current
    const L = LRef.current
    if (!map || !L) return

    const bm = BASEMAPS[basemap]
    try {
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    } catch {}

    tileLayerRef.current = L.tileLayer(bm.url, { attribution: bm.attribution })
    tileLayerRef.current.addTo(map)
  }, [basemap])

  const setAllObservedProps = (nextEnabled: boolean) => {
    observedEnabledRef.current = new Map(
      observedPropsMeta.map((p) => [p.key, nextEnabled] as const)
    )
    setObservedPropsMeta((prev) =>
      prev.map((p) => ({ ...p, enabled: nextEnabled }))
    )
  }

  const setAllNetworks = (nextEnabled: boolean) => {
    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const thing of thingsArr) {
        const key = getThingKey(thing)
        if (!key) continue
        next[key] = nextEnabled
      }
      return next
    })
  }

  const onToggleNetwork = (key: string, nextEnabled: boolean) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    if (!siteConfig.networkEnabled) {
      setThingEnabled((prev) => ({
        ...prev,
        [key]: nextEnabled,
      }))
      return
    }

    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const thing of thingsArr) {
        if (networkKey(thing?.Datastreams?.[0]?.Network?.name) !== key) continue

        const thingKey = getThingKey(thing)
        if (!thingKey) continue
        next[thingKey] = nextEnabled
      }
      return next
    })
  }

  const onToggleAllNetworks = (nextEnabled: boolean) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }
    setAllNetworks(nextEnabled)
  }

  const onToggleObservedProperty = (key: string, nextEnabled: boolean) => {
    if (nextEnabled) {
      setAllNetworks(false)
    }

    observedEnabledRef.current.set(key, nextEnabled)
    setObservedPropsMeta((prev) =>
      prev.map((it) => (it.key === key ? { ...it, enabled: nextEnabled } : it))
    )
  }

  const onToggleAllObservedProps = (nextEnabled: boolean) => {
    if (nextEnabled) {
      setAllNetworks(false)
    }
    setAllObservedProps(nextEnabled)
  }

  const onToggleNetworkThing = (
    _networkKeyValue: string,
    thingKey: string,
    nextEnabled: boolean
  ) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    setThingEnabled((prev) => ({
      ...prev,
      [thingKey]: nextEnabled,
    }))
  }

  const networksForUI = networksMeta
    .map((network) => {
      const details: Array<{ key: string; label: string; enabled: boolean }> = []

      for (const thing of thingsArr) {
        const key = networkKey(thing?.Datastreams?.[0]?.Network?.name)
        if (key !== network.key) continue

        const thingKey = getThingKey(thing)
        if (!thingKey) continue

        const label = String(thing?.name ?? '').trim() || 'Unnamed thing'
        details.push({
          key: thingKey,
          label,
          enabled: thingEnabled[thingKey] !== false,
        })
      }

      details.sort((a, b) => a.label.localeCompare(b.label))

      return {
        ...network,
        enabled: details.length > 0 ? details.every((detail) => detail.enabled) : false,
        details,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  const thingsForUI: ToggleItem[] = thingsArr
    .reduce<ToggleItem[]>((items, thing) => {
      const key = getThingKey(thing)
      if (!key) return items

      items.push({
        key,
        label: String(thing?.name ?? '').trim() || 'Unnamed thing',
        enabled: thingEnabled[key] !== false,
      })

      return items
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label))

  const primaryItems = siteConfig.networkEnabled
    ? networksForUI
    : thingsForUI

  const networksTitle = siteConfig.networkEnabled ? 'Networks' : 'Things'

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {contextMenu ? (
        <MapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onCenterHere={() => {
            mapRef.current?.setView(
              [contextMenu.latitude, contextMenu.longitude],
              mapRef.current?.getZoom?.() ?? 9
            )
            setContextMenu(null)
          }}
          onCreateThing={() => {
            onCreateThingAt?.({
              latitude: contextMenu.latitude,
              longitude: contextMenu.longitude,
            })
            setContextMenu(null)
          }}
          onZoomIn={() => {
            mapRef.current?.zoomIn?.()
            setContextMenu(null)
          }}
          onZoomOut={() => {
            mapRef.current?.zoomOut?.()
            setContextMenu(null)
          }}
        />
      ) : null}

      <LayersControl
        networks={primaryItems}
        observedProps={observedPropsMeta}
        networksTitle={networksTitle}
        networksGrouped={siteConfig.networkEnabled}
        onToggleNetwork={onToggleNetwork}
        onToggleNetworkThing={onToggleNetworkThing}
        onToggleObservedProperty={onToggleObservedProperty}
        onToggleAllNetworks={onToggleAllNetworks}
        onToggleAllObservedProps={onToggleAllObservedProps}
        networksDisabled={false}
        observedPropsDisabled={false}
      />

      <div className="absolute bottom-10 right-10 z-[2000]">
        <MapMenu active={basemap} onChange={setBasemap} />
      </div>
    </div>
  )
}
