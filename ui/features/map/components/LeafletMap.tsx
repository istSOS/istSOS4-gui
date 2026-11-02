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
import type { FormTabKey } from '@/features/forms/components/wizard/types'
import { BasemapKey } from '@/types'
import { Thing } from '@/types/domain'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet/dist/leaflet.css'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { mapConfig } from '@/config/map'
import { BASEMAPS } from '@/config/site'

import LayersControl from './LayersControl'
import MapContextMenu from './MapContextMenu'
import MapEntityFilter from './MapEntityFilter'
import MapMenu from './MapMenu'
import MapToolbar from './MapToolbar'

import type { MapFilters } from '../hooks/useMapFilters'
import {
  type MapFocusGroup,
  fitThingsOnMap,
  focusThingOnMap,
} from '../lib/focusThingOnMap'
import { buildLayerControlSources } from '../lib/layersControlData'
import {
  type SelectableMapLayer,
  createClusterGroup,
  setMarkerSelected,
  showClusterHullPreview,
} from '../lib/leafletCluster'
import {
  bindClusterTooltips,
  buildSourceColorMapWithOverrides,
  drawNetworkLayers,
  networkKey,
} from '../lib/leafletDraw'
import {
  buildObservedPropertyKey,
  getThingKey,
  getThingSourceKey,
} from '../lib/leafletMapHelpers'
import {
  MAP_FACETS,
  type MapFacet,
  allMapFilters,
  getMapDatastreamKey,
  isFacetSelected,
  toggleFacetOption,
  toggleFacetOptions,
} from '../lib/mapCrossfilter'
import { layoutMapValueLabels } from '../lib/mapLabelLayout'
import type { MapEntityFocus } from '../lib/mapSelection'
import { getDominantSourceColor } from '../lib/observedClusterStyle'

