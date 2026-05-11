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
import { Card } from '@heroui/card'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'

import { siteConfig } from '@/config/site'
import { Datastream, Thing } from '@/types/domain'

import { useAuth } from '@/context/AuthContext'
import {
  FormTabKey,
  buildDatastreamEditFormState,
} from './home/buildDatastreamEditFormState'
import { CsvDownloadPayload, buildDatastreamWorkbookPayload } from './home/downloadWorkbook'
import { FormDataMap } from '@/features/forms/components/wizard/types'
import { useDataSourcesSync } from './home/useDataSourcesSync'
import { useChartState } from './home/useChartState'
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
    activeDatastreamIds,
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
    localThings,
    token,
  })

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
          things={localThings}
          selectedNetwork={selectedNetwork}
          onThingSelect={onMapThingSelect}
          onCreateThingAt={(point) => {
            setCreateFormState({
              mode: 'create',
              latitude: point.latitude,
              longitude: point.longitude,
              initialTab: 'thing',
            })
          }}
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
        things={localThings}
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
      {isPanelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[4000] pb-[env(safe-area-inset-bottom)]">
          <Card className="max-h-[38vh] overflow-hidden rounded-none">
            <div className="max-h-[32vh] overflow-auto pb-2">
              <DatastreamTable
                thing={selectedThing}
                observedPropertyNameFilter={tableObservedPropertyFilter}
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
