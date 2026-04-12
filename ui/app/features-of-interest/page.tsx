'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as React from 'react'

import { LoadingScreen } from '@/components/LoadingScreen'
import MapWrapper from '@/components/MapWrapper'
import { EntityActions } from '@/components/entity/EntityActions'
import { EntityList } from '@/components/entity/EntityList'
import { SplitPanel } from '@/components/layout/SplitPanel'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'
import { useEntities } from '@/context/EntitiesContext'

import FeatureOfInterestCreator from '@/app/observations/FeatureOfInterestCreator'

import { useFeatureOfInterestCRUDHandler } from './FeatureOfInterestCRUDHandler'

const item = siteConfig.items.find((i) => i.label === 'FeaturesOfInterest')

export default function FeaturesOfInterestPage() {
  const {
    entities,
    loading: entitiesLoading,
    error: entitiesError,
    refetchAll,
  } = useEntities()
  const { token, loading: authLoading } = useAuth()

  const [featuresOfInterest, setFeaturesOfInterest] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [showCreate, setShowCreate] = React.useState(false)
  const [editFeatureOfInterest, setEditFeatureOfInterest] = React.useState<
    any | null
  >(null)
  const [editLoading, setEditLoading] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [showMap, setShowMap] = React.useState(true)
  const [split] = React.useState(0.55)

  React.useEffect(() => {
    setFeaturesOfInterest(entities.featuresOfInterest || [])
    setLoading(entitiesLoading || authLoading)
    setError(entitiesError || null)
  }, [entities, entitiesLoading, entitiesError, authLoading])

  const { handleEdit, handleSaveEdit, handleDelete, handleCancelEdit } =
    useFeatureOfInterestCRUDHandler({
      item,
      token,
      setExpanded,
      setEditFeatureOfInterest,
      setEditLoading,
      setEditError,
      setFeaturesOfInterest,
      refetchAll,
    })

  const handleCreated = React.useCallback(
    (createdFeatureOfInterest: any) => {
      setShowCreate(false)
      setEditError(null)
      refetchAll()
      const createdId = createdFeatureOfInterest?.['@iot.id']
      if (createdId != null) {
        setExpanded(String(createdId))
      }
    },
    [refetchAll]
  )

  const fields = React.useMemo(
    () => [
      {
        name: 'name',
        label: 'Name',
        required: true,
        type: 'text',
        defaultValue: '',
      },
      {
        name: 'description',
        label: 'Description',
        required: false,
        type: 'text',
        defaultValue: '',
      },
      {
        name: 'encodingType',
        label: 'Encoding Type',
        required: false,
        type: 'text',
        defaultValue: 'application/vnd.geo+json',
      },
    ],
    []
  )

  const filtered = featuresOfInterest.filter((featureOfInterest) =>
    JSON.stringify(featureOfInterest)
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  if (loading) return <LoadingScreen />
  if (error) return <p className="p-4 text-red-500">{error}</p>

  const getCoordinates = (featureOfInterest: any) => {
    const feature = featureOfInterest?.feature
    if (!feature) return null

    if (feature.type === 'Point' && Array.isArray(feature.coordinates)) {
      return feature.coordinates
    }

    if (feature.type === 'Polygon' && feature.coordinates?.[0]?.[0]) {
      return feature.coordinates[0][0]
    }

    return null
  }

  const getId = (featureOfInterest: any) =>
    String(featureOfInterest['@iot.id'] || '')
  const getLabel = (featureOfInterest: any) => featureOfInterest.name ?? '-'

  const listSection = (
    <div className="flex flex-col gap-4">
      {showCreate && (
        <FeatureOfInterestCreator
          onCreate={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}
      <EntityList
        items={filtered}
        fields={fields}
        expandedId={expanded}
        onItemSelect={setExpanded}
        entityType="featuresOfInterest"
        onEdit={handleEdit}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onCreate={() => {}}
        handleCancelCreate={() => setShowCreate(false)}
        handleCancelEdit={handleCancelEdit}
        showCreateForm={false}
        isCreating={false}
        createError={null}
        editEntity={editFeatureOfInterest}
        isEditing={editLoading}
        editError={editError}
        token={token}
        nestedEntities={{}}
        sortOrder=""
        setSortOrder={() => {}}
      />
    </div>
  )

  const rightPanel = showMap ? (
    <MapWrapper
      items={filtered}
      getCoordinates={getCoordinates}
      getId={getId}
      getLabel={getLabel}
      getGeoJSON={(featureOfInterest: any) => featureOfInterest.feature ?? null}
      expandedId={expanded}
      onMarkerClick={(id) => setExpanded(id)}
      showMap={showMap}
      split={split}
      setSplit={() => {}}
    />
  ) : null

  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="FeaturesOfInterest"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true)
          setExpanded(null)
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap((prev) => !prev)}
      />
      <SplitPanel
        leftPanel={listSection}
        rightPanel={rightPanel}
        showRightPanel={showMap}
        initialSplit={split}
      />
    </div>
  )
}
