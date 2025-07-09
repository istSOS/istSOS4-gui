"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { Accordion, AccordionItem, Button, Input, Divider } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import EntityCreator from "../../components/EntityCreator";
import updateData from "../../server/updateData";
import fetchData from "../../server/fetchData";
import { unitOfMeasurementOptions, observationTypeURIs } from "./utils";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";

export const mainColor = siteConfig.main_color;
const item = siteConfig.items.find(i => i.label === "Datastreams");

const defaultCoordinates = [
  [1.1, 1.1],
  [2.2, 2.2],
  [3.3, 3.3],
];

function formatGeoJSON(coordinates) {
  return {
    type: "Polygon",
    coordinates: [coordinates]
  };
}

export default function Datastreams() {
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  React.useEffect(() => {
    refetchAll();
  }, []);

  const thingOptions = (entities?.things || []).map(thing => ({
    label: thing.name || `Thing ${thing["@iot.id"]}`,
    value: thing["@iot.id"]
  }));

  const sensorOptions = (entities?.sensors || []).map(sensor => ({
    label: sensor.name || `Sensor ${sensor["@iot.id"]}`,
    value: sensor["@iot.id"]
  }));

  const observedPropertyOptions = (entities?.observedProperties || []).map(op => ({
    label: op.name || `Observed Property ${op["@iot.id"]}`,
    value: op["@iot.id"]
  }));

  const datastreamFields = [
    { name: "name", label: t("datastreams.name"), required: true },
    { name: "description", label: t("datastreams.description"), required: false },
    {
      name: "unitOfMeasurement",
      label: t("datastreams.unit_of_measurement"),
      required: true,
      type: "select",
      options: unitOfMeasurementOptions
    },
    {
      name: "observationType",
      label: t("datastreams.observation_type"),
      required: true,
      type: "select",
      options: observationTypeURIs
    },
    { name: "phenomenonTime", label: t("datastreams.phenomenon_time"), type: "datetime-local", required: false },
    {
      name: "properties",
      label: t("things.properties"),
      type: "properties",
      required: false
    },
    {
      name: "thingId",
      label: "Thing",
      required: true,
      type: "select",
      options: thingOptions
    },
    {
      name: "sensorId",
      label: "Sensor",
      required: true,
      type: "select",
      options: sensorOptions
    },
    {
      name: "observedPropertyId",
      label: "ObservedProperty",
      required: true,
      type: "select",
      options: observedPropertyOptions
    },
  ];

  const getLabel = (key) => {
    const map = {
      name: t("datastreams.name"),
      description: t("datastreams.description"),
      unitOfMeasurement: t("datastreams.unit_of_measurement"),
      observationType: t("datastreams.observation_type"),
      observedArea: t("datastreams.observed_area"),
      phenomenonTime: t("datastreams.phenomenon_time"),
      properties: t("sensors.properties"),
    };
    return map[key] || key;
  };

  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [datastreams, setDatastreams] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);
  const [editDatastream, setEditDatastream] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const splitRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);

  React.useEffect(() => {
    setDatastreams(entities.datastreams);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  const filtered = datastreams.filter(ds =>
    JSON.stringify(ds).toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (newDatastream) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const uom = unitOfMeasurementOptions.find(
        o => o.value === newDatastream.unitOfMeasurement
      );
      if (!uom) {
        setCreateError("Invalid Unit Of Measurement");
        setCreateLoading(false);
        return;
      }

      const obsType = newDatastream.observationType;
      if (!obsType) {
        setCreateError("Invalid Observation Type");
        setCreateLoading(false);
        return;
      }

      if (!newDatastream.thingId || !newDatastream.sensorId || !newDatastream.observedPropertyId) {
        setCreateError("Thing ID, Sensor ID, and Observed Property ID are required");
        setCreateLoading(false);
        return;
      }

      const payload: {
        name: any;
        description: any;
        unitOfMeasurement: { name: string; symbol: string; definition: string };
        observationType: any;
        Thing: { "@iot.id": number };
        Sensor: { "@iot.id": number };
        ObservedProperty: { "@iot.id": number };
        network: string;
        phenomenonTime?: string;
        properties?: Record<string, any>;
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
        network: "acsot",
      };

      if (newDatastream.phenomenonTime) {
        payload.phenomenonTime = newDatastream.phenomenonTime;
      }

      if (Array.isArray(newDatastream.properties) && newDatastream.properties.length > 0) {
        payload.properties = Object.fromEntries(
          newDatastream.properties
            .filter(p => p.key)
            .map(p => [p.key, p.value])
        );
      } else {
        payload.properties = {};
      }

      if (!payload.network) {
        payload.network = "acsot";
      }

      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);

      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);
    } catch (err) {
      setCreateError(err.message || "Error creating datastream");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async (updatedDatastream) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const uom = unitOfMeasurementOptions.find(
        o => o.value === updatedDatastream.unitOfMeasurement
      );
      if (!uom) {
        setEditError("Invalid Unit Of Measurement");
        setEditLoading(false);
        return;
      }

      const obsType = updatedDatastream.observationType;
      if (!obsType) {
        setEditError("Invalid Observation Type");
        setEditLoading(false);
        return;
      }

      const payload = {
        name: updatedDatastream.name,
        description: updatedDatastream.description,
        unitOfMeasurement: {
          name: uom.label,
          symbol: uom.symbol,
          definition: uom.definition,
        },
        observationType: obsType,
        network: "acsot",
        properties: {},
      };

      if (Array.isArray(updatedDatastream.properties) && updatedDatastream.properties.length > 0) {
        const props = Object.fromEntries(
          updatedDatastream.properties
            .filter(p => p.key)
            .map(p => [p.key, p.value])
        );
        if (Object.keys(props).length > 0) {
          payload.properties = props;
        }
      }

      await updateData(`${item.root}(${editDatastream["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);
      setExpanded(String(editDatastream["@iot.id"]));
      setEditDatastream(null);
    } catch (err) {
      setEditError(err.message || "Error updating datastream");
    } finally {
      setEditLoading(false);
    }
  };

  const focusDatastream = (coordinates, id) => {
    setShowMap(true);
    if (typeof id === "string") {
      setExpanded(id);
      setTimeout(() => {
        const el = document.getElementById(`datastream-accordion-item-${id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
    setTimeout(() => {
      if (mapInstanceRef.current && coordinates) {
        mapInstanceRef.current.setView([coordinates[1], coordinates[0]], 6, { animate: true });
      }
    }, 50);
  };

  React.useEffect(() => {
    function onMouseMove(e) {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newSplit = Math.min(Math.max(x / rect.width, 0.15), 0.85);
      setSplit(newSplit);
    }

    function onMouseUp() {
      setIsSplitting(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    if (isSplitting) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isSplitting]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-2">
        <SecNavbar title="Datastreams" />
      </div>
      <Divider style={{ backgroundColor: "white", height: 1, margin: "8px 0" }} />
      <div className="flex mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder={t("general.search")} />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-datastream");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0 }}
          aria-label="Add Datastream"
        >
          +
        </Button>
        <Button
          size="sm"
          variant="flat"
          className="ml-auto"
          onPress={() => setShowMap((prev) => !prev)}
        >
          {showMap ? t("locations.hide_map") : t("locations.show_map")}
        </Button>
      </div>
      <div
        ref={splitRef}
        className="flex flex-row gap-0"
        style={{ height: `calc(100vh - 180px)`, position: "relative", userSelect: isSplitting ? "none" : undefined }}
      >
        <div
          className="h-full overflow-y-auto pr-2"
          style={{
            flexBasis: showMap ? `${split * 100}%` : "100%",
            minWidth: 150,
            maxWidth: "100%",
            transition: isSplitting ? "none" : "flex-basis 0.2s",
          }}
        >
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
                        properties: [],
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
                    {editDatastream && editDatastream["@iot.id"] === ds["@iot.id"] ? (
                      <EntityCreator
                        fields={datastreamFields}
                        onCreate={handleEdit}
                        onCancel={() => setEditDatastream(null)}
                        isLoading={editLoading}
                        error={editError}
                        initialValues={{
                          name: ds.name || "",
                          description: ds.description || "",
                          unitOfMeasurement: unitOfMeasurementOptions.find(
                            o =>
                              o.label === ds.unitOfMeasurement?.name &&
                              o.symbol === ds.unitOfMeasurement?.symbol &&
                              o.definition === ds.unitOfMeasurement?.definition
                          )?.value || "",
                          observationType: observationTypeURIs.find(
                            o => o.value === ds.observationType
                          )?.value || "",
                          coordinates: ds.observedArea?.coordinates?.[0] || defaultCoordinates,
                          phenomenonTime: ds.phenomenonTime || "",
                          thingId: ds.Thing?.["@iot.id"] || "",
                          sensorId: ds.Sensor?.["@iot.id"] || "",
                          observedPropertyId: ds.ObservedProperty?.["@iot.id"] || "",
                          properties: Object.entries(ds.properties || {}).map(([key, value]) => ({ key, value })),
                        }}
                      />
                    ) : (
                      <div className="mt-2 flex flex-row gap-8">
                        <div className="flex-1 flex flex-col gap-2">
                          {Object.entries(ds).map(([key, value]) =>
                            (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[a-z]/.test(key)) ? null : (
                              <div key={key} className="flex items-center gap-2">
                                <label className="w-40 text-sm text-gray-700">
                                  {key.includes("@iot") ? key.split("@")[0] : getLabel(key)}
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
                            <Button color="warning" variant="bordered" onPress={() => setEditDatastream(ds)}>
                              {t("general.edit")}
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
                    )}
                  </AccordionItem>
                )),
              ]}
            </Accordion>
          )}
        </div>
        {showMap && (
          <>
            <div
              style={{
                width: 4,
                cursor: "col-resize",
                background: "#eee",
                zIndex: 20,
                userSelect: "none",
              }}
              onMouseDown={() => setIsSplitting(true)}
            />
            <div style={{ width: 16 }} />
          </>
        )}
        {showMap && (
          <MapWrapper
            items={filtered}
            getCoordinates={ds => ds.observedArea?.coordinates?.[0]?.[0] ? ds.observedArea.coordinates[0][0] : null}
            getId={ds => String(ds["@iot.id"])}
            getLabel={ds => ds.name ?? "-"}
            getGeoJSON={ds => ds.observedArea}
            expandedId={expanded}
            onMarkerClick={id => setExpanded(id)}
            showMap={showMap}
            split={split}
            setSplit={setSplit}
          />
        )}
      </div>
    </div>
  );
}
