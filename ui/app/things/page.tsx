"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import { LoadingScreen } from "../../components/LoadingScreen";
import { buildThingFields } from "./utils";
import { useTranslation } from "react-i18next";
import ThingCreator from "./ThingCreator";
import { useThingCRUDHandler } from "./ThingCRUDHandler";

const item = siteConfig.items.find(i => i.label === "Things");

export default function Things() {
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState<Record<string, any>>({});
  const [things, setThings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editThing, setEditThing] = React.useState<any | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);

  React.useEffect(() => {
    refetchAll();
  }, []);

  React.useEffect(() => {
    setThings(entities.things || []);
    setLoading(entitiesLoading);
    setError(entitiesError ? String(entitiesError) : null);
  }, [entities, entitiesLoading, entitiesError]);

  const locationOptions = (entities?.locations || []).map(loc => ({
    label: loc.name || `Location ${loc["@iot.id"]}`,
    value: loc["@iot.id"]
  }));

  const thingFields = React.useMemo(
    () => buildThingFields({ t, locationOptions }),
    [t, locationOptions]
  );

  const filtered = things.filter(thing =>
    JSON.stringify(thing).toLowerCase().includes(search.toLowerCase())
  );

  // Initialize CRUD handlers
  const {
    handleCancelCreate,
    handleCancelEdit,
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete,
    fetchThingWithExpand,
  } = useThingCRUDHandler({
    item,
    token,
    setShowCreate,
    setExpanded,
    setEditThing,
    setCreateLoading,
    setCreateError,
    setEditLoading,
    setEditError,
    refetchAll,
    setNestedEntitiesMap,
    setThings,
  });

  React.useEffect(() => {
    if (things.length > 0) {
      things.forEach(t => {
        fetchThingWithExpand(t["@iot.id"]);
      });
    }
  }, [things, token]);

  if (loading) return <LoadingScreen />;
  if (error) return <p>{error}</p>;

  const entityListComponent = (
    <EntityList
      items={filtered}
      fields={thingFields}
      expandedId={expanded}
      onItemSelect={setExpanded}
      entityType="things"
      onEdit={handleEdit}
      onSaveEdit={handleSaveEdit}
      onDelete={handleDelete}
      onCreate={handleCreate}
      handleCancelCreate={handleCancelCreate}
      handleCancelEdit={handleCancelEdit}
      showCreateForm={false}
      isCreating={createLoading}
      createError={createError}
      editEntity={editThing}
      isEditing={editLoading}
      editError={editError}
      token={token}
      nestedEntities={nestedEntitiesMap}
      sortOrder=""
      setSortOrder={() => {}}
    />
  );

  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="Things"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded(null);
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
      />
      {showCreate && (
        <div className="mb-6">
          <ThingCreator
            onCreate={handleCreate}
            onCancel={handleCancelCreate}
            isLoading={createLoading}
            error={createError}
            locationOptions={locationOptions} 
            datastreamOptions={[]} 
            observationTypeOptions={[]} 
            unitOfMeasurementOptions={[]} 
            sensorOptions={[]} 
            observedPropertyOptions={[]}          />
        </div>
      )}
      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={null}
        showRightPanel={null}
        initialSplit={split}
      />
    </div>
  );
}
