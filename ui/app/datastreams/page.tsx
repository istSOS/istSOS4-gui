'use client';
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { Accordion, AccordionItem, Button, Input, Divider, Select, SelectItem, Textarea } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import fetchData from "../../server/fetchData";
import EntityCreator from "../../components/EntityCreator";
import { unitOfMeasurementOptions, observationTypeURIs } from "./utils";

//define color from site condiguration
export const mainColor = siteConfig.main_color;

//retrive specific items from site configuration
const item = siteConfig.items.find(i => i.label === "Datastreams");
const things = siteConfig.items.find(i => i.label === "Things");
const sensors = siteConfig.items.find(i => i.label === "Sensors");
const observedProperties = siteConfig.items.find(i => i.label === "Observed Properties");

//default coordinates for the observed area
const defaultCoordinates = [
  [1.1, 1.1],
  [2.2, 2.2],
  [3.3, 3.3],
];

//define the fields for datastream creation
const datastreamFields = [
  { name: "name", label: "Name", required: true },
  { name: "description", label: "Description", required: false },
  {
    name: "unitOfMeasurement",
    label: "Unit Of Measurement",
    required: true,
    type: "select",
    options: unitOfMeasurementOptions
  },
  {
    name: "observationType",
    label: "Observation Type",
    required: true,
    type: "select",
    options: observationTypeURIs
  },
  {
    name: "coordinates",
    label: "Observed Area (Polygon)",
    type: "coordinates",
    required: false
  },
  { name: "phenomenonTime", label: "Phenomenon Time", type: "datetime-local", required: false },
  { name: "thingId", label: "Thing ID", required: true, type: "number" },
  { name: "sensorId", label: "Sensor ID", required: true, type: "number" },
  { name: "observedPropertyId", label: "Observed Property ID", required: true, type: "number" },
];

//function to format coordinates into GeoJSON format
function formatGeoJSON(coordinates) {
  return {
    type: "Polygon",
    coordinates: [coordinates]
  };
}

//main component for Datastreams
export default function Datastreams() {
  //retrive token and loading state from authentication context
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  //state management for datastreams, laoding, error, search, and UI states
  const [datastreams, setDatastreams] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);

  //retrive entities from context and refetch on mount
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  React.useEffect(() => {
    refetchAll();
  }, []);

  //update datastreams state when entities are fetched
  React.useEffect(() => {
    setDatastreams(entities.datastreams);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  //filter datastreams based on search input
  const filtered = datastreams.filter(ds =>
    JSON.stringify(ds).toLowerCase().includes(search.toLowerCase())
  );

  // --- CREATION ---
  const handleCreate = async (newDatastream) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      //find unit of measurement from options
      const uom = unitOfMeasurementOptions.find(
        o => o.value === newDatastream.unitOfMeasurement
      );
      if (!uom) {
        setCreateError("Invalid Unit Of Measurement");
        setCreateLoading(false);
        return;
      }

      //validate observation type
      const obsType = newDatastream.observationType;
      if (!obsType) {
        setCreateError("Invalid Observation Type");
        setCreateLoading(false);
        return;
      }

      //validate required fields
      if (!newDatastream.thingId || !newDatastream.sensorId || !newDatastream.observedPropertyId) {
        setCreateError("Thing ID, Sensor ID, and Observed Property ID are required");
        setCreateLoading(false);
        return;
      }

      //prepare payload for creation
      const payload: {
        network: "acsot" | "defmin" | "psos" | "default" | undefined;
        name: string;
        description: string;
        unitOfMeasurement: {
          name: string;
          symbol: string;
          definition: string;
        };
        observationType: string;
        Thing: { "@iot.id": number };
        Sensor: { "@iot.id": number };
        ObservedProperty: { "@iot.id": number };
        observedArea?: any;
        phenomenonTime?: string;
      } = {
        name: newDatastream.name,
        description: newDatastream.description,
        unitOfMeasurement: {
          name: uom.label,
          symbol: uom.symbol,
          definition: uom.definition,
        },
        observationType: obsType,
        Thing: { "@iot.id": Number(newDatastream.thingId) },
        Sensor: { "@iot.id": Number(newDatastream.sensorId) },
        ObservedProperty: { "@iot.id": Number(newDatastream.observedPropertyId) },
        network: "acsot", //default network, can be changed later
      };

      //handle coordinates and phenomenon time
      if (Array.isArray(newDatastream.coordinates) && newDatastream.coordinates.length > 2) {
        payload.observedArea = formatGeoJSON(
          newDatastream.coordinates.map(coord => [parseFloat(coord[0]), parseFloat(coord[1])])
        );
      }
      if (newDatastream.phenomenonTime) {
        payload.phenomenonTime = newDatastream.phenomenonTime;
      }

      //set default network if not provided
      if (!payload.network) {
        payload.network = "acsot";
      }

      //create the datastream using the server function
      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      
      //refetch datastreams after creation
      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);
    } catch (err) {
      setCreateError(err.message || "Error creating datastream");
    } finally {
      setCreateLoading(false);
    }
  };

  // --- RENDER ---
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar title="Datastreams" />
      <Divider style={{ backgroundColor: "white", height: 1, margin: "8px 0" }} />
      <div className="flex mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search datastreams..." />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-datastream");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0, marginLeft: 8 }}
          aria-label="Add Datastream"
        >
          +
        </Button>
      </div>
      {filtered.length === 0 && !showCreate ? (
        <p>No available datastreams.</p>
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
                key="new-datastream"
                id="datastream-accordion-item-new-datastream"
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">New Datastream</span>
                  </div>
                }
                value="new-datastream"
              >
                <EntityCreator
                  fields={datastreamFields}
                  onCreate={handleCreate}
                  onCancel={() => setShowCreate(false)}
                  isLoading={createLoading}
                  error={createError}
                  initialValues={{
                    name: "New Datastream",
                    description: "Datastream Description",
                    unitOfMeasurement: unitOfMeasurementOptions[0]?.value || "",
                    observationType: observationTypeURIs[0]?.value || "",
                    coordinates: defaultCoordinates,
                    phenomenonTime: new Date().toISOString().slice(0, 16),
                    thingId: entities?.things?.[0]?.["@iot.id"] || "",
                    sensorId: entities?.sensors?.[0]?.["@iot.id"] || "",
                    observedPropertyId: entities?.observedProperties?.[0]?.["@iot.id"] || "",
                  }}
                />
              </AccordionItem>
            ] : []),
            ...filtered.map((ds, idx) => (
              <AccordionItem
                key={ds["@iot.id"] ?? idx}
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">{ds.name ?? "-"}</span>
                    <span className="text-xs text-gray-500">{ds.description ?? "-"}</span>
                  </div>
                }
                value={String(ds["@iot.id"] ?? idx)}
              >
                <div className="mt-2 flex flex-row gap-8">
                  <div className="flex-1 flex flex-col gap-2">
                    {Object.entries(ds).map(([key, value]) =>
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
                    {Object.entries(ds).map(([key, value]) =>
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
                        endpoint={`${item.root}(${ds["@iot.id"]})`}
                        token={token}
                        onDeleted={() =>
                          setDatastreams(prev => prev.filter(o => o["@iot.id"] !== ds["@iot.id"]))
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