'use client'

import { BasemapKey } from '@/types'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'

import { BASEMAPS } from '@/config/site'

import LayersControl, { ToggleItem } from './LayersControl'
import MapContextMenu from './MapContextMenu'
import { createClusterGroup } from '../lib/leafletCluster'
import { drawNetworkLayers } from '../lib/leafletDraw'
import MapMenu from './MapMenu'

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

      selectedNetwork: isObservedMode ? undefined : selectedNetwork,

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
  }, [thingsArr, selectedNetwork])

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
    const map = mapRef.current
    if (!map) return

    for (const [netKey, wrapper] of overlayWrappersRef.current.entries()) {
      enabledRef.current.set(netKey, nextEnabled)
      try {
        nextEnabled ? map.addLayer(wrapper) : map.removeLayer(wrapper)
      } catch {}
    }
    setNetworksMeta((prev) => prev.map((n) => ({ ...n, enabled: nextEnabled })))
  }

  const onToggleNetwork = (key: string, nextEnabled: boolean) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    const map = mapRef.current
    const wrapper = overlayWrappersRef.current.get(key)
    if (!map || !wrapper) return

    enabledRef.current.set(key, nextEnabled)
    nextEnabled ? map.addLayer(wrapper) : map.removeLayer(wrapper)

    setNetworksMeta((prev) =>
      prev.map((it) => (it.key === key ? { ...it, enabled: nextEnabled } : it))
    )
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

  const networksForUI = networksMeta

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
        networks={networksForUI}
        observedProps={observedPropsMeta}
        onToggleNetwork={onToggleNetwork}
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
