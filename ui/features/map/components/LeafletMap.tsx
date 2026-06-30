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
import ImportFromFileButton from '@/features/datastreams/components/ImportFromFileButton'
import { BasemapKey } from '@/types'
import { Thing } from '@/types/domain'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { mapConfig } from '@/config/map'
import { BASEMAPS } from '@/config/site'

import LayersControl from './LayersControl'
import MapContextMenu from './MapContextMenu'
import MapMenu from './MapMenu'

import { buildLayerControlSources } from '../lib/layersControlData'
import {
  createClusterGroup,
  showClusterHullPreview,
} from '../lib/leafletCluster'
import {
  buildSourceColorMapWithOverrides,
  drawNetworkLayers,
  networkKey,
} from '../lib/leafletDraw'
import {
  ObservedToggleItem,
  buildObservedPropertyKey,
  getThingKey,
  getThingSourceKey,
  parseObservedPropertyKey,
} from '../lib/leafletMapHelpers'
import {
  getDominantSourceColor,
  getObservedClusterBorderColor,
} from '../lib/observedClusterStyle'

export default function LeafletMap({
  things,
  selectedNetwork,
  onThingSelect,
  onCreateThingAt,
}: {
  things: Thing[] | { value: Thing[] }
  selectedNetwork?: string
  onThingSelect?: (
    thing: Thing,
    selection?: { observedPropertyName?: string; datastreamId?: string }
  ) => void
  onCreateThingAt?: (point: { latitude: number; longitude: number }) => void
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)

  type ClusterPreviewMapState = {
    __clusterHullPreviewTimer?: ReturnType<typeof setTimeout> | null
    __clusterHullPreviewLayer?: { remove?: () => void } | null
  }
  type MapWithClusterPreview = {
    mouseEventToContainerPoint: (event: MouseEvent) => { x: number; y: number }
    setView: (center: [number, number], zoom: number) => void
    setZoom: (zoom: number) => void
    getZoom: () => number
    zoomIn: () => void
    zoomOut: () => void
    invalidateSize: () => void
    on: (event: string, handler: (...args: unknown[]) => void) => void
    off: () => void
    stop: () => void
    remove: () => void
    addLayer: (layer: unknown) => void
    removeLayer: (layer: unknown) => void
    setMinZoom: (zoom: number) => void
    setMaxZoom: (zoom: number) => void
    setMaxBounds: (bounds: unknown) => void
    panInsideBounds: (bounds: unknown, options?: { animate?: boolean }) => void
  } & ClusterPreviewMapState
  type LeafletFactory = {
    marker: (...args: unknown[]) => unknown
    divIcon: (...args: unknown[]) => unknown
    polyline: (...args: unknown[]) => unknown
    polygon: (...args: unknown[]) => unknown
    icon: (...args: unknown[]) => unknown
    point: (...args: unknown[]) => unknown
    markerClusterGroup: (...args: unknown[]) => unknown
    map: (
      element: HTMLElement,
      options: Record<string, unknown>
    ) => {
      setView: (center: [number, number], zoom: number) => MapWithClusterPreview
    }
    tileLayer: (
      url: string,
      options: Record<string, unknown>
    ) => { addTo: (map: MapWithClusterPreview) => void; remove?: () => void }
    layerGroup: () => {
      addLayer: (layer: unknown) => void
      clearLayers?: () => void
      remove?: () => void
    }
  }
  type Proj4Factory = (
    src: string,
    dst: string,
    point: [number, number]
  ) => [number, number]
  type ClusterLike = {
    clearLayers?: () => void
    off?: () => void
    remove?: () => void
    on: (event: string, handler: (...args: unknown[]) => void) => void
    addLayer: (layer: unknown) => void
  }
  type OverlayWrapper = { remove?: () => void }

  const mapRef = useRef<MapWithClusterPreview | null>(null)
  const LRef = useRef<LeafletFactory | null>(null)
  const proj4Ref = useRef<Proj4Factory | null>(null)

  const roRef = useRef<ResizeObserver | null>(null)

  const tileLayerRef = useRef<{
    addTo: (map: MapWithClusterPreview) => void
    remove?: () => void
  } | null>(null)
  const [basemap, setBasemap] = useState<BasemapKey>(mapConfig.defaultBasemap)

  const networkLayersRef = useRef<
    Map<
      string,
      {
        cluster: {
          clearLayers?: () => void
          off?: () => void
          remove?: () => void
        }
        vectors: { clearLayers?: () => void; remove?: () => void }
        color: string
      }
    >
  >(new Map())
  const overlayWrappersRef = useRef<Map<string, OverlayWrapper>>(new Map())
  const enabledRef = useRef<Map<string, boolean>>(new Map())
  const didInitVisibilityRef = useRef(false)

  const observedOverlayRef = useRef<{
    addLayer: (layer: unknown) => void
    clearLayers?: () => void
    remove?: () => void
  } | null>(null)
  const observedClusterRef = useRef<ClusterLike | null>(null)

  const [observedPropsMeta, setObservedPropsMeta] = useState<
    ObservedToggleItem[]
  >([])
  const observedEnabledRef = useRef<Map<string, boolean>>(new Map())
  const [thingEnabled, setThingEnabled] = useState<Record<string, boolean>>({})
  const [sourceColorByKey, setSourceColorByKey] = useState<
    Record<string, string>
  >({})
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    latitude: number
    longitude: number
  } | null>(null)

  const thingsArr = useMemo(() => {
    if (Array.isArray(things)) return things
    const v = things?.value
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
    const keyToLabel = new Map<string, string>()
    for (const t of thingsArr) {
      const sourceKey = getThingSourceKey(t)
      const dss = Array.isArray(t?.Datastreams) ? t.Datastreams : []
      for (const ds of dss) {
        const name = ds?.ObservedProperty?.name
        if (typeof name !== 'string' || !name.trim()) continue

        const observedKey = buildObservedPropertyKey(sourceKey, name)
        keyToLabel.set(observedKey, name.trim())
      }
    }
    const keys = Array.from(keyToLabel.keys()).sort((a, b) =>
      a.localeCompare(b)
    )

    setObservedPropsMeta((prev) => {
      const prevEnabled = new Map(prev.map((p) => [p.key, p.enabled] as const))
      const next = keys.map((k) => ({
        key: k,
        label: keyToLabel.get(k),
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
      L: L as unknown as {
        marker: (...args: unknown[]) => {
          on: (event: string, handler: (event: unknown) => void) => void
          bindTooltip: (
            mount: HTMLElement,
            options: Record<string, unknown>
          ) => void
        }
        divIcon: (...args: unknown[]) => unknown
        polyline: (...args: unknown[]) => {
          on: (event: string, handler: (event: unknown) => void) => void
          bindTooltip: (
            mount: HTMLElement,
            options: Record<string, unknown>
          ) => void
          getBounds: () => { getCenter: () => { lat: number; lng: number } }
        }
        polygon: (...args: unknown[]) => {
          on: (event: string, handler: (event: unknown) => void) => void
          bindTooltip: (
            mount: HTMLElement,
            options: Record<string, unknown>
          ) => void
          getBounds: () => { getCenter: () => { lat: number; lng: number } }
          addTo?: (map: unknown) => void
        }
        layerGroup: (...args: unknown[]) => {
          addLayer: (layer: unknown) => void
          remove?: () => void
        }
        icon: (...args: unknown[]) => unknown
        markerClusterGroup: (...args: unknown[]) => unknown
        point: (...args: unknown[]) => unknown
      },
      proj4,
      map,
      things: thingsArr,
      isThingVisible: (thing) => {
        const key = getThingKey(thing)
        return key ? thingEnabled[key] !== false : true
      },

      selectedNetwork: isObservedMode ? undefined : selectedNetwork,

      networkLayers: networkLayersRef.current,
      overlayWrappersRef: { current: overlayWrappersRef.current },
      enabledRef,
      didInitVisibilityRef,

      observedCluster: observedClusterRef.current,
      observedPropertyFilter: getActiveObservedProps(),
      sourceColorByKey,

      labels: {
        unspecifiedNetwork: t('map.unspecified_network'),
        sameLocation: t('map.same_location'),
        dataSource: t('map.data_source'),
        network: t('map.network'),
        things: t('map.things'),
      },
      onThingSelect,
    })
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const el = containerRef.current
      if (!el || mapRef.current) return

      const leafletMod = await import('leaflet')
      const proj4Mod = await import('proj4')
      await import('leaflet.markercluster')

      if (!mounted) return

      const L = (leafletMod?.default ?? leafletMod) as unknown as LeafletFactory
      const proj4 = (proj4Mod?.default ?? proj4Mod) as Proj4Factory

      LRef.current = L
      proj4Ref.current = proj4

      const bm = BASEMAPS[basemap]
      const map = L.map(el, {
        minZoom: bm.minZoom,
        maxZoom: bm.maxZoom,
      }).setView(mapConfig.center, mapConfig.zoom)
      tileLayerRef.current = L.tileLayer(bm.url, {
        attribution: bm.attribution,
        minZoom: bm.minZoom,
        maxZoom: bm.maxZoom,
      })
      tileLayerRef.current.addTo(map)

      observedOverlayRef.current = L.layerGroup()
      observedClusterRef.current = createClusterGroup({
        L,
        color: (cluster: unknown) =>
          getDominantSourceColor(
            (
              cluster as { getAllChildMarkers?: () => unknown[] }
            )?.getAllChildMarkers?.() ?? []
          ),
        borderColor: (cluster: unknown) =>
          getObservedClusterBorderColor(
            (
              cluster as { getAllChildMarkers?: () => unknown[] }
            )?.getAllChildMarkers?.() ?? []
          ),
        options: { spiderfyDistanceMultiplier: 2.6 },
      })

      observedClusterRef.current.on('clusterclick', (e: unknown) => {
        const clusterEvent = e as {
          originalEvent?: {
            preventDefault?: () => void
            stopPropagation?: () => void
          }
          layer?: {
            getAllChildMarkers?: () => unknown[]
            getConvexHull?: () => unknown[]
            spiderfy?: () => void
          }
        }
        clusterEvent.originalEvent?.preventDefault?.()
        clusterEvent.originalEvent?.stopPropagation?.()
        const previewColor = getDominantSourceColor(
          clusterEvent.layer?.getAllChildMarkers?.() ?? []
        )
        showClusterHullPreview({
          L: L as unknown as {
            polygon: (
              hull: unknown[],
              options: Record<string, unknown>
            ) => { addTo: (map: unknown) => void }
          },
          map,
          clusterLayer: clusterEvent.layer,
          color: previewColor,
        })
        clusterEvent.layer?.spiderfy?.()
      })

      observedOverlayRef.current.addLayer(observedClusterRef.current)

      mapRef.current = map

      map.on('contextmenu', (e: unknown) => {
        const event = e as {
          originalEvent: MouseEvent
          latlng: { lat: number; lng: number }
        }
        const point = map.mouseEventToContainerPoint(event.originalEvent)
        setContextMenu({
          x: point.x,
          y: point.y,
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
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

      const mapState = mapRef.current
      if (mapState?.__clusterHullPreviewTimer) {
        clearTimeout(mapState.__clusterHullPreviewTimer)
        mapState.__clusterHullPreviewTimer = null
      }
      if (mapState?.__clusterHullPreviewLayer) {
        try {
          mapRef.current?.removeLayer?.(mapState.__clusterHullPreviewLayer)
        } catch {}
        mapState.__clusterHullPreviewLayer = null
      }

      try {
        mapRef.current?.off?.()
        mapRef.current?.stop?.()
      } catch {}

      mapRef.current?.remove?.()
      mapRef.current = null

      LRef.current = null
      proj4Ref.current = null
      didInitVisibilityRef.current = false
    }
  }, [])

  useEffect(() => {
    redraw()
  }, [thingsArr, selectedNetwork, thingEnabled, sourceColorByKey])

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
    map.setMinZoom(bm.minZoom)
    map.setMaxZoom(bm.maxZoom)
    map.setMaxBounds(null)

    if (map.getZoom() < bm.minZoom) {
      map.setZoom(bm.minZoom)
    }
    if (map.getZoom() > bm.maxZoom) {
      map.setZoom(bm.maxZoom)
    }
    try {
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    } catch {}

    tileLayerRef.current = L.tileLayer(bm.url, {
      attribution: bm.attribution,
      minZoom: bm.minZoom,
      maxZoom: bm.maxZoom,
    })
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

  const setSourceNetworks = (sourceKey: string, nextEnabled: boolean) => {
    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const thing of thingsArr) {
        if (getThingSourceKey(thing) !== sourceKey) continue
        const key = getThingKey(thing)
        if (!key) continue
        next[key] = nextEnabled
      }
      return next
    })
  }

  const setSourceObservedProps = (sourceKey: string, nextEnabled: boolean) => {
    setObservedPropsMeta((prev) => {
      const next = prev.map((item) => {
        const parsed = parseObservedPropertyKey(item.key)
        return parsed.sourceKey === sourceKey
          ? { ...item, enabled: nextEnabled }
          : item
      })
      observedEnabledRef.current = new Map(
        next.map((item) => [item.key, item.enabled])
      )
      return next
    })
  }

  const onToggleSource = (key: string, nextEnabled: boolean) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    if (!nextEnabled) {
      setSourceObservedProps(key, false)
    }

    setSourceNetworks(key, nextEnabled)
  }

  const onToggleSourceNetwork = (
    sourceKey: string,
    networkKeyValue: string,
    nextEnabled: boolean
  ) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const thing of thingsArr) {
        if (getThingSourceKey(thing) !== sourceKey) continue
        const thingNetworkKey = networkKey(
          thing?.Datastreams?.[0]?.Network?.name
        )
        if (thingNetworkKey !== networkKeyValue) continue

        const thingKey = getThingKey(thing)
        if (!thingKey) continue
        next[thingKey] = nextEnabled
      }
      return next
    })
  }

  const onToggleObservedSource = (sourceKey: string, nextEnabled: boolean) => {
    if (nextEnabled) {
      setSourceNetworks(sourceKey, false)
    }

    setSourceObservedProps(sourceKey, nextEnabled)
  }

  const onToggleSourceThing = (
    _sourceKeyValue: string,
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

  const onToggleObservedPropertyDetail = (
    sourceKey: string,
    observedPropertyKey: string,
    nextEnabled: boolean
  ) => {
    if (nextEnabled) {
      setSourceNetworks(sourceKey, false)
    }

    observedEnabledRef.current.set(observedPropertyKey, nextEnabled)
    setObservedPropsMeta((prev) =>
      prev.map((item) =>
        item.key === observedPropertyKey
          ? { ...item, enabled: nextEnabled }
          : item
      )
    )
  }

  const onChangeSourceColor = (sourceKey: string, color: string) => {
    setSourceColorByKey((prev) => ({
      ...prev,
      [sourceKey]: color,
    }))
  }

  const resolvedSourceColorByKey = useMemo(() => {
    const sourceKeys = Array.from(
      new Set(thingsArr.map((thing) => getThingSourceKey(thing)))
    )
    return buildSourceColorMapWithOverrides(sourceKeys, sourceColorByKey)
  }, [thingsArr, sourceColorByKey])

  const orderedDataSourcesForUI = buildLayerControlSources({
    things: thingsArr,
    thingEnabled,
    observedPropsMeta,
    resolvedSourceColorByKey,
    unspecifiedNetworkLabel: t('map.unspecified_network'),
  })

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
              mapRef.current?.getZoom?.() ?? 10
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
          onImportFromFile={() => {
            document.getElementById('map-import-trigger')?.click()
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

      <ImportFromFileButton buttonId="map-import-trigger" className="hidden" />

      <LayersControl
        title={t('data_sources.title')}
        sources={orderedDataSourcesForUI}
        onToggleSource={onToggleSource}
        onSourceColorChange={onChangeSourceColor}
        onToggleNetwork={onToggleSourceNetwork}
        onToggleThing={onToggleSourceThing}
        onToggleObservedGroup={onToggleObservedSource}
        onToggleObservedProperty={onToggleObservedPropertyDetail}
      />

      <div className="absolute bottom-10 right-3 z-[1900]">
        <MapMenu active={basemap} onChange={setBasemap} />
      </div>
    </div>
  )
}
