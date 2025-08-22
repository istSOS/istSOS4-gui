"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import createData from "../../server/createData";
import updateData from "../../server/updateData";
import fetchData from "../../server/fetchData";
import deleteData from "../../server/deleteData";
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import { LoadingScreen } from "../../components/LoadingScreen";
import { buildThingFields } from "./utils";
import { useTranslation } from "react-i18next";
import ThingCreator from "./ThingCreator";

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

  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditThing(null);

  // FIX: build nested Locations array inline if newLocation present
  const handleCreate = async (newThing: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const thingPayload: any = {
        name: newThing.name,
        description: newThing.description,
        properties:
          newThing.properties && Object.keys(newThing.properties).length > 0
            ? newThing.properties
            : {}
      };

      if (newThing.newLocation) {
        thingPayload.Locations = [
          {
            name: newThing.newLocation.name,
            description: newThing.newLocation.description,
            encodingType: newThing.newLocation.encodingType || "application/vnd.geo+json",
            location: newThing.newLocation.location
          }
        ];
      } else if (newThing.Location) {
        thingPayload.Locations = [{ "@iot.id": Number(newThing.Location) }];
      }

      await createData(item.root, token, thingPayload);

      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchThingWithExpand(newId);
      }
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err?.message || "Error creating Thing");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = (entity: any) => setEditThing(entity);

  const handleSaveEdit = async (updatedThing: any, originalThing: any) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const originalLocId = originalThing?.Locations?.[0]?.["@iot.id"];
      const newLocId = updatedThing.Location || null;

      const payload: any = {
        name: updatedThing.name,
        description: updatedThing.description,
        properties:
          Array.isArray(updatedThing.properties) && updatedThing.properties.length > 0
            ? Object.fromEntries(
                updatedThing.properties
                  .filter((p: any) => p.key)
                  .map((p: any) => [p.key, p.value])
              )
            : {}
      };

      if (Number(newLocId) !== Number(originalLocId)) {
        if (newLocId) payload.Locations = [{ "@iot.id": Number(newLocId) }];
        else payload.Locations = [];
      }

      await updateData(`${item.root}(${originalThing["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
      setExpanded(String(originalThing["@iot.id"]));
      setEditThing(null);
      await fetchThingWithExpand(originalThing["@iot.id"]);
    } catch (err: any) {
      setEditError(err?.message || "Error updating Thing");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      await refetchAll();
    } catch (err) {
      console.error("Error deleting Thing:", err);
    }
  };

  const fetchThingWithExpand = async (thingId: string | number) => {
    const nested = siteConfig.items.find(i => i.label === "Things")?.nested || [];
    const nestedData: Record<string, any> = {};
    await Promise.all(
      nested.map(async (nestedKey: string) => {
        const url = `${item.root}(${thingId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) nestedData[nestedKey] = data[nestedKey];
      })
    );
    setNestedEntitiesMap(prev => ({ ...prev, [thingId]: nestedData }));
  };

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
            error={createError} locationOptions={locationOptions}          />
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