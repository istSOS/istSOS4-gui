"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { useTranslation } from "react-i18next";
import createData from "../../server/createData";
import updateData from "../../server/updateData";
import fetchData from "../../server/fetchData";
import deleteData from "../../server/deleteData";
//Reusable components
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import MapWrapper from "../../components/MapWrapper";
// Constants
export const mainColor = siteConfig.main_color;
const item = siteConfig.items.find(i => i.label === "Things");
// Main component
export default function Things() {
  // Hooks
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  // State management
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState({});
  const [things, setThings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);
  const [editThing, setEditThing] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);

  const defaultValues = {
    name: "New Thing",
    description: "Default Description",
    properties: {}
  };

  // Filter things
  const filtered = things.filter(thing => {
    const id = thing["@iot.id"];
    const nested = nestedEntitiesMap[id] || {};
    const matchesSearch = JSON.stringify(thing).toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Fetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);
  // Set things and loading/error states
  React.useEffect(() => {
    setThings(entities.things || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  // Thing fields configuration
  const thingFields = [
    { name: "name", label: t("things.name"), required: true, defaultValue: defaultValues.name },
    { name: "description", label: t("things.description"), required: false, defaultValue: defaultValues.description },
    {
      name: "properties",
      label: t("things.properties"),
      type: "properties",
      required: false
    },
  ];

  // Handlers for CRUD operations
  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditThing(null);
  const handleCreate = async (newThing) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        name: newThing.name,
        description: newThing.description,
        properties: Array.isArray(newThing.properties) && newThing.properties.length > 0
          ? Object.fromEntries(
            newThing.properties
              .filter(p => p.key)
              .map(p => [p.key, p.value])
          )
          : {},
      };

      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
      // Auto-expand the newly created thing
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchThingWithExpand(newId);
      }
    } catch (err) {
      setCreateError(err.message || "Error creating thing");
    } finally {
      setCreateLoading(false);
    }
  };
  const handleEdit = (entity) => {
    setEditThing(entity);
  };
  const handleSaveEdit = async (updatedThing, originalThing) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        name: updatedThing.name,
        description: updatedThing.description,
        properties: Array.isArray(updatedThing.properties) && updatedThing.properties.length > 0
          ? Object.fromEntries(
            updatedThing.properties
              .filter(p => p.key)
              .map(p => [p.key, p.value])
          )
          : {},
      };

      await updateData(`${item.root}(${originalThing["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
      setExpanded(String(originalThing["@iot.id"]));
      setEditThing(null);
      await fetchThingWithExpand(originalThing["@iot.id"]);
    } catch (err) {
      setEditError(err.message || "Error updating thing");
    } finally {
      setEditLoading(false);
    }
  };
  const handleDelete = async (id) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
    } catch (err) {
      console.error("Error deleting thing:", err);
    }
  };
  // Fetch things with expanded nested entities
  const fetchThingWithExpand = async (thingId) => {
    const nested = siteConfig.items.find(i => i.label === "Things").nested;
    const nestedData = {};
    await Promise.all(
      nested.map(async (nestedKey) => {
        const url = `${item.root}(${thingId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) {
          nestedData[nestedKey] = data[nestedKey];
        }
      })
    );
    setNestedEntitiesMap(prev => ({
      ...prev,
      [thingId]: nestedData
    }));
  };
  // Example call on mount
  React.useEffect(() => {
    if (things.length > 0) {
      things.forEach(t => {
        fetchThingWithExpand(t["@iot.id"]);
      });
    }
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entitiesLoading, entitiesError, token, things]);
  // Render loading and error states
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  // Render components
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
      showCreateForm={showCreate}
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

  // Main render
  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="Things"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded("new-entity");
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
      />
      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={null}
        showRightPanel={null} //null to hide map
        initialSplit={split}
      />
    </div>
  );
}