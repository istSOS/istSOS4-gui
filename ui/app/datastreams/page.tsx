"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { unitOfMeasurementOptions, observationTypeURIs } from "./utils";
import { useTranslation } from "react-i18next";
import { useEnrichedDatastreams } from "../../components/hooks/useEnrichedDatastreams";
import { createLastDelayColorStrategy } from "../../components/hooks/useLastDelayColor";
import { useSearchParams } from "next/navigation";
import createData from "../../server/createData";
import updateData from "../../server/updateData";
import fetchData from "../../server/fetchData";
import deleteData from "../../server/deleteData";
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import MapWrapper from "../../components/MapWrapper";
import { Button, DateInput, DatePicker, Input, Select, SelectItem, Spinner } from "@heroui/react";
import { DateValue, now } from "@internationalized/date";
import { useTimezone } from "../../context/TimezoneContext";
import { parseDateTime } from "@internationalized/date";
import { DateTime } from "luxon";
import { LoadingScreen } from "../../components/LoadingScreen";
const item = siteConfig.items.find(i => i.label === "Datastreams");
export default function Datastreams() {
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expandedFromQuery = searchParams.get("expanded");
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState({});
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
  const { timezone } = useTimezone();
  const currentTime = DateTime.now().setZone(timezone);
  // Date range state
  const [customStart, setCustomStart] = React.useState<DateValue | null>(null);
  const [customEnd, setCustomEnd] = React.useState<DateValue | null>(null)
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc");
  // Filters
  const [filters, setFilters] = React.useState({
    sensor: "",
    thing: "",
    observedProperty: ""
  });

  //bbox status
  const [bboxInput, setBboxInput] = React.useState("");
  const [bbox, setBbox] = React.useState("");
  const [isBboxValid, setIsBboxValid] = React.useState(true);

  const validateBboxInput = (input) => {
    if (input === "") {
      return true; //empty input are allowed for reset
    }
    const bboxRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    return bboxRegex.test(input);
  };

  const handleBboxInputChange = (e) => {
    const input = e.target.value;
    setBboxInput(input);
    setIsBboxValid(validateBboxInput(input));
  };

  const handleSetBbox = () => {
    if (isBboxValid) {
      setBbox(bboxInput);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  // Get datastreams enriched with last value, last measurement, timeAgo, etc.
  const rawDatastreams = entities?.datastreams || [];
  const datastreams = useEnrichedDatastreams(rawDatastreams, token);
  // Filter datastreams
  let filtered = datastreams.filter(ds => {
    const id = ds["@iot.id"];
    const nested = nestedEntitiesMap[id] || {};
    const sensor = nested.Sensor || ds.Sensor;
    const thing = nested.Thing || ds.Thing;
    const observedProperty = nested.ObservedProperty || ds.ObservedProperty;
    const sensorId = sensor && sensor["@iot.id"] ? String(sensor["@iot.id"]) : "";
    const thingId = thing && thing["@iot.id"] ? String(thing["@iot.id"]) : "";
    const observedPropertyId = observedProperty && observedProperty["@iot.id"] ? String(observedProperty["@iot.id"]) : "";
    const matchesSearch = JSON.stringify(ds).toLowerCase().includes(search.toLowerCase());
    const matchesSensor = !filters.sensor || sensorId === String(filters.sensor);
    const matchesThing = !filters.thing || thingId === String(filters.thing);
    const matchesObservedProperty = !filters.observedProperty || observedPropertyId === String(filters.observedProperty);


    //bbox filter
    const matchesBbox = () => {
      if (!bbox) return true;
      const [minLat, minLon, maxLat, maxLon] = bbox.split(',').map(Number);
      const area = ds.observedArea;
      if (!area || !area.coordinates) return false;
      if (area.type === "Polygon" && area.coordinates?.[0]?.[0]) {
        const [lon, lat] = area.coordinates[0][0];
        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
      }
      if (area.type === "Point" && Array.isArray(area.coordinates)) {
        const [lon, lat] = area.coordinates;
        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
      }
      return false;
    };
    return matchesSearch && matchesSensor && matchesThing && matchesObservedProperty && matchesBbox();
  });
  // Date range filtering and sorting
  if (customStart && customEnd) {
    // Convert DateValue to JS Date (NOTE: UTC IS A PLACEHOLDER)
    const startDate = customStart && "toDate" in customStart ? customStart.toDate("UTC") : new Date(customStart as any);
    const endDate = customEnd && "toDate" in customEnd ? customEnd.toDate("UTC") : new Date(customEnd as any);
    filtered = filtered.filter(ds => {
      const date = ds.lastMeasurement;
      if (!date) return false;
      const d = new Date(date);
      return d >= startDate && d <= endDate;
    });
  }
  // Always sort by date (descending or ascending)
  filtered = [...filtered].sort((a, b) => {
    const dateA = a.lastMeasurement;
    const dateB = b.lastMeasurement;
    if (!dateA || !dateB) return 0;
    return sortOrder === "desc"
      ? new Date(dateB).getTime() - new Date(dateA).getTime()
      : new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const delayThresholdOptions = [
    { label: "any", value: null },
    { label: "5 min", value: 5 },
    { label: "10 min", value: 10 },
    { label: "20 min", value: 20 },
    { label: "30 min", value: 30 },
    { label: "1 h", value: 60 },
    { label: "2 h", value: 120 },
    { label: "6 h", value: 360 },
    { label: "12 h", value: 720 },
    { label: "1 day", value: 1440 },
    { label: "2 days", value: 2880 },
    { label: "1 week", value: 10080 },
    { label: "2 weeks", value: 20160 },
    { label: "1 month", value: 43200 },
    { label: "3 months", value: 129600 },
    { label: "6 months", value: 259200 },
    { label: "1 year", value: 525600 }
  ];
  const [delayThreshold, setDelayThreshold] = React.useState<number>(5);

  const chipColorStrategy = React.useMemo(
    () => createLastDelayColorStrategy(delayThreshold, timezone),
    [delayThreshold, timezone]
  );

  //counting datastreams per nested entity
  const datastreamCounts = React.useMemo(() => {
    const counts = {
      thing: {} as Record<string, number>,
      sensor: {} as Record<string, number>,
      observedProperty: {} as Record<string, number>,
    };
    filtered.forEach(ds => {
      const id = ds["@iot.id"];
      const nested = nestedEntitiesMap[id] || {};
      const thing = nested.Thing || ds.Thing;
      const sensor = nested.Sensor || ds.Sensor;
      const observedProperty = nested.ObservedProperty || ds.ObservedProperty;
      const thingId = thing?.["@iot.id"];
      const sensorId = sensor?.["@iot.id"];
      const observedPropertyId = observedProperty?.["@iot.id"];
      if (thingId) counts.thing[thingId] = (counts.thing[thingId] || 0) + 1;
      if (sensorId) counts.sensor[sensorId] = (counts.sensor[sensorId] || 0) + 1;
      if (observedPropertyId) counts.observedProperty[observedPropertyId] = (counts.observedProperty[observedPropertyId] || 0) + 1;
    });
    return counts;
  }, [filtered, nestedEntitiesMap]);

  // Options for dropdowns, name + count. If no datastreams associated, the option is disabled
  const thingOptions = (entities?.things || []).map(thing => {
    const id = thing["@iot.id"];
    const count = datastreamCounts.thing[id] || 0;
    return {
      label: `${thing.name || `Thing ${id}`}${count ? ` (${count})` : " (0)"}`,
      value: id,
      disabled: count === 0
    };
  });
  const sensorOptions = (entities?.sensors || []).map(sensor => {
    const id = sensor["@iot.id"];
    const count = datastreamCounts.sensor[id] || 0;
    return {
      label: `${sensor.name || `Sensor ${id}`}${count ? ` (${count})` : " (0)"}`,
      value: id,
      disabled: count === 0
    };
  });
  const observedPropertyOptions = (entities?.observedProperties || []).map(op => {
    const id = op["@iot.id"];
    const count = datastreamCounts.observedProperty[id] || 0;
    return {
      label: `${op.name || `Observed Property ${id}`}${count ? ` (${count})` : " (0)"}`,
      value: id,
      disabled: count === 0
    };
  });




  // Datastream fields configuration
  const defaultValues = {
    name: "New Datastream",
    description: "Datastream Description",
  };
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
  const datastreamDetailFields = [
    ...datastreamFields,
    { name: "phenomenonTime", label: t("datastreams.phenomenon_time"), type: "datetime-local", required: false },
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
      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      await refetchAll();
      const data = await fetchData(item.root, token);
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
      await refetchAll();
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
      await refetchAll();
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
  React.useEffect(() => {
    refetchAll();
  }, []);
  React.useEffect(() => {
    if (expandedFromQuery) setExpanded(expandedFromQuery);
  }, [expandedFromQuery]);
  React.useEffect(() => {
    if (datastreams.length > 0) {
      datastreams.forEach(ds => {
        fetchDatastreamWithExpand(ds["@iot.id"]);
      });
    }
  }, [datastreams, token]);
  const loading = authLoading || entitiesLoading;
  //if (loading) return <p style={{ color: "#fff" }}>Loading...</p>;
  if (loading) return <LoadingScreen />;
    
  if (entitiesError) return <p>{entitiesError}</p>;
  const entityListComponent = (
    <EntityList
      items={filtered}
      //during creation and editing, it shows the fields for creating a new datastream without phenomenonTime
      //when viewing details, it shows the fields with phenomenonTime
      fields={showCreate || editDatastream ? datastreamFields : datastreamDetailFields}
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
      sortOrder={sortOrder}
      setSortOrder={order => setSortOrder(order === "asc" ? "asc" : "desc")}
      chipColorStrategy={chipColorStrategy}
    />
  );
  const entityMapComponent = showMap ? (
    <MapWrapper
      items={filtered}
      getCoordinates={ds => {
        const area = ds.observedArea;
        if (!area) return null;
        if (area.type === "Polygon" && area.coordinates?.[0]?.[0]) {
          return area.coordinates[0][0];
        }
        if (area.type === "Point" && Array.isArray(area.coordinates)) {
          return area.coordinates;
        }
        return null;
      }}
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
        hasMap={true}
        filters={{
          thing: { label: "Thing", options: thingOptions, value: filters.thing },
          sensor: { label: "Sensor", options: sensorOptions, value: filters.sensor },
          observedProperty: { label: "Observed Property", options: observedPropertyOptions, value: filters.observedProperty }
        }}
        onFilterChange={handleFilterChange}
      />
      <div className="flex flex-row items-end gap-2 mb-2">


        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Select
            size="sm"
            radius="sm"
            label="Last Threashold"
            selectedKeys={[String(delayThreshold)]}
            onChange={e => setDelayThreshold(Number(e.target.value))}
            className="min-w-[140px]"
          >
            {delayThresholdOptions.map(o => (
              <SelectItem key={o.value}>{o.label}</SelectItem>
            ))}
          </Select>
        </div>


        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DatePicker
            granularity="minute"
            hourCycle={24}
            size="sm"
            value={customStart}
            onChange={setCustomStart}
            label={t("general.start_date")}
            className="w-50"
            placeholderValue={now(timezone)}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DatePicker
            granularity="minute"
            hourCycle={24}
            size="sm"
            value={customEnd}
            onChange={setCustomEnd}
            label={t("general.end_date")}
            className="w-50"
            placeholderValue={now(timezone)}
          />
        </div>


        {/* Bounding box */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Input
            radius="sm"
            size="sm"
            label="Bounding Box"
            placeholder="minLat, minLon, maxLat, maxLon"
            value={bboxInput}
            onChange={handleBboxInputChange}
            color={isBboxValid ? "default" : "danger"}
          />
          <Button
            radius="sm"
            variant="flat"

            onPress={handleSetBbox}
            disabled={!isBboxValid}
          >
            Set BBox
          </Button>
        </div>




        <div className="flex items-center ml-auto">
          <Button
            radius="sm"
            size="sm"
            variant="flat"
            onPress={() => setShowMap(prev => !prev)}
            className="ml-2"
          >
            {showMap ? t("locations.hide_map") : t("locations.show_map")}
          </Button>
        </div>
      </div>
      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={entityMapComponent}
        showRightPanel={showMap}
        initialSplit={split}
      />
    </div>
  );
}
