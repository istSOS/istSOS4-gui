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
import deleteData from "../../server/deleteData";
import { unitOfMeasurementOptions, observationTypeURIs } from "./utils";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";
import EntityAccordion from "../../components/EntityAccordion";

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
      required: false,
      type: "select",
      options: thingOptions
    },
    {
      name: "sensorId",
      label: "Sensor",
      required: false,
      type: "select",
      options: sensorOptions
    },
    {
      name: "observedPropertyId",
      label: "ObservedProperty",
      required: false,
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
  const splitRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);

  React.useEffect(() => {
    setDatastreams(entities.datastreams || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  const filtered = datastreams.filter(ds =>
    JSON.stringify(ds).toLowerCase().includes(search.toLowerCase())
  );

  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditDatastream(null);

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
        phenomenonTime?: any;
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

      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);

      // Auto-expand the newly created datastream
      if (data?.value && data.value.length > 0) {
        setExpanded(String(data.value[data.value.length - 1]["@iot.id"]));
      }
    } catch (err) {
      setCreateError(err.message || "Error creating datastream");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = (entity) => {
    setEditDatastream(entity);
  };

  const handleSaveEdit = async (updatedDatastream, originalDatastream) => {
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

      await updateData(`${item.root}(${originalDatastream["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);
      setExpanded(String(originalDatastream["@iot.id"]));
      setEditDatastream(null);
    } catch (err) {
      setEditError(err.message || "Error updating datastream");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);
    } catch (err) {
      console.error("Error deleting datastream:", err);
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
            setExpanded("new-entity");
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
            <EntityAccordion
              items={filtered}
              fields={datastreamFields}
              expandedId={expanded}
              onItemSelect={setExpanded}
              entityType="datastreams"
              onEdit={handleEdit}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDelete}
              onCreate={handleCreate}
              handleCancelCreate={handleCancelCreate}
              handleCancelEdit={handleCancelEdit}
              showCreateForm={showCreate}
              isCreating={createLoading}
              createError={createError}
              editEntity={editDatastream}
              isEditing={editLoading}
              editError={editError}
              token={token}
            />
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
