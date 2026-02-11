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
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import { LoadingScreen } from '@/components/LoadingScreen'
import { EntityActions } from '@/components/entity/EntityActions'
import { EntityList } from '@/components/entity/EntityList'
import { SplitPanel } from '@/components/layout/SplitPanel'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'
import { useEntities } from '@/context/EntitiesContext'

import { useSensorCRUDHandler } from './SensorCRUDHandler'
import SensorCreator from './SensorCreator'
import { buildSensorFields } from './utils'

const item = siteConfig.items.find((i) => i.label === 'Sensors')

export default function Sensors() {
  const { t } = useTranslation()
  const {
    entities,
    loading: entitiesLoading,
    error: entitiesError,
    refetchAll,
  } = useEntities()
  const { token, loading: authLoading } = useAuth()
  const router = useRouter()

  // Local state
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState<
    Record<string, any>
  >({})
  const [sensors, setSensors] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [showCreate, setShowCreate] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [editSensor, setEditSensor] = React.useState<any | null>(null)
  const [editLoading, setEditLoading] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [showMap, setShowMap] = React.useState(true)
  const [split, setSplit] = React.useState(0.5)

  // Sync sensors from global entities context
  React.useEffect(() => {
    setSensors(entities.sensors || [])
    setLoading(entitiesLoading || authLoading)
    setError(entitiesError || null)
  }, [entities, entitiesLoading, entitiesError, authLoading])

  // CRUD handler hook
  const {
    handleCancelCreate,
    handleCancelEdit,
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete,
  } = useSensorCRUDHandler({
    item,
    token,
    setShowCreate,
    setExpanded,
    setEditSensor,
    setCreateLoading,
    setCreateError,
    setEditLoading,
    setEditError,
    refetchAll,
    setSensors,
  })

  // Fields
  const sensorFields = React.useMemo(() => buildSensorFields(t), [t])

  // Search filter
  const filtered = sensors.filter((sensor) =>
    JSON.stringify(sensor).toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <LoadingScreen />
  if (error) return <p>{error}</p>

  const listSection = (
    <div className="flex flex-col gap-4">
      {showCreate && (
        <SensorCreator
          onCreate={handleCreate}
          onCancel={handleCancelCreate}
          isLoading={createLoading}
          error={createError}
        />
      )}
      <EntityList
        items={filtered}
        fields={sensorFields}
        expandedId={expanded}
        onItemSelect={setExpanded}
        entityType="sensors"
        onEdit={handleEdit}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onCreate={() => {}}
        handleCancelCreate={handleCancelCreate}
        handleCancelEdit={handleCancelEdit}
        showCreateForm={false}
        isCreating={createLoading}
        createError={createError}
        editEntity={editSensor}
        isEditing={editLoading}
        editError={editError}
        token={token}
        nestedEntities={nestedEntitiesMap}
        sortOrder=""
        setSortOrder={() => {}}
      />
    </div>
  )

  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="Sensors"
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
        rightPanel={null}
        showRightPanel={null}
        initialSplit={split}
      />
    </div>
  )
}
