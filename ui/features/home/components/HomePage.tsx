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
import AsOfExistenceDialog from '@/features/as-of/components/AsOfExistenceDialog'
import AsOfMapStatus from '@/features/as-of/components/AsOfMapStatus'
import TimelineScrubber from '@/features/as-of/components/TimelineScrubber'
import { useAsOfMapThings } from '@/features/as-of/hooks/useAsOfMapThings'
import {
  type ExistenceState,
  useAsOfThing,
} from '@/features/as-of/hooks/useAsOfThing'
import DatastreamTable from '@/features/datastreams/components/DatastreamTable'
import {
  type MapDatastreamRow,
  buildMapDatastreamRows,
} from '@/features/datastreams/lib/mapDatastreamRows'
import FormModal from '@/features/forms/components/FormModal'
import { FormDataMap } from '@/features/forms/components/wizard/types'
import MapTableLayout from '@/features/map/components/MapTableLayout'
import { useMapFilters } from '@/features/map/hooks/useMapFilters'
import { getThingKey } from '@/features/map/lib/leafletMapHelpers'
import { getMapDatastreamKey } from '@/features/map/lib/mapCrossfilter'
import {
  type MapEntityFocus,
  resolveMapSelection,
} from '@/features/map/lib/mapSelection'
import ChartModal from '@/features/observations/components/ChartModal'
import { Datastream, Thing } from '@/types/domain'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useEffect, useMemo, useRef, useState } from 'react'

import dynamic from 'next/dynamic'

import { siteConfig } from '@/config/site'

import { useAsOf } from '@/context/AsOfContext'
import { useAuth } from '@/context/AuthContext'

import { useChartState } from '../hooks/useChartState'
import { useDataSourcesSync } from '../hooks/useDataSourcesSync'
import {
  FormTabKey,
  buildDatastreamEditFormState,
} from '../lib/buildDatastreamEditFormState'
import {
  CsvDownloadPayload,
  buildDatastreamWorkbookPayload,
} from '../lib/downloadWorkbook'
import {
  buildLocationsForForm,
  buildNetworksForForm,
  normalizeEndpoint,
} from '../lib/utils'

dayjs.extend(utc)

type CreateFormState = {
  mode: 'create' | 'edit'
  latitude?: number
  longitude?: number
  initialTab?: FormTabKey
  initialSingleDraft?: Partial<FormDataMap>
  initialSingleDataSourceEndpoint?: string
  lockedSingleEntity?: FormTabKey
  editTargets?: Partial<Record<FormTabKey, string>>
}

type WritableDataSourceOption = {
  id: string
  name: string
  endpoint: string
}

const LeafletMap = dynamic(
  () => import('@/features/map/components/LeafletMap'),
  {
    ssr: false,
  }
)

