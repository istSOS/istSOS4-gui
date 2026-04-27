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
import DatastreamTable from '@/features/datastreams/components/DatastreamTable'
import FormModal from '@/features/forms/components/FormModal'
import ChartModal from '@/features/observations/components/ChartModal'
import { getObservationsByDatastream } from '@/services/observations'
import { Card } from '@heroui/card'
import dayjs from 'dayjs'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'
import { getAllDataSourceTokens, getDataSourceToken } from '@/lib/dataSourceTokens'

type FormTabKey =
  | 'thing'
  | 'location'
  | 'sensor'
  | 'observedProperty'
  | 'datastream'

type CreateFormState = {
  mode: 'create' | 'edit'
  latitude?: number
  longitude?: number
  initialTab?: FormTabKey
  initialSingleDraft?: Record<string, any>
  initialSingleDataSourceEndpoint?: string
  lockedSingleEntity?: FormTabKey
  editTargets?: Partial<Record<FormTabKey, string>>
}

type WritableDataSourceOption = {
  id: string
  name: string
  endpoint: string
}

const LeafletMap = dynamic(() => import('@/features/map/components/LeafletMap'), {
  ssr: false,
})

const getThingKey = (thing: any) => {
  const sourceId = String(
    thing?.__sourceId ?? thing?.__sourceEndpoint ?? siteConfig.api_root
  )
  const thingId = String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
  return `${sourceId}::${thingId}`
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
const mapThingsApiPath = `${normalizedBasePath}/api/data-sources/things`
const normalizeEndpoint = (value: string) => value.trim().replace(/\/+$/, '')
const toKeyValueItems = (value: any) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value)
    .filter(([key]) => String(key).trim().length > 0)
    .map(([key, entryValue]) => ({
      key: String(key),
      value: String(entryValue ?? ''),
    }))
}
const toEntityId = (value: any) =>
  String(value?.['@iot.id'] ?? value?.id ?? '').trim()
const toLocationValue = (value: any) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  const coordinates = Array.isArray(value?.coordinates) ? value.coordinates : null
  if (
    coordinates &&
    coordinates.length >= 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  ) {
    return `${Number(coordinates[0]).toFixed(2)}, ${Number(coordinates[1]).toFixed(2)}`
  }

  return ''
}

