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

"use client";
import * as React from "react";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { useTranslation } from "react-i18next";
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import { LoadingScreen } from "../../components/LoadingScreen";
import { buildLocationFields } from "./utils";
import { useLocationCRUDHandler } from "./LocationCRUDHandler";
import LocationCreator from "./LocationCreator";
import MapWrapper from "../../components/MapWrapper";

const item = siteConfig.items.find(i => i.label === "Locations");

export default function Locations() {
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();


  const [locations, setLocations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editLocation, setEditLocation] = React.useState<any | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split] = React.useState(0.55); 

  
  React.useEffect(() => {
    setLocations(entities.locations || []);
    setLoading(entitiesLoading || authLoading);
    setError(entitiesError || null);
  }, [entities, entitiesLoading, entitiesError, authLoading]);

  
  const {
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete
  } = useLocationCRUDHandler({
    item,
    token,
    setShowCreate,
    setExpanded,
    setEditLocation,
    setCreateLoading,
    setCreateError,
    setEditLoading,
    setEditError,
    setLocations,
    refetchAll
  });

  
  const handleCreateFromCreator = React.useCallback(
    (payload: any) => {
      if (!payload?.location) {
        setCreateError("Missing geometry");
        return;
      }
      if (payload.location.type !== "Point") {
        setCreateError("Only Point geometries are supported for creation");
        return;
      }
      const [lon, lat] = payload.location.coordinates || [];
      handleCreate({
        name: payload.name,
        description: payload.description,
        encodingType: payload.encodingType,
        longitude: lon,
        latitude: lat
      });
    },
    [handleCreate, setCreateError]
  );

  
  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditLocation(null);

  
  const locationFields = React.useMemo(() => buildLocationFields(t), [t]);

  
  const filtered = locations.filter(loc =>
    JSON.stringify(loc).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingScreen />;
  if (error) return <p className="p-4 text-red-500">{error}</p>;


  const listSection = (
    <div className="flex flex-col gap-4">
      {showCreate && (
        <LocationCreator
          onCreate={handleCreateFromCreator}
          onCancel={handleCancelCreate}
          isLoading={createLoading}
          error={createError}
        />
      )}
      <EntityList
        items={filtered}
        fields={locationFields}
        expandedId={expanded}
        onItemSelect={setExpanded}
        entityType="locations"
        onEdit={handleEdit}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onCreate={() => {}}
        handleCancelCreate={handleCancelCreate}
        handleCancelEdit={handleCancelEdit}
        showCreateForm={false}
        isCreating={createLoading}
        createError={createError}
        editEntity={editLocation}
        isEditing={editLoading}
        editError={editError}
        token={token}
        nestedEntities={{}}
        sortOrder=""
        setSortOrder={() => {}}
      />
    </div>
  );

  //Map just points
  const getCoordinates = (loc: any) =>
    Array.isArray(loc.location?.coordinates) && loc.location.type === "Point"
      ? loc.location.coordinates
      : null;
  const getId = (loc: any) => String(loc["@iot.id"]);
  const getLabel = (loc: any) => loc.name ?? "-";

  const rightPanel = showMap ? (
    <MapWrapper
      items={filtered}
      getCoordinates={getCoordinates}
      getId={getId}
      getLabel={getLabel}
      getGeoJSON={(loc: any) => loc.location ?? null}
      expandedId={expanded}
      onMarkerClick={id => setExpanded(id)}
      showMap={showMap}
      split={split}
      setSplit={() => {}}
    />
  ) : null;

  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="Locations"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded(null);
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
      />
      <SplitPanel
        leftPanel={listSection}
        rightPanel={rightPanel}
        showRightPanel={showMap}
        initialSplit={split}
      />
    </div>
  );
}