export default function HomePage({
  things,
  locations,
  sensors,
  observedProperties,
  datastreams,
  networks,
  writableDataSources,
  selectedNetwork,
}: {
  things: Thing[]
  locations: unknown[]
  sensors: unknown[]
  observedProperties: unknown[]
  datastreams: Datastream[]
  networks: unknown[]
  writableDataSources: WritableDataSourceOption[]
  selectedNetwork?: string
}) {
  const { token } = useAuth()
  const { asOfDate, isSnapshot } = useAsOf()
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

  const [createFormState, setCreateFormState] =
    useState<CreateFormState | null>(null)
  const syncRefreshKey = useMemo(
    () => ({ token, createFormState }),
    [token, createFormState]
  )
  const { localThings, localSensors, localObservedProperties, localNetworks } =
    useDataSourcesSync({
      things,
      sensors,
      observedProperties,
      networks,
      primaryEndpoint,
      primarySourceName,
      refreshKey: syncRefreshKey,
    })

  // The Things everything on this page works from: the live list, or in
  // snapshot mode the Things as they existed at asOfDate — with the Things
  // deleted since, without the ones created since, each where it stood then.
  // The map, the panel selection and the chart pickers all read this one list,
  // so they can never disagree about an instant.
  const {
    things: viewThings,
    resolvedFor: viewThingsResolvedFor,
    isLoading: mapSnapshotLoading,
    error: mapSnapshotError,
    failedEndpoints: mapSnapshotFailedEndpoints,
    readingsUnavailableEndpoints: mapSnapshotReadingsUnavailable,
    approximateCount: mapApproximateCount,
    lostCount: mapLostCount,
  } = useAsOfMapThings({ liveThings: localThings, asOfDate })

  const mapFilters = useMapFilters(viewThings)
  const [tableCollapsed, setTableCollapsed] = useState(false)
  const [mapFocus, setMapFocus] = useState<MapEntityFocus | null>(null)
  const [focusThingRequest, setFocusThingRequest] = useState<{
    thingKeys: ReadonlySet<string>
  } | null>(null)
  const tableRows = useMemo(
    () =>
      buildMapDatastreamRows(
        viewThings,
        mapFilters.crossfilter.matchingDatastreamKeys
      ),
    [viewThings, mapFilters.crossfilter.matchingDatastreamKeys]
  )
  const mapSelection = useMemo(
    () => resolveMapSelection(viewThings, mapFocus, mapFilters.crossfilter),
    [viewThings, mapFocus, mapFilters.crossfilter]
  )
  const highlightedRows = mapSelection.datastreamKeys

  const [isClientMounted, setIsClientMounted] = useState(false)
  const locationsForForm = useMemo(() => {
    return buildLocationsForForm({
      locations,
      localThings,
      primaryEndpoint,
    })
  }, [locations, localThings, primaryEndpoint])
  const networksForForm = useMemo(() => {
    return buildNetworksForForm({
      localNetworks,
      localThings,
      primaryEndpoint,
    })
  }, [localNetworks, localThings, primaryEndpoint])

  useEffect(() => {
    setIsClientMounted(true)
  }, [])
  const {
    selectedThing,
    availableDatastreams,
    selectedDatastreamKeysForChart,
    listedDatastreamKeys,
    toggleChartDatastream,
    removeChartDatastream,
    isChartOpen,
    selectedDatastream,
    observations,
    comparisonDatastream,
    comparisonObservations,
    allSeries,
    obsLoading,
    obsError,
    obsStart,
    obsEnd,
    asOfWindowFallback,
    activeDatastreamIds,
    compareAsOfDate,
    compareAligned,
    changeCompareAsOfDate,
    fetchObservations,
    resetChartState,
    onMapThingSelect,
    clearThingSelection,
    openChartForDatastream,
    applyObservationRange,
  } = useChartState({
    localThings: viewThings,
    liveThings: localThings,
    thingsResolvedFor: viewThingsResolvedFor,
    token,
    asOfDate,
  })

  // Resolve the thing as it existed at asOfDate (mock for dummy data, stub for real)
  const { existenceState, existenceRange } = useAsOfThing({
    thing: selectedThing,
    asOfDate,
  })

  // Track whether the user has explicitly dismissed the existence dialog
  const [existenceDialogDismissed, setExistenceDialogDismissed] =
    useState(false)

  // Track previous existenceState so we re-show the dialog only on a genuine
  // transition from 'exists' into an invalid state — NOT on every scrubber tick
  // while already inside the invalid zone (that would override the user's dismiss).
  const prevExistenceStateRef = useRef<ExistenceState>(existenceState)
  useEffect(() => {
    const prev = prevExistenceStateRef.current
    prevExistenceStateRef.current = existenceState
    if (existenceState !== 'exists' && prev === 'exists') {
      setExistenceDialogDismissed(false)
    }
  }, [existenceState])

  const downloadAllDatastreamsCsv =
    async (): Promise<CsvDownloadPayload | null> => {
      return buildDatastreamWorkbookPayload({
        selectedThing,
        obsStart,
        obsEnd,
        fetchObservations,
      })
    }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <MapTableLayout
        collapsed={tableCollapsed}
        onExpand={() => setTableCollapsed(false)}
        onCollapse={() => setTableCollapsed(true)}
        map={
          <>
            {isClientMounted ? (
              <LeafletMap
                things={viewThings}
                filters={mapFilters}
                onCreateEntity={(entity) =>
                  setCreateFormState({ mode: 'create', initialTab: entity })
                }
                selectedNetwork={selectedNetwork}
                selectedThing={selectedThing}
                selectedThingKeys={mapSelection.thingKeys}
                entityFocus={mapFocus}
                focusThingRequest={focusThingRequest}
                onFilterItemSelect={(facet, key) => {
                  const focus = { facet, key }
                  const selected = resolveMapSelection(
                    viewThings,
                    focus,
                    mapFilters.crossfilter
                  )
                  const owner = viewThings.find((thing) =>
                    selected.thingKeys.has(getThingKey(thing))
                  )
                  if (owner && selected.thingKeys.size === 1) {
                    onMapThingSelect(owner)
                  } else {
                    clearThingSelection()
                  }
                  setMapFocus(focus)
                  setFocusThingRequest({ thingKeys: selected.thingKeys })
                  setTableCollapsed(false)
                }}
                onClearSelection={() => {
                  setMapFocus(null)
                  setFocusThingRequest(null)
                  clearThingSelection()
                }}
                asOfLabel={
                  isSnapshot && asOfDate
                    ? dayjs.utc(asOfDate).format('MMM D \u00b7 HH:mm') + ' UTC'
                    : null
                }
                onThingSelect={(thing, selection) => {
                  onMapThingSelect(thing)
                  setFocusThingRequest(null)
                  const index =
                    selection?.datastreamId == null
                      ? -1
                      : (thing.Datastreams ?? []).findIndex(
                          (ds) =>
                            String(ds['@iot.id'] ?? ds.id ?? '') ===
                            selection.datastreamId
                        )
                  setMapFocus(
                    index < 0
                      ? {
                          facet: 'things',
                          key: getThingKey(thing),
                        }
                      : {
                          facet: 'datastreams',
                          key: getMapDatastreamKey(
                            thing,
                            thing.Datastreams[index],
                            index
                          ),
                        }
                  )
                }}
                onCreateThingAt={(point) => {
                  setCreateFormState({
                    mode: 'create',
                    latitude: point.latitude,
                    longitude: point.longitude,
                    initialTab: 'thing',
                  })
                }}
                asOfReferenceTime={isSnapshot ? asOfDate : null}
                statusOverlay={
                  isSnapshot && asOfDate ? (
                    <AsOfMapStatus
                      isLoading={mapSnapshotLoading}
                      error={mapSnapshotError}
                      failedSourceCount={mapSnapshotFailedEndpoints.length}
                      readingsUnavailableCount={
                        mapSnapshotReadingsUnavailable.length
                      }
                      approximateCount={mapApproximateCount}
                      lostCount={mapLostCount}
                    />
                  ) : null
                }
              />
            ) : null}
            <TimelineScrubber thing={selectedThing} embedded />
          </>
        }
      >
        <DatastreamTable
          thing={selectedThing}
          rows={tableRows}
          highlightedKeys={highlightedRows}
          focusRowKey={highlightedRows.values().next().value ?? null}
          focusRequest={tableCollapsed ? null : mapFocus}
          isSnapshot={isSnapshot}
          asOfDate={asOfDate}
          snapshotError={mapSnapshotError}
          onSelectDatastream={(datastream) => {
            const thing =
              (datastream as MapDatastreamRow).__thing ?? selectedThing
            if (!thing) return
            onMapThingSelect(thing)
            setMapFocus({
              facet: 'datastreams',
              key: (datastream as MapDatastreamRow).__mapKey,
            })
            setFocusThingRequest({ thingKeys: new Set([getThingKey(thing)]) })
          }}
          onOpenDetails={(datastream) => {
            void openChartForDatastream(
              datastream,
              (datastream as MapDatastreamRow).__thing
            )
          }}
          onEditDatastream={(datastream) => {
            const payload = buildDatastreamEditFormState({
              datastream,
              selectedThing:
                (datastream as MapDatastreamRow).__thing ?? selectedThing,
            })
            if (!payload) return

            setCreateFormState({
              mode: 'edit',
              initialTab: 'datastream',
              initialSingleDataSourceEndpoint: payload.sourceEndpoint,
              initialSingleDraft: payload.initialSingleDraft,
              editTargets: payload.editTargets as Partial<
                Record<FormTabKey, string>
              >,
            })
          }}
        />
      </MapTableLayout>
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
        isOpen={isChartOpen}
        onClose={resetChartState}
        isSnapshot={isSnapshot}
        asOfDate={asOfDate}
        isAsOfFallback={asOfWindowFallback}
        compareAsOfDate={compareAsOfDate}
        compareAligned={compareAligned}
        onCompareAsOfDateChange={(date) => {
          void changeCompareAsOfDate(date)
        }}
        datastreamChoices={availableDatastreams}
        selectedDatastreamKeys={selectedDatastreamKeysForChart}
        listedDatastreamKeys={listedDatastreamKeys}
        onToggleDatastream={(key) => { void toggleChartDatastream(key) }}
        onRemoveDatastream={(key) => { void removeChartDatastream(key) }}
        datastream={selectedDatastream}
        observations={observations}
        comparisonDatastream={comparisonDatastream}
        comparisonObservations={comparisonObservations}
        allSeries={allSeries}
        loading={obsLoading}
        error={obsError}
        start={obsStart}
        end={obsEnd}
        onApplyRange={applyObservationRange}
        onDownloadAllDatastreams={downloadAllDatastreamsCsv}
        activeDatastreamIds={activeDatastreamIds}
        onResetRange={() => {
          applyObservationRange(null, null)
        }}
      />
      {/* Timeline scrubber — only visible in snapshot mode with a thing selected */}

      {/* Existence dialog — floating popup when asOfDate is outside the Thing's lifetime */}
      {isSnapshot &&
        existenceState !== 'exists' &&
        selectedThing &&
        !existenceDialogDismissed && (
          <AsOfExistenceDialog
            thingName={String(selectedThing.name ?? '')}
            existenceState={existenceState}
            existenceRange={existenceRange}
            endpoint={selectedThing.__sourceEndpoint}
            onDismiss={() => setExistenceDialogDismissed(true)}
          />
        )}
    </div>
  )
}
