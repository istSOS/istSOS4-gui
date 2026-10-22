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
import TimelineScrubber from '@/features/as-of/components/TimelineScrubber'
import AsOfExistenceDialog from '@/features/as-of/components/AsOfExistenceDialog'
import FormModal from '@/features/forms/components/FormModal'
import ChartModal from '@/features/observations/components/ChartModal'
import { Card } from '@heroui/card'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'

dayjs.extend(utc)

import { siteConfig } from '@/config/site'
import { Datastream, Thing } from '@/types/domain'

import { useAuth } from '@/context/AuthContext'
import { useAsOf } from '@/context/AsOfContext'
import {
  FormTabKey,
  buildDatastreamEditFormState,
} from './home/buildDatastreamEditFormState'
import { CsvDownloadPayload, buildDatastreamWorkbookPayload } from './home/downloadWorkbook'
import { FormDataMap } from '@/features/forms/components/wizard/types'
import { useDataSourcesSync } from './home/useDataSourcesSync'
import { useChartState } from './home/useChartState'
import { useAsOfThing, type ExistenceState } from '@/features/as-of/hooks/useAsOfThing'
import { useAsOfMapThings } from '@/features/as-of/hooks/useAsOfMapThings'
import AsOfMapStatus from '@/features/as-of/components/AsOfMapStatus'
import {
  buildLocationsForForm,
  buildNetworksForForm,
  normalizeEndpoint,
} from './home/utils'

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

const LeafletMap = dynamic(() => import('@/features/map/components/LeafletMap'), {
  ssr: false,
})

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
  const {
    localThings,
    localSensors,
    localObservedProperties,
    localNetworks,
  } = useDataSourcesSync({
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
    isPanelOpen,
    selectedObservedPropertyName,
    tableObservedPropertyFilter,
    selectedThingKeysForChart,
    selectedObservedPropertyNamesForChart,
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
    setIsChartOpen,
    fetchObservations,
    closePanel,
    resetChartState,
    onMapThingSelect,
    openChartForDatastream,
    openChartForThingAndObservedProperties,
    applyObservationRange,
    changeActiveDatastreams,
  } = useChartState({
    localThings: viewThings,
    liveThings: localThings,
    thingsResolvedFor: viewThingsResolvedFor,
    token,
    asOfDate,
  })

  // Resolve the thing as it existed at asOfDate (mock for dummy data, stub for real)
  const {
    snapshotThing,
    isLoading: snapshotLoading,
    error: snapshotError,
    existenceState,
    existenceRange,
  } = useAsOfThing({
    thing: selectedThing,
    asOfDate,
  })

  // Track whether the user has explicitly dismissed the existence dialog
  const [existenceDialogDismissed, setExistenceDialogDismissed] = useState(false)

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

  const downloadAllDatastreamsCsv = async (): Promise<CsvDownloadPayload | null> => {
    return buildDatastreamWorkbookPayload({
      selectedThing,
      obsStart,
      obsEnd,
      fetchObservations,
    })
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      {isClientMounted ? (
        <LeafletMap
          things={viewThings}
          selectedNetwork={selectedNetwork}
          asOfLabel={
            isSnapshot && asOfDate
              ? dayjs.utc(asOfDate).format('MMM D \u00b7 HH:mm') + ' UTC'
              : null
          }
          onThingSelect={onMapThingSelect}
          onCreateThingAt={(point) => {
            setCreateFormState({
              mode: 'create',
              latitude: point.latitude,
              longitude: point.longitude,
              initialTab: 'thing',
            })
          }}
          asOfReferenceTime={isSnapshot ? asOfDate : null}
        />
      ) : null}
      {isSnapshot && asOfDate ? (
        <AsOfMapStatus
          isLoading={mapSnapshotLoading}
          error={mapSnapshotError}
          failedSourceCount={mapSnapshotFailedEndpoints.length}
          readingsUnavailableCount={mapSnapshotReadingsUnavailable.length}
          approximateCount={mapApproximateCount}
          lostCount={mapLostCount}
        />
      ) : null}
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
        onClose={() => {
          setIsChartOpen(false)
          resetChartState()
        }}
        isSnapshot={isSnapshot}
        asOfDate={asOfDate}
        isAsOfFallback={asOfWindowFallback}
        compareAsOfDate={compareAsOfDate}
        compareAligned={compareAligned}
        onCompareAsOfDateChange={(date) => {
          void changeCompareAsOfDate(date)
        }}
        things={viewThings}
        thing={selectedThing}
        selectedObservedPropertyName={selectedObservedPropertyName}
        selectedThingKeys={selectedThingKeysForChart}
        selectedObservedPropertyNames={selectedObservedPropertyNamesForChart}
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
        onActiveDatastreamsChange={changeActiveDatastreams}
        onThingKeysChange={(thingKeys) => {
          void openChartForThingAndObservedProperties(
            thingKeys,
            selectedObservedPropertyNamesForChart
          )
        }}
        onObservedPropertyNamesChange={(observedPropertyNames) => {
          void openChartForThingAndObservedProperties(
            selectedThingKeysForChart,
            observedPropertyNames
          )
        }}
        onResetRange={() => {
          applyObservationRange(null, null)
        }}
      />
      {/* Timeline scrubber — only visible in snapshot mode with a thing selected */}
      <TimelineScrubber thing={selectedThing} />

      {/* Existence dialog — floating popup when asOfDate is outside the Thing's lifetime */}
      {isSnapshot && existenceState !== 'exists' && selectedThing && !existenceDialogDismissed && (
        <AsOfExistenceDialog
          thingName={String(selectedThing.name ?? '')}
          existenceState={existenceState}
          existenceRange={existenceRange}
          onDismiss={() => setExistenceDialogDismissed(true)}
        />
      )}

      {isPanelOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[4000] pb-[env(safe-area-inset-bottom)] transition-opacity duration-200"
          style={{ opacity: snapshotLoading ? 0.5 : 1 }}
        >
          <Card className="max-h-[38vh] overflow-hidden rounded-none">
            <div className="max-h-[32vh] overflow-auto pb-2">
              <DatastreamTable
                thing={snapshotThing}
                observedPropertyNameFilter={tableObservedPropertyFilter}
                isSnapshot={isSnapshot}
                asOfDate={asOfDate}
                snapshotError={snapshotError}
                onClose={closePanel}
                onCreateDatastream={() => {
                  setCreateFormState({
                    mode: 'create',
                    initialTab: 'datastream',
                  })
                }}
                onOpenDetails={openChartForDatastream}
                onEditDatastream={(datastream) => {
                  const payload = buildDatastreamEditFormState({
                    datastream,
                    selectedThing,
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
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
