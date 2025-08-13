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
import LocationCreator from "./LocationCreator";
import { Button, Accordion, AccordionItem } from "@heroui/react";

export const mainColor = siteConfig.main_color;
const item = siteConfig.items.find(i => i.label === "Things");
const locationItem = siteConfig.items.find(i => i.label === "Locations");
const historicalLocationItem = siteConfig.items.find(i => i.label === "HistoricalLocations");

export default function Things() {
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token } = useAuth();
  const router = useRouter();

  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState<Record<string, any>>({});
  const [things, setThings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<any>(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editThing, setEditThing] = React.useState<any>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);

  const [locationModalOpen, setLocationModalOpen] = React.useState(false);
  const [pendingLocation, setPendingLocation] = React.useState<any>(null);

  const [standaloneLocationModalOpen, setStandaloneLocationModalOpen] = React.useState(false);
  const [standaloneLocationLoading, setStandaloneLocationLoading] = React.useState(false);
  const [standaloneLocationError, setStandaloneLocationError] = React.useState<string | null>(null);

  const defaultValues = {
    name: "New Thing",
    description: "Default Description",
    properties: {},
    Locations: null
  };

  const filtered = things.filter(thing =>
    JSON.stringify(thing).toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    refetchAll();
  }, []);

  React.useEffect(() => {
    setThings(entities.things || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  const locationOptions = (entities?.locations || []).map(loc => ({
    label: loc.name || `Location ${loc["@iot.id"]}`,
    value: loc["@iot.id"]
  }));

  const thingFields = [
    { name: "name", label: "Name", required: true, defaultValue: defaultValues.name },
    { name: "description", label: "Description", required: false, defaultValue: defaultValues.description },
    {
      name: "properties",
      label: "Properties",
      type: "properties",
      required: false
    },
    {
      name: "Location",
      label: "Location",
      required: false,
      defaultValue: defaultValues.Locations,
      type: "select",
      options: locationOptions,
      render: ({ value, onChange }) => (
        <div className="flex flex-col gap-2">
          <select
            value={value || ""}
            onChange={e => onChange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Select Location</option>
            {locationOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
            onClick={() => setLocationModalOpen(true)}
          >
            + Create new Location (pending)
          </button>
          {pendingLocation && (
            <span className="text-green-700 text-xs">
              New Location ready to be created with the Thing.
            </span>
          )}
        </div>
      )
    }
  ];

  const handleCancelCreate = () => {
    setShowCreate(false);
    setPendingLocation(null);
  };
  const handleCancelEdit = () => setEditThing(null);

  const handleCreate = async (newThing) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      let locationId = newThing.Location;

      if (pendingLocation) {
        const locRes = await createData(locationItem.root, token, pendingLocation);
        locationId = locRes["@iot.id"];
        setPendingLocation(null);
      }

      const thingPayload: any = {
        name: newThing.name,
        description: newThing.description,
        properties: Array.isArray(newThing.properties) && newThing.properties.length > 0
          ? Object.fromEntries(
            newThing.properties
              .filter(p => p.key)
              .map(p => [p.key, p.value])
          )
          : {}
      };

      if (locationId) {
        thingPayload.Locations = [{ "@iot.id": Number(locationId) }];
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
      setExpanded(null);
    } catch (err: any) {
      setCreateError(err.message || "Error creating Thing");
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
      const originalLocId = originalThing?.Locations?.[0]?.["@iot.id"];
      const newLocId = updatedThing.Location || null;

      const payload: any = {
        name: updatedThing.name,
        description: updatedThing.description,
        properties: Array.isArray(updatedThing.properties) && updatedThing.properties.length > 0
          ? Object.fromEntries(
            updatedThing.properties
              .filter(p => p.key)
              .map(p => [p.key, p.value])
          )
          : {}
      };

      await updateData(`${item.root}(${originalThing["@iot.id"]})`, token, payload);

      if (newLocId && Number(newLocId) !== Number(originalLocId) && historicalLocationItem) {
        await createData(
          historicalLocationItem.root,
          token,
          {
            Thing: { "@iot.id": Number(originalThing["@iot.id"]) },
            Locations: [{ "@iot.id": Number(newLocId) }]
          }
        );
      }

      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
      setExpanded(String(originalThing["@iot.id"]));
      setEditThing(null);
      await fetchThingWithExpand(originalThing["@iot.id"]);
    } catch (err: any) {
      setEditError(err.message || "Error updating Thing");
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
      console.error("Error deleting Thing:", err);
    }
  };

  const fetchThingWithExpand = async (thingId) => {
    const nested = siteConfig.items.find(i => i.label === "Things").nested;
    const nestedData: Record<string, any> = {};
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

  React.useEffect(() => {
    if (things.length > 0) {
      things.forEach(t => {
        fetchThingWithExpand(t["@iot.id"]);
      });
    }
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entitiesLoading, entitiesError, token, things]);

  const handleStandaloneLocationCreate = async (payload: any) => {
    setStandaloneLocationLoading(true);
    setStandaloneLocationError(null);
    try {
      await createData(locationItem.root, token, payload);
      setStandaloneLocationModalOpen(false);
      await refetchAll();
      router.refresh();
    } catch (err: any) {
      setStandaloneLocationError(err.message || "Error creating Location");
    } finally {
      setStandaloneLocationLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{String(error)}</p>;

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

      <div className="w-full flex justify-end mb-4">
        <Button
          size="sm"
          color="default"
          onPress={() => setStandaloneLocationModalOpen(true)}
        >
          + Create Location
        </Button>
      </div>

      {standaloneLocationModalOpen && (
        <div className="mb-6 bg-gray-100 p-1 rounded-md">
          <div className="flex items-center w-full">
            <div className="flex-1">
              <Accordion
                isCompact
                selectedKeys={["new-location"]}
              >
                <AccordionItem
                  key="new-location"
                  id="entity-accordion-item-new-location"
                  title={
                    <div className="grid grid-cols-5 gap-2 pl-2 items-center w-full">
                      <span className="font-bold text-lg text-gray-800">New Location</span>
                    </div>
                  }
                  value="new-location"
                >
                  <LocationCreator
                    onCreate={handleStandaloneLocationCreate}
                    onCancel={() => setStandaloneLocationModalOpen(false)}
                    isLoading={standaloneLocationLoading}
                    error={standaloneLocationError}
                  />
                </AccordionItem>
              </Accordion>
            </div>
            <div className="w-32" />
          </div>
        </div>
      )}

      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={null}
        showRightPanel={null}
        initialSplit={split}
      />

      {locationModalOpen && (
        <div className="mt-6 bg-gray-100 p-1 rounded-md">
          <div className="flex items-center w-full">
            <div className="flex-1">
              <Accordion
                isCompact
                selectedKeys={["pending-location"]}
              >
                <AccordionItem
                  key="pending-location"
                  id="entity-accordion-item-pending-location"
                  title={
                    <div className="grid grid-cols-5 gap-2 pl-2 items-center w-full">
                      <span className="font-bold text-lg text-gray-800">New Location (Pending for Thing)</span>
                    </div>
                  }
                  value="pending-location"
                >
                  <LocationCreator
                    onCreate={loc => {
                      setPendingLocation(loc);
                      setLocationModalOpen(false);
                    }}
                    onCancel={() => setLocationModalOpen(false)}
                  />
                </AccordionItem>
              </Accordion>
            </div>
            <div className="w-32" />
          </div>
        </div>
      )}
    </div>
  );
}