export default function Home({
  things,
  locations,
  sensors,
  observedProperties,
  datastreams,
  networks,
  writableDataSources,
  selectedNetwork,
}: {
  things: any[]
  locations: any[]
  sensors: any[]
  observedProperties: any[]
  datastreams: any[]
  networks: any[]
  writableDataSources: WritableDataSourceOption[]
  selectedNetwork?: string
}) {
  const { token } = useAuth()
  const primaryEndpoint = useMemo(
    () => normalizeEndpoint(siteConfig.api_root),
    []
  )
  const primarySourceName = useMemo(() => {
    const source = writableDataSources.find(
      (entry) => normalizeEndpoint(entry.endpoint) === primaryEndpoint
    )
    return source?.name?.trim() || 'Primary data source'
  }, [primaryEndpoint, writableDataSources])

  const enrichThingsWithSourceMetadata = useCallback(
    (items: any[]) =>
      items.map((thing) => {
        const sourceEndpoint = normalizeEndpoint(
          String(thing?.__sourceEndpoint ?? primaryEndpoint)
        )
        const datastreams = Array.isArray(thing?.Datastreams)
          ? thing.Datastreams.map((datastream: any) => ({
              ...datastream,
              __sourceId: String(
                datastream?.__sourceId ?? thing?.__sourceId ?? sourceEndpoint
              ),
              __sourceName: String(
                datastream?.__sourceName ?? thing?.__sourceName ?? primarySourceName
              ),
              __sourceEndpoint: normalizeEndpoint(
                String(datastream?.__sourceEndpoint ?? sourceEndpoint)
              ),
            }))
          : thing?.Datastreams

        return {
          ...thing,
          __sourceId: String(thing?.__sourceId ?? sourceEndpoint),
          __sourceName: String(thing?.__sourceName ?? primarySourceName),
          __sourceEndpoint: sourceEndpoint,
          Datastreams: datastreams,
        }
      }),
    [primaryEndpoint, primarySourceName]
  )
  const enrichEntitiesWithSourceMetadata = useCallback(
    (items: any[]) =>
      items.map((entity) => {
        const sourceEndpoint = normalizeEndpoint(
          String(entity?.__sourceEndpoint ?? primaryEndpoint)
        )

        return {
          ...entity,
          __sourceId: String(entity?.__sourceId ?? sourceEndpoint),
          __sourceName: String(entity?.__sourceName ?? primarySourceName),
          __sourceEndpoint: sourceEndpoint,
        }
      }),
    [primaryEndpoint, primarySourceName]
  )

  const [localThings, setLocalThings] = useState<any[]>(() =>
    enrichThingsWithSourceMetadata(things)
  )
  const [localSensors, setLocalSensors] = useState<any[]>(() =>
    enrichEntitiesWithSourceMetadata(sensors)
  )
  const [localObservedProperties, setLocalObservedProperties] = useState<any[]>(
    () => enrichEntitiesWithSourceMetadata(observedProperties)
  )
  const [localNetworks, setLocalNetworks] = useState<any[]>(() =>
    enrichEntitiesWithSourceMetadata(networks)
  )
  const [createFormState, setCreateFormState] =
    useState<CreateFormState | null>(null)

  useEffect(() => {
    setLocalThings(enrichThingsWithSourceMetadata(things))
    setLocalSensors(enrichEntitiesWithSourceMetadata(sensors))
    setLocalObservedProperties(
      enrichEntitiesWithSourceMetadata(observedProperties)
    )
    setLocalNetworks(enrichEntitiesWithSourceMetadata(networks))
  }, [
    things,
    sensors,
    observedProperties,
    networks,
    enrichThingsWithSourceMetadata,
    enrichEntitiesWithSourceMetadata,
  ])

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const tokenMap = getAllDataSourceTokens()
        const response = await fetch(mapThingsApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: tokenMap }),
          cache: 'no-store',
        })

        if (!response.ok) return

        const data = await response.json().catch(() => null)
        if (!mounted || !Array.isArray(data?.things)) return

        setLocalThings(enrichThingsWithSourceMetadata(data.things))
        if (Array.isArray(data?.sensors)) {
          setLocalSensors(enrichEntitiesWithSourceMetadata(data.sensors))
        }
        if (Array.isArray(data?.observedProperties)) {
          setLocalObservedProperties(
            enrichEntitiesWithSourceMetadata(data.observedProperties)
          )
        }
        if (Array.isArray(data?.networks)) {
          setLocalNetworks(enrichEntitiesWithSourceMetadata(data.networks))
        }
      } catch {}
    })()

    return () => {
      mounted = false
    }
  }, [
    token,
    things,
    createFormState,
    enrichThingsWithSourceMetadata,
    enrichEntitiesWithSourceMetadata,
  ])

  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [selectedDatastream, setSelectedDatastream] = useState<any | null>(null)
  const locationsForForm = useMemo(() => {
    const primaryEndpoint = normalizeEndpoint(siteConfig.api_root)
    const byKey = new Map<string, any>()

    const addLocation = (location: any, sourceEndpoint: string) => {
      const locationId = String(location?.['@iot.id'] ?? location?.id ?? '').trim()
      if (!locationId) return

      const normalizedSourceEndpoint =
        normalizeEndpoint(sourceEndpoint || primaryEndpoint) || primaryEndpoint
      const dedupKey = `${normalizedSourceEndpoint}::${locationId}`
      if (byKey.has(dedupKey)) return

      byKey.set(dedupKey, {
        ...location,
        __sourceEndpoint: normalizedSourceEndpoint,
      })
    }

    for (const location of locations) {
      addLocation(
        location,
        String((location as any)?.__sourceEndpoint ?? primaryEndpoint)
      )
    }

    for (const thing of localThings) {
      const sourceEndpoint = String(thing?.__sourceEndpoint ?? primaryEndpoint)
      const thingLocations = Array.isArray(thing?.Locations) ? thing.Locations : []
      for (const location of thingLocations) {
        addLocation(location, sourceEndpoint)
      }
    }

    return Array.from(byKey.values())
  }, [locations, localThings])
  const networksForForm = useMemo(() => {
    const byKey = new Map<string, any>()

    const addNetwork = (network: any, sourceEndpoint: string) => {
      const networkId = String(network?.['@iot.id'] ?? network?.id ?? '').trim()
      if (!networkId) return

      const normalizedSourceEndpoint =
        normalizeEndpoint(sourceEndpoint || primaryEndpoint) || primaryEndpoint
      const dedupKey = `${normalizedSourceEndpoint}::${networkId}`
      if (byKey.has(dedupKey)) return

      byKey.set(dedupKey, {
        ...network,
        __sourceEndpoint: normalizedSourceEndpoint,
      })
    }

    for (const network of localNetworks) {
      addNetwork(
        network,
        String((network as any)?.__sourceEndpoint ?? primaryEndpoint)
      )
    }

    for (const thing of localThings) {
      const sourceEndpoint = String(thing?.__sourceEndpoint ?? primaryEndpoint)
      const thingDatastreams = Array.isArray(thing?.Datastreams)
        ? thing.Datastreams
        : []
      for (const datastream of thingDatastreams) {
        if (!datastream?.Network) continue
        addNetwork(
          datastream.Network,
          String(datastream?.__sourceEndpoint ?? sourceEndpoint)
        )
      }
    }

    return Array.from(byKey.values())
  }, [localNetworks, localThings, primaryEndpoint])

  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)
  const [obsStart, setObsStart] = useState<string | null>(null)
  const [obsEnd, setObsEnd] = useState<string | null>(null)

  const obsCacheRef = useRef<Map<string, any[]>>(new Map())
  const [observations, setObservations] = useState<any[]>([])

  const selectedThing = useMemo(() => {
    if (!selectedThingId) return null
    return (
      localThings.find((thing) => getThingKey(thing) === selectedThingId) ?? null
    )
  }, [localThings, selectedThingId])

  const isPanelOpen = !!selectedThing

  const closePanel = () => {
    setSelectedThingId(null)
    setSelectedDatastream(null)
    setObservations([])
    setObsError(null)
    setObsLoading(false)
    setObsStart(null)
    setObsEnd(null)
  }

  const loadObservations = async (
    datastreamId: string,
    phenomenonTime?: string,
    range?: { start?: string | null; end?: string | null },
    sourceEndpoint?: string
  ) => {
    let startIso = range?.start ?? null
    let endIso = range?.end ?? null
    const resolvedEndpoint =
      sourceEndpoint?.trim().replace(/\/+$/, '') ?? siteConfig.api_root

    if (!startIso || !endIso) {
      const [, endRaw] = phenomenonTime?.split('/') ?? []

      const end = endRaw ? dayjs.utc(endRaw) : dayjs.utc()
      const start = end.subtract(7, 'day')
      endIso = end.toISOString()
      startIso = start.toISOString()
    }

    const cacheKey = `${resolvedEndpoint}|${datastreamId}|${startIso}|${endIso}`
    const cached = obsCacheRef.current.get(cacheKey)
    if (cached) {
      setObservations(cached)
      setObsStart(startIso)
      setObsEnd(endIso)
      return
    }

    setObsLoading(true)
    setObsError(null)
    try {
      const sourceToken = getDataSourceToken(resolvedEndpoint)
      const { observationData } = await getObservationsByDatastream(
        sourceToken ?? token ?? undefined,
        datastreamId,
        startIso ?? undefined,
        endIso ?? undefined,
        resolvedEndpoint
      )
      obsCacheRef.current.set(cacheKey, observationData)
      setObservations(observationData)
      setObsStart(startIso)
      setObsEnd(endIso)
    } catch (e: any) {
      setObsError(e?.message ?? 'Failed to load observations')
      setObservations([])
    } finally {
      setObsLoading(false)
    }
  }

  const openChartForDatastream = async (ds: any) => {
    setSelectedDatastream(ds)

    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
    const sourceEndpoint = String(
      ds?.__sourceEndpoint ?? selectedThing?.__sourceEndpoint ?? siteConfig.api_root
    )
    if (!dsId) {
      setObsError('Missing datastream id')
      setObservations([])
      return
    }
    await loadObservations(dsId, ds.phenomenonTime, undefined, sourceEndpoint)
  }

  const applyObservationRange = async (
    start?: string | null,
    end?: string | null
  ) => {
    const dsId = String(
      selectedDatastream?.['@iot.id'] ?? selectedDatastream?.id ?? ''
    )
    if (!dsId) return

    const sourceEndpoint = String(
      selectedDatastream?.__sourceEndpoint ??
        selectedThing?.__sourceEndpoint ??
        siteConfig.api_root
    )

    await loadObservations(dsId, selectedDatastream?.phenomenonTime, {
      start,
      end,
    }, sourceEndpoint)
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <LeafletMap
        things={localThings}
        selectedNetwork={selectedNetwork}
        onThingSelect={(thing) => {
          setSelectedThingId(getThingKey(thing))
          setSelectedDatastream(null)
          setObservations([])
          setObsError(null)
        }}
        onCreateThingAt={(point) => {
          setCreateFormState({
            mode: 'create',
            latitude: point.latitude,
            longitude: point.longitude,
            initialTab: 'thing',
          })
        }}
      />
      {createFormState ? (
        <FormModal
          operation={createFormState.mode}
          latitude={createFormState.latitude}
          longitude={createFormState.longitude}
          initialTab={createFormState.initialTab}
          initialSingleDraft={createFormState.initialSingleDraft}
          initialSingleDataSourceEndpoint={
            createFormState.initialSingleDataSourceEndpoint
          }
          lockedSingleEntity={createFormState.lockedSingleEntity}
          editTargets={createFormState.editTargets}
          writableDataSources={writableDataSources}
          existingEntities={{
            things: localThings,
            locations: locationsForForm,
            sensors: localSensors,
            observedProperties: localObservedProperties,
            datastreams,
            networks: networksForForm,
          }}
          isOpen={!!createFormState}
          onClose={() => {
            setCreateFormState(null)
          }}
        />
      ) : null}
      <ChartModal
        isOpen={!!selectedDatastream}
        onClose={() => {
          setSelectedDatastream(null)
          setObservations([])
          setObsError(null)
          setObsLoading(false)
          setObsStart(null)
          setObsEnd(null)
        }}
        thing={selectedThing}
        datastream={selectedDatastream}
        observations={observations}
        loading={obsLoading}
        error={obsError}
        start={obsStart}
        end={obsEnd}
        onApplyRange={applyObservationRange}
        onResetRange={() => {
          applyObservationRange(null, null)
        }}
      />
      {isPanelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[4000] pb-[env(safe-area-inset-bottom)]">
          <Card className="max-h-[38vh] overflow-hidden rounded-none">
            <div className="max-h-[32vh] overflow-auto pb-2">
              <DatastreamTable
                thing={selectedThing}
                onClose={closePanel}
                onCreateDatastream={() => {
                  setCreateFormState({
                    mode: 'create',
                    initialTab: 'datastream',
                  })
                }}
                onOpenDetails={openChartForDatastream}
                onEditDatastream={(datastream) => {
                  const datastreamId = toEntityId(datastream)
                  if (!datastreamId) return

                  const sourceEndpoint = normalizeEndpoint(
                    String(
                      datastream?.__sourceEndpoint ??
                        selectedThing?.__sourceEndpoint ??
                      siteConfig.api_root
                    )
                  )
                  const selectedThingLocation = Array.isArray(
                    selectedThing?.Locations
                  )
                    ? selectedThing.Locations[0]
                    : null
                  const thingId = toEntityId(selectedThing)
                  const locationId = toEntityId(selectedThingLocation)
                  const sensorId = toEntityId(datastream?.Sensor)
                  const observedPropertyId = toEntityId(
                    datastream?.ObservedProperty
                  )
                  const networkId = toEntityId(datastream?.Network)

                  const datastreamDraft = {
                    name: String(datastream?.name ?? ''),
                    description: String(datastream?.description ?? ''),
                    observationType: String(datastream?.observationType ?? ''),
                    thingId,
                    sensorId,
                    observedPropertyId,
                    networkId,
                    unitOfMeasurement: toKeyValueItems(
                      datastream?.unitOfMeasurement
                    ),
                    properties: toKeyValueItems(datastream?.properties),
                  }
                  const thingDraft = {
                    name: String(selectedThing?.name ?? ''),
                    description: String(selectedThing?.description ?? ''),
                    locationId,
                    properties: toKeyValueItems(selectedThing?.properties),
                  }
                  const locationDraft = {
                    name: String(selectedThingLocation?.name ?? ''),
                    description: String(selectedThingLocation?.description ?? ''),
                    encodingType: String(
                      selectedThingLocation?.encodingType ?? 'application/geo+json'
                    ),
                    location: toLocationValue(selectedThingLocation?.location),
                    properties: toKeyValueItems(selectedThingLocation?.properties),
                  }
                  const sensorDraft = {
                    name: String(datastream?.Sensor?.name ?? ''),
                    description: String(datastream?.Sensor?.description ?? ''),
                    encodingType: String(datastream?.Sensor?.encodingType ?? ''),
                    metadata: String(datastream?.Sensor?.metadata ?? ''),
                    properties: toKeyValueItems(datastream?.Sensor?.properties),
                  }
                  const observedPropertyDraft = {
                    name: String(datastream?.ObservedProperty?.name ?? ''),
                    definition: String(
                      datastream?.ObservedProperty?.definition ?? ''
                    ),
                    description: String(
                      datastream?.ObservedProperty?.description ?? ''
                    ),
                    properties: toKeyValueItems(
                      datastream?.ObservedProperty?.properties
                    ),
                  }
                  const editTargets: Partial<Record<FormTabKey, string>> = {
                    datastream: datastreamId,
                    ...(thingId ? { thing: thingId } : {}),
                    ...(locationId ? { location: locationId } : {}),
                    ...(sensorId ? { sensor: sensorId } : {}),
                    ...(observedPropertyId
                      ? { observedProperty: observedPropertyId }
                      : {}),
                  }

                  setCreateFormState({
                    mode: 'edit',
                    initialTab: 'datastream',
                    initialSingleDataSourceEndpoint: sourceEndpoint,
                    initialSingleDraft: {
                      thing: thingDraft,
                      location: locationDraft,
                      sensor: sensorDraft,
                      observedProperty: observedPropertyDraft,
                      datastream: datastreamDraft,
                    },
                    editTargets,
                  })
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
