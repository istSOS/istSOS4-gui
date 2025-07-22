"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { unitOfMeasurementOptions, observationTypeURIs } from "./utils";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "next/navigation";

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
const item = siteConfig.items.find(i => i.label === "Datastreams");

// Main component
export default function Datastreams() {
  // Hooks
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expandedFromQuery = searchParams.get("expanded");

  // State management
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState({});
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

  const defaultValues = {
    name: "New Datastream",
    description: "Datastream Description",

  }

  // Fetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  // Set expanded state from query param
  React.useEffect(() => {
    if (expandedFromQuery) setExpanded(expandedFromQuery);
  }, [expandedFromQuery]);

  // Set datastreams and loading/error states
  React.useEffect(() => {
    setDatastreams(entities.datastreams || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);



  //FILTERS
  const [filters, setFilters] = React.useState({
    sensor: "",
    thing: "",
    observedProperty: ""
  });
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Filter datastreams (maybe overcomplicated?)
  const filtered = datastreams.filter(ds => {
    const id = ds["@iot.id"];
    const nested = nestedEntitiesMap[id] || {};

    //take nested entities or fallback to main datastream properties
    const sensor = nested.Sensor || ds.Sensor;
    const thing = nested.Thing || ds.Thing;
    const observedProperty = nested.ObservedProperty || ds.ObservedProperty;

    const sensorId = sensor && sensor["@iot.id"] ? String(sensor["@iot.id"]) : "";
    const thingId = thing && thing["@iot.id"] ? String(thing["@iot.id"]) : "";
    const observedPropertyId = observedProperty && observedProperty["@iot.id"] ? String(observedProperty["@iot.id"]) : "";

    //textual search
    const matchesSearch = JSON.stringify(ds).toLowerCase().includes(search.toLowerCase());

    //id filter for nested entities
    const matchesSensor = !filters.sensor || sensorId === String(filters.sensor);
    const matchesThing = !filters.thing || thingId === String(filters.thing);
    const matchesObservedProperty = !filters.observedProperty || observedPropertyId === String(filters.observedProperty);

    return matchesSearch && matchesSensor && matchesThing && matchesObservedProperty;
  });



  // Options for dropdowns
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

  // Datastream fields configuration
  const datastreamFields = [
    { name: "name", label: t("datastreams.name"), required: true, defaultValue: defaultValues.name },
    { name: "description", label: t("datastreams.description"), required: false, defaultValue: defaultValues.description },
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

  // Handlers for CRUD operations
  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditDatastream(null);

  const handleCreate = async (newDatastream) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const uom = unitOfMeasurementOptions.find(o => o.value === newDatastream.unitOfMeasurement);
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
        unitOfMeasurement: { name: string; symbol: string; definition: string; };
        observationType: any;
        Thing: { "@iot.id": number; };
        Sensor: { "@iot.id": number; };
        ObservedProperty: { "@iot.id": number; };
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

      await createData(item.root, token, payload);

      
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item.root, token);
      setDatastreams(data?.value || []);

      // Auto-expand the newly created datastream
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchDatastreamWithExpand(newId);
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
      const uom = unitOfMeasurementOptions.find(o => o.value === updatedDatastream.unitOfMeasurement);
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
        //updated relations
        ...(updatedDatastream.thingId && { Thing: { "@iot.id": Number(updatedDatastream.thingId) } }),
        ...(updatedDatastream.sensorId && { Sensor: { "@iot.id": Number(updatedDatastream.sensorId) } }),
        ...(updatedDatastream.observedPropertyId && { ObservedProperty: { "@iot.id": Number(updatedDatastream.observedPropertyId) } }),
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
      await fetchDatastreamWithExpand(originalDatastream["@iot.id"]);
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

  // Fetch datastreams with expanded nested entities
  const fetchDatastreamWithExpand = async (datastreamId) => {
    const nested = siteConfig.items.find(i => i.label === "Datastreams").nested;
    const nestedData = {};

    await Promise.all(
      nested.map(async (nestedKey) => {
        const url = `${item.root}(${datastreamId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) {
          nestedData[nestedKey] = data[nestedKey];
        }
      })
    );

    setNestedEntitiesMap(prev => ({
      ...prev,
      [datastreamId]: nestedData
    }));
  };

  // Example call on mount
  React.useEffect(() => {
    if (datastreams.length > 0) {
      datastreams.forEach(ds => {
        fetchDatastreamWithExpand(ds["@iot.id"]);
      });
    }
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entitiesLoading, entitiesError, token, datastreams]);


  // Render loading and error states
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  // Render components
  const entityListComponent = (
    <EntityList
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
      nestedEntities={nestedEntitiesMap}
    />
  );

  const entityMapComponent = showMap ? (
    <MapWrapper
      items={filtered}
      getCoordinates={ds => ds.observedArea?.coordinates?.[0]?.[0] ? ds.observedArea.coordinates[0][0] : null}
      getId={ds => ds["@iot.id"] ? String(ds["@iot.id"]) : JSON.stringify(ds.observedArea?.coordinates)}
      getLabel={ds => ds.name ?? "-"}
      getGeoJSON={ds => ds.observedArea}
      expandedId={expanded}
      onMarkerClick={id => setExpanded(id)}
      showMap={showMap}
      split={split}
      setSplit={setSplit}
      showMarkers={false}
    />
  ) : null;

  // Main render
  return (
    <div className="min-h-screen p-4">

      <EntityActions
        title="Datastreams"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded("new-entity");
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
        hasMap={true} // Enable map toggle
        filters={{
          thing: { label: "Thing", options: thingOptions, value: filters.thing },
          sensor: { label: "Sensor", options: sensorOptions, value: filters.sensor },
          observedProperty: { label: "Observed Property", options: observedPropertyOptions, value: filters.observedProperty }
        }}
        onFilterChange={handleFilterChange}
      />

      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={entityMapComponent}
        showRightPanel={showMap}
        initialSplit={split}
      />
    </div>
  );
}