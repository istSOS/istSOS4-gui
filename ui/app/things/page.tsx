"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Divider, Input } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import EntityCreator from "../../components/EntityCreator";
import updateData from "../../server/updateData";
import { useEntities } from "../../context/EntitiesContext";
import { useTranslation } from "react-i18next";

// Define color from site configuration
export const mainColor = siteConfig.main_color;

// Retrieve specific items from site configuration
const item = siteConfig.items.find(i => i.label === "Things");

export default function Things() {
  // Initialize translation hook
  const { t } = useTranslation();

  // Retrieve entities from context and refetch on mount
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  React.useEffect(() => {
    refetchAll();
  }, []);

  // Define the fields for thing creation
  const thingFields = [
    { name: "name", label: t("things.name"), required: true },
    { name: "description", label: t("things.description"), required: false },
    {
      name: "properties",
      label: t("things.properties"),
      type: "properties",
      required: false
    },
  ];

  // Labels for columns in the things table
  const getLabel = (key) => {
    // Map keys to translated labels
    const map = {
      name: t("things.name"),
      description: t("things.description"),
      properties: t("things.properties"),
    };
    return map[key] || key;
  };

  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [things, setThings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");

  // State for creating things
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);

  // State for editing things
  const [editThing, setEditThing] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);

  // State for expanded accordion items
  const [expanded, setExpanded] = React.useState(null);

  // Update things state when entities change
  React.useEffect(() => {
    setThings(entities.things);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  // Filter things based on search input
  const filtered = things.filter(thing =>
    JSON.stringify(thing).toLowerCase().includes(search.toLowerCase())
  );

  // --- CREATION ---
  const handleCreate = async (newThing) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        name: newThing.name,
        description: newThing.description || "",
        properties: {},
      };

      // If properties are provided, convert to object
      if (Array.isArray(newThing.properties) && newThing.properties.length > 0) {
        payload.properties = Object.fromEntries(
          newThing.properties
            .filter(p => p.key)
            .map(p => [p.key, p.value])
        );
      }

      // Create the thing using the server function
      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);

      // Refetch things after creation
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
    } catch (err) {
      setCreateError(err.message || "Error creating thing");
    } finally {
      setCreateLoading(false);
    }
  };

  // --- EDITING ---
  const handleEdit = async (thing) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        name: thing.name,
        description: thing.description || "",
        properties: {},
      };

      if (Array.isArray(thing.properties) && thing.properties.length > 0) {
        const props = Object.fromEntries(
          thing.properties
            .filter(p => p.key)
            .map(p => [p.key, p.value])
        );
        if (Object.keys(props).length > 0) {
          payload.properties = props;
        }
      }

      await updateData(`${item.root}(${editThing["@iot.id"]})`, token, payload);
      setEditThing(null);

      // Refetch things after editing
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
    } catch (err) {
      setEditError(err.message || "Error editing thing");
    } finally {
      setEditLoading(false);
    }
  };

  // -- RENDER --
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="min-h-screen p-4">
      <SecNavbar title="Things" />
      <Divider style={{ backgroundColor: "white", height: 1, margin: "8px 0" }} />
      <div className="flex mb-4">
        <SearchBar value={search} onChange={setSearch} />
        <Button
          radius="sm"
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-thing");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0, marginLeft: 8 }}
          aria-label="Add Thing"
        >
          +
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p>No available things.</p>
      ) : (
        <Accordion
          variant="splitted"
          selectedKeys={expanded ? [expanded] : []}
          onSelectionChange={(key) => {
            if (typeof key === "string") setExpanded(key);
            else if (key && typeof key === "object" && "has" in key) {
              const arr = Array.from(key);
              setExpanded(arr[0] != null ? String(arr[0]) : null);
            } else if (Array.isArray(key)) {
              setExpanded(key[0] ?? null);
            } else {
              setExpanded(null);
            }
          }}
        >
          {[
            ...(showCreate ? [
              <AccordionItem
                key="new-thing"
                id="thing-accordion-item-new-thing"
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">New Thing</span>
                  </div>
                }
                value="new-thing"
              >
                <EntityCreator
                  fields={thingFields}
                  onCreate={handleCreate}
                  onCancel={() => setShowCreate(false)}
                  isLoading={createLoading}
                  error={createError}
                  initialValues={{
                    name: "New Thing",
                    description: "Thing Description",
                    properties: [],
                  }}
                />
              </AccordionItem>
            ] : []),
            ...filtered.map((tgs, idx) => (
              <AccordionItem
                key={tgs["@iot.id"] ?? idx}
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">{tgs.name ?? "-"}</span>
                    <span className="text-xs text-gray-500">{tgs.description ?? "-"}</span>
                  </div>
                }
              >
                {/* EDITING THING */}
                {editThing && editThing["@iot.id"] === tgs["@iot.id"] ? (
                  <EntityCreator
                    fields={thingFields}
                    onCreate={handleEdit}
                    onCancel={() => setEditThing(null)}
                    isLoading={editLoading}
                    error={editError}
                    initialValues={{
                      "@iot.id": tgs["@iot.id"],
                      name: tgs.name,
                      description: tgs.description,
                      properties: Object.entries(tgs.properties || {}).map(([key, value]) => ({ key, value })),
                    }}
                  />
                ) : (
                  <div className="mt-2 flex flex-row gap-8">
                    {/* SX col with self attributes */}
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(tgs).map(([key, value]) =>
                        (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[a-z]/.test(key)) ? null : (
                          <div key={key} className="flex items-center gap-2">
                            <label className="w-40 text-sm text-gray-700">
                              {key.includes("@iot") ? key.split("@")[0] : t(getLabel(key))}
                            </label>
                            <Input
                              size="sm"
                              readOnly
                              value={
                                typeof value === "object"
                                  ? JSON.stringify(value)
                                  : value?.toString() ?? "-"
                              }
                              className="flex-1"
                            />
                          </div>
                        )
                      )}
                    </div>
                    {/* Vertical divider */}
                    <div className="w-px bg-gray-300 mx-4" />
                    {/* DX col with linked attributes */}
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(tgs).map(([key, value]) =>
                        (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[A-Z]/.test(key)) ? null : (
                          <div key={key} className="flex items-center gap-2">
                            <label className="w-40 text-sm text-gray-700">
                              {key.includes("@iot") ? key.split("@")[0] : key}
                            </label>
                            <Button
                              radius="sm"
                              size="sm"
                              variant="solid"
                              onPress={() => {
                                alert(`Go to ${value}`);
                              }}
                            >
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value).split("/").pop() || String(value)}
                            </Button>
                          </div>
                        )
                      )}
                      {/* EDIT AND DELETE BUTTONS */}
                      <div className="flex justify-end mt-4 gap-2 relative">
                        <Button
                          radius="sm"
                          color="warning"
                          variant="bordered"
                          onPress={() => setEditThing(tgs)}
                        >
                          {t("general.edit")}
                        </Button>
                        <DeleteButton
                          endpoint={`${item.root}(${tgs["@iot.id"]})`}
                          token={token}
                          onDeleted={() =>
                            setThings(prev => prev.filter(o => o["@iot.id"] !== tgs["@iot.id"]))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </AccordionItem>
            )),
          ]}
        </Accordion>
      )}
    </div>
  );
}
