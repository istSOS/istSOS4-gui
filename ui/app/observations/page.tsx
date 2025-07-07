"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import DeleteButton from "../../components/customButtons/deleteButton";
import deleteData from "../../server/deleteData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Divider, Input } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";
import { useEntities } from "../../context/EntitiesContext";
import createData from "../../server/createData";
import EntityCreator from "../../components/EntityCreator";

export const mainColor = siteConfig.main_color;

const item = siteConfig.items.find(i => i.label === "Observations");

const observationFields = [
  {
    name: "phenomenonTime",
    label: "Phenomenon Time",
    type: "datetime-local",
    required: true,
  },
];

export default function Observations() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [observations, setObservations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();

  //function to create observations
  const handleCreate = async (newObservation: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        phenomenonTime: newObservation.phenomenonTime,
      };
      const res = await createData(item.root, token, payload);
      if (!res) throw new Error("Creation failed");
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item.root, token);
      setObservations(data?.value || []);
    } catch (err: any) {
      setCreateError(err.message || "Error creating observation");
    } finally {
      setCreateLoading(false);
    }
  };

  // Refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  React.useEffect(() => {
    setObservations(entities.observations);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  const filtered = observations.filter(obs =>
    JSON.stringify(obs).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="min-h-screen p-4">
      <SecNavbar title="Observations" />
      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0" }}
      />
      <div className="flex mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search observations..."
        />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-observation");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0, marginLeft: 8 }}
          aria-label="Add Observation"
        >
          +
        </Button>
      </div>

      {filtered.length === 0 && !showCreate ? (
        <p>No available observations.</p>
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
            ...(showCreate
              ? [
                  <AccordionItem
                    key="new-observation"
                    id="observation-accordion-item-new-observation"
                    title={
                      <div className="flex items-baseline gap-3">
                        <span className="font-bold text-lg text-gray-800">New Observation</span>
                      </div>
                    }
                    value="new-observation"
                  >
                    <EntityCreator
                      fields={observationFields}
                      onCreate={handleCreate}
                      onCancel={() => setShowCreate(false)}
                      isLoading={createLoading}
                      error={createError}
                      initialValues={{
                        phenomenonTime: "",
                      }}
                    />
                  </AccordionItem>
                ]
              : []),
            ...filtered.map((obs, idx) => (
              <AccordionItem
                key={obs["@iot.id"] ?? idx}
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">{obs["@iot.id"] ?? "-"}</span>
                    <span className="text-xs text-gray-500">{obs.description ?? "-"}</span>
                  </div>
                }
                value={String(obs["@iot.id"] ?? idx)}
              >
                <div className="mt-2 flex flex-row gap-8">
                  <div className="flex-1 flex flex-col gap-2">
                    {Object.entries(obs).map(([key, value]) =>
                      (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[a-z]/.test(key)) ? null : (
                        <div key={key} className="flex items-center gap-2">
                          <label className="w-40 text-sm text-gray-700">
                            {key.includes("@iot") ? key.split("@")[0] : key}
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
                  <div className="w-px bg-gray-300 mx-4" />
                  <div className="flex-1 flex flex-col gap-2">
                    {Object.entries(obs).map(([key, value]) =>
                      (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[A-Z]/.test(key)) ? null : (
                        <div key={key} className="flex items-center gap-2">
                          <label className="w-40 text-sm text-gray-700">
                            {key.includes("@iot") ? key.split("@")[0] : key}
                          </label>
                          <Button
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
                    <div className="flex justify-end mt-4 gap-2 relative">
                      <Button color="warning" variant="bordered">
                        Edit
                      </Button>
                      <DeleteButton
                        endpoint={`${item.root}(${obs["@iot.id"]})`}
                        token={token}
                        onDeleted={() =>
                          setObservations(prev => prev.filter(o => o["@iot.id"] !== obs["@iot.id"]))
                        }
                      />
                    </div>
                  </div>
                </div>
              </AccordionItem>
            )),
          ]}
        </Accordion>
      )}
    </div>
  );
}