export default function LeafletMap({
  things,
  filters,
  selectedNetwork,
  selectedThing,
  selectedThingKeys,
  entityFocus,
  onFilterItemSelect,
  focusThingRequest,
  onClearSelection,
  asOfLabel,
  asOfReferenceTime,
  onThingSelect,
  onCreateThingAt,
  onCreateEntity,
  statusOverlay,
}: {
  filters: MapFilters
  things: Thing[] | { value: Thing[] }
  selectedNetwork?: string
  onClearSelection?: () => void
  focusThingRequest?: { thingKeys: ReadonlySet<string> } | null
  selectedThingKeys?: ReadonlySet<string>
  entityFocus?: MapEntityFocus | null
  onFilterItemSelect: (facet: MapFacet, key: string) => void
  selectedThing?: Thing | null
  /** Formatted snapshot date label (e.g. "Jun 26 · 01:16 UTC"). When set, markers get amber date pills. */
  asOfLabel?: string | null
  /** The snapshot instant (ISO), or null when live. Marker freshness is judged against it. */
  asOfReferenceTime?: string | null
  onThingSelect?: (
    thing: Thing,
    selection?: { observedPropertyName?: string; datastreamId?: string }
  ) => void
  onCreateThingAt?: (point: { latitude: number; longitude: number }) => void
  onCreateEntity?: (entity: FormTabKey) => void
  statusOverlay?: ReactNode
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const layoutLabelsRef = useRef<() => void>(() => {})
  const didFitInitialExtentRef = useRef(false)
  const selectedThingKey = selectedThing ? getThingKey(selectedThing) : null

  type ClusterPreviewMapState = {
    __clusterHullPreviewTimer?: ReturnType<typeof setTimeout> | null
    __clusterHullPreviewLayer?: { remove?: () => void } | null
  }
  type MapWithClusterPreview = {
    mouseEventToContainerPoint: (event: MouseEvent) => { x: number; y: number }
    setView: (
      center: [number, number],
      zoom: number,
      options?: { animate: boolean }
    ) => void
    fitBounds: (
      bounds: unknown,
      options: { padding: [number, number]; maxZoom: number; animate: boolean }
    ) => void
    getMaxZoom: () => number
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
    zoomToShowLayer?: MapFocusGroup['zoomToShowLayer']
    eachLayer?: (callback: (layer: SelectableMapLayer) => void) => void
    refreshClusters?: () => void
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
          zoomToShowLayer?: MapFocusGroup['zoomToShowLayer']
          clearLayers?: () => void
          eachLayer?: (callback: (layer: SelectableMapLayer) => void) => void
          refreshClusters?: () => void
          off?: () => void
          remove?: () => void
        }
        vectors: {
          clearLayers?: () => void
          remove?: () => void
          eachLayer?: (callback: (layer: SelectableMapLayer) => void) => void
        }
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

  const {
    filterSelection,
    setFilterSelection,
    thingEnabled,
    setThingEnabled,
    crossfilter,
  } = filters
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

  // Visibility choices outlive the Things they belong to. In snapshot mode a
  // Thing leaves the list when the scrubber passes its creation (or deletion)
  // and comes back when it returns; forgetting its entry would switch a Thing
  // the user had hidden back on.
  // Where each Thing seen so far was grouped, so a switch flipped for a whole
  // source or network also reaches the Things not in the list at the moment.
  const thingGroupMemoryRef = useRef<
    Map<string, { sourceKey: string; networkKey: string }>
  >(new Map())

  useEffect(() => {
    for (const thing of thingsArr) {
      const key = getThingKey(thing)
      if (!key) continue
      thingGroupMemoryRef.current.set(key, {
        sourceKey: getThingSourceKey(thing),
        networkKey: networkKey(thing?.Datastreams?.[0]?.Network?.name),
      })
    }
  }, [thingsArr])

  const observedPropsMeta = useMemo(() => {
    const properties = new Map<
      string,
      { key: string; label: string; enabled: boolean }
    >()
    for (const thing of thingsArr) {
      for (const ds of thing.Datastreams ?? []) {
        const name = ds.ObservedProperty?.name?.trim()
        if (!name) continue
        const key = buildObservedPropertyKey(getThingSourceKey(thing), name)
        properties.set(key, {
          key,
          label: name,
          enabled: isFacetSelected(filterSelection.properties, key),
        })
      }
    }
    return [...properties.values()]
  }, [thingsArr, filterSelection.properties])
  const activeObservedProps = useMemo(
    () =>
      new Set(
        observedPropsMeta
          .filter((property) => property.enabled)
          .map((property) => property.key)
      ),
    [observedPropsMeta]
  )
  // Keep the values overlay active for empty selections too: an empty result
  // must not fall back to showing every station.
  const isObservedMode = observedPropsMeta.length > 0
  const filtersActive = MAP_FACETS.some(
    (facet) =>
      !filterSelection[facet].all || filterSelection[facet].keys.length > 0
  )
  const resetFilters = () => setFilterSelection(allMapFilters())
  const toggleFilter = (facet: MapFacet, key: string, selected: boolean) => {
    setFilterSelection((previous) => ({
      ...previous,
      [facet]: toggleFacetOption(previous[facet], key, selected),
    }))
  }
  const toggleAllFilter = (facet: MapFacet, selected: boolean) => {
    setFilterSelection((previous) => ({
      ...previous,
      [facet]: { all: selected, keys: [] },
    }))
  }

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

  const visibleThingGroups = (): MapFocusGroup[] => {
    if (isObservedMode) {
      return observedClusterRef.current ? [observedClusterRef.current] : []
    }
    const groups: MapFocusGroup[] = []
    for (const [key, { cluster, vectors }] of networkLayersRef.current) {
      if (enabledRef.current.get(key) !== false) groups.push(cluster, vectors)
    }
    return groups
  }

  const fitThingExtent = (animate = true) => {
    const map = mapRef.current
    return map ? fitThingsOnMap(map, visibleThingGroups(), animate) : false
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
        markerClusterGroup: (...args: unknown[]) => unknown
        point: (...args: unknown[]) => unknown
      },
      proj4,
      map,
      things: thingsArr,
      isThingVisible: (thing) => {
        return crossfilter.matchingThingKeys.has(getThingKey(thing))
      },
      isDatastreamVisible: (thing, ds, index) =>
        crossfilter.matchingDatastreamKeys.has(
          getMapDatastreamKey(thing, ds, index)
        ),
      observedMode: isObservedMode,

      selectedNetwork: isObservedMode ? undefined : selectedNetwork,
      selectedThingKey,
      selectedThingKeys,

      networkLayers: networkLayersRef.current,
      overlayWrappersRef: { current: overlayWrappersRef.current },
      enabledRef,
      didInitVisibilityRef,

      observedCluster: observedClusterRef.current,
      observedPropertyFilter: activeObservedProps,
      sourceColorByKey,

      labels: {
        unspecifiedNetwork: t('map.unspecified_network'),
        sameLocation: t('map.same_location'),
        dataSource: t('map.data_source'),
        network: t('map.network'),
        things: t('map.things'),
        approximatePosition: t('as_of.map.approximate_marker'),
        delayedReadings: t('map.delayed_readings'),
        stations: t('map.stations'),
        noReading: t('map.no_reading'),
        moreReadings: (count) => t('map.more_readings', { count }),
      },
      asOfLabel: asOfLabel ?? undefined,
      referenceTime: asOfReferenceTime ?? null,
      onThingSelect,
    })
  }

  useEffect(() => {
    let mounted = true
    let labelFrame = 0

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
        warningLabel: t('map.delayed_readings'),
        options: { spiderfyDistanceMultiplier: 1.8, maxClusterRadius: 45 },
      })

      bindClusterTooltips(observedClusterRef.current, {
        unspecifiedNetwork: t('map.unspecified_network'),
        sameLocation: t('map.same_location'),
        dataSource: t('map.data_source'),
        network: t('map.network'),
        things: t('map.things'),
        delayedReadings: t('map.delayed_readings'),
        stations: t('map.stations'),
        approximatePosition: t('as_of.map.approximate_marker'),
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

      const layoutLabels = () => {
        cancelAnimationFrame(labelFrame)
        labelFrame = requestAnimationFrame(() => {
          if (mounted && el.parentElement)
            layoutMapValueLabels(el.parentElement)
        })
      }
      layoutLabelsRef.current = layoutLabels
      map.on('move zoomend resize layeradd layerremove', layoutLabels)
      observedClusterRef.current.on(
        'animationend spiderfied unspiderfied',
        layoutLabels
      )

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

      // Render with the latest filters once the asynchronous imports finish.
      setMapReady(true)

      roRef.current = new ResizeObserver(() => map.invalidateSize())
      roRef.current.observe(el)
    })()

    return () => {
      mounted = false
      cancelAnimationFrame(labelFrame)
      layoutLabelsRef.current = () => {}
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
      didFitInitialExtentRef.current = false
    }
  }, [])

  useEffect(() => {
    redraw()
    // Wait for the first plotted Things, then preserve the user's camera while
    // readings and filters change. The toolbar can fit the current extent again.
    if (!didFitInitialExtentRef.current && fitThingExtent(false)) {
      didFitInitialExtentRef.current = true
    }
  }, [
    mapReady,
    thingsArr,
    selectedNetwork,
    crossfilter,
    activeObservedProps,
    sourceColorByKey,
    asOfLabel,
    asOfReferenceTime,
  ])

  useEffect(() => {
    applyModeLayers()
  }, [isObservedMode, mapReady])

  useEffect(() => {
    const update = (layer: SelectableMapLayer) =>
      setMarkerSelected(
        layer,
        selectedThingKeys
          ? selectedThingKeys.has(layer.__thingKey)
          : layer.__thingKey === selectedThingKey
      )
    observedClusterRef.current?.eachLayer?.(update)
    layoutLabelsRef.current()
    // Leaflet initializes a cluster's tree when it is first added to the map.
    // Refresh only the active overlays; hidden ones pick up selection on add.
    if (isObservedMode) observedClusterRef.current?.refreshClusters?.()
    for (const [key, { cluster, vectors }] of networkLayersRef.current) {
      cluster.eachLayer?.(update)
      if (!isObservedMode && enabledRef.current.get(key) !== false) {
        cluster.refreshClusters?.()
      }
      vectors.eachLayer?.(update)
    }
  }, [selectedThingKey, selectedThingKeys, mapReady, isObservedMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !focusThingRequest) return
    const keys = focusThingRequest.thingKeys
    if (keys.size === 1) {
      focusThingOnMap(map, visibleThingGroups(), keys.values().next().value)
    } else {
      fitThingsOnMap(map, visibleThingGroups(), true, keys)
    }
  }, [focusThingRequest, mapReady, isObservedMode])

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

  const setSourceNetworks = (sourceKey: string, nextEnabled: boolean) => {
    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const [key, group] of thingGroupMemoryRef.current) {
        if (group.sourceKey !== sourceKey) continue
        next[key] = nextEnabled
      }
      return next
    })
  }

  const onToggleSource = (key: string, nextEnabled: boolean) => {
    resetFilters()
    setSourceNetworks(key, nextEnabled)
  }

  const onToggleSourceNetwork = (
    sourceKey: string,
    networkKeyValue: string,
    nextEnabled: boolean
  ) => {
    resetFilters()
    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const [thingKey, group] of thingGroupMemoryRef.current) {
        if (group.sourceKey !== sourceKey) continue
        if (group.networkKey !== networkKeyValue) continue
        next[thingKey] = nextEnabled
      }
      return next
    })
  }

  const onToggleThing = (thingKey: string, nextEnabled: boolean) => {
    setThingEnabled((prev) => ({ ...prev, [thingKey]: nextEnabled }))
  }

  const onToggleSourceThing = (
    _sourceKeyValue: string,
    _networkKeyValue: string,
    thingKey: string,
    nextEnabled: boolean
  ) => {
    resetFilters()
    onToggleThing(thingKey, nextEnabled)
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
    <div className="relative isolate h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        data-map-controls
        className="pointer-events-none absolute left-14 right-3 top-3 z-[2300] flex flex-wrap items-start gap-2"
      >
        {MAP_FACETS.map((facet) => (
          <MapEntityFilter
            key={facet}
            facet={facet}
            options={crossfilter.facets[facet]}
            all={
              filterSelection[facet].all &&
              filterSelection[facet].keys.length === 0
            }
            sourceColors={resolvedSourceColorByKey}
            activeKey={entityFocus?.facet === facet ? entityFocus.key : undefined}
            onItemSelect={(key) => onFilterItemSelect(facet, key)}
            onToggle={(key, selected) => toggleFilter(facet, key, selected)}
            onToggleAll={(selected) => toggleAllFilter(facet, selected)}
            onToggleResults={(keys, selected) =>
              setFilterSelection((previous) => ({
                ...previous,
                [facet]: toggleFacetOptions(previous[facet], keys, selected),
              }))
            }
          />
        ))}
        <div className="relative ml-auto shrink-0">
          <LayersControl
            sources={orderedDataSourcesForUI}
            onToggleSource={onToggleSource}
            onSourceColorChange={onChangeSourceColor}
            onToggleNetwork={onToggleSourceNetwork}
            onToggleThing={onToggleSourceThing}
          />
          <div className="absolute right-0 top-full pt-2">
            <MapToolbar
              onCreate={onCreateEntity}
              onImport={() =>
                document.getElementById('map-import-trigger')?.click()
              }
              onReset={resetFilters}
              onFitExtent={() => fitThingExtent()}
              extentAvailable={
                mapReady && crossfilter.matchingThingKeys.size > 0
              }
              onClearSelection={onClearSelection}
              selectionActive={entityFocus != null || selectedThingKey !== null}
              filtersActive={filtersActive}
              isSnapshot={Boolean(asOfLabel)}
            />
          </div>
        </div>
        {crossfilter.matchingThingKeys.size === 0 && thingsArr.length > 0 && (
          <div role="status" className="pointer-events-auto w-full">
            <span className="inline-block rounded-small bg-content1 px-3 py-2 text-xs text-default-600 shadow-md">
              {t('map.filter_no_matches')}
            </span>
          </div>
        )}
        {statusOverlay && (
          <div className="relative w-full">{statusOverlay}</div>
        )}
      </div>

      {contextMenu ? (
        <MapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
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
          isSnapshot={Boolean(asOfLabel)}
        />
      ) : null}

      <ImportFromFileButton buttonId="map-import-trigger" className="hidden" />

      <div data-map-controls className="absolute bottom-10 right-3 z-[1900]">
        <MapMenu active={basemap} onChange={setBasemap} />
      </div>
    </div>
  )
}
