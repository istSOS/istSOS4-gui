"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { unitOfMeasurementOptions, observationTypeURIs, buildDatastreamFields, delayThresholdOptions } from "./utils";
import { useTranslation } from "react-i18next";
import { useEnrichedDatastreams } from "../../components/hooks/useEnrichedDatastreams";
import { createLastDelayColorStrategy } from "../../components/hooks/useLastDelayColor";
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import MapWrapper from "../../components/MapWrapper";
import { Button, DatePicker, Input, Select, SelectItem } from "@heroui/react";
import { DateValue, now } from "@internationalized/date";
import { useTimezone } from "../../context/TimezoneContext";
import { DateTime } from "luxon";
import { LoadingScreen } from "../../components/LoadingScreen";
import DatastreamCreator from "./DatastreamCreator";
import { useDatastreamCRUDHandler } from "./DatastreamCRUDHandler";

const item = siteConfig.items.find(i => i.label === "Datastreams");

export default function Datastreams() {
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedNetwork = searchParams.get("network");
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

  // Date range state
  const [customStart, setCustomStart] = React.useState<DateValue | null>(null);
  const [customEnd, setCustomEnd] = React.useState<DateValue | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc");

  // Filters
  const [filters, setFilters] = React.useState({
    sensor: "",
    thing: "",
    observedProperty: ""
  });

  // BBox filter state
  const [bboxInput, setBboxInput] = React.useState("");
  const [bbox, setBbox] = React.useState("");
  const [isBboxValid, setIsBboxValid] = React.useState(true);

  const validateBboxInput = (input: string) => {
    if (input === "") return true;
    const bboxRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    return bboxRegex.test(input);
  };

  const handleBboxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setBboxInput(input);
    setIsBboxValid(validateBboxInput(input));
  };

  const handleSetBbox = () => {
    if (isBboxValid) {
      setBbox(bboxInput);
    }
  };

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Enriched datastreams (last value / last measurement)
  const rawDatastreams = entities?.datastreams || [];
  const datastreams = useEnrichedDatastreams(rawDatastreams, token);

  // Filtering
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

    //USE THIS WHEN NETWORK LOGIC IS IMPLEMENTED IN BACKEND
    /*
    const matchesNetwork = !selectedNetwork || ds.network === selectedNetwork;
    return matchesSearch && matchesSensor && matchesThing && matchesObservedProperty && matchesBbox() && matchesNetwork;
    console.log("NETWORK: " + ds.network); */


    return matchesSearch && matchesSensor && matchesThing && matchesObservedProperty && matchesBbox();
    
  });

  // Date range filtering
  if (customStart && customEnd) {
    const startDate = customStart && "toDate" in customStart ? customStart.toDate("UTC") : new Date(customStart as any);
    const endDate = customEnd && "toDate" in customEnd ? customEnd.toDate("UTC") : new Date(customEnd as any);
    filtered = filtered.filter(ds => {
      const date = ds.lastMeasurement;
      if (!date) return false;
      const d = new Date(date);
      return d >= startDate && d <= endDate;
    });
  }

  // Sort by lastMeasurement
  filtered = [...filtered].sort((a, b) => {
    const dateA = a.lastMeasurement;
    const dateB = b.lastMeasurement;
    if (!dateA || !dateB) return 0;
    return sortOrder === "desc"
      ? new Date(dateB).getTime() - new Date(dateA).getTime()
      : new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  // Delay threshold options for last measurement age color coding
  const [delayThreshold, setDelayThreshold] = React.useState<number>(5);
  const chipColorStrategy = React.useMemo(
    () => createLastDelayColorStrategy(delayThreshold, timezone),
    [delayThreshold, timezone]
  );

  // Count datastream associations per nested entity (used to disable options with zero associations)
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

  // Select options (existing entities)
  const locationOptions = (entities?.locations || []).map((x: any) => ({ label: x.name || `Location ${x["@iot.id"]}`, value: String(x["@iot.id"]) }));
  const observationTypeOptions = observationTypeURIs.map(o => ({ label: o.label, value: o.value }));
  const thingOptions = (entities?.things || []).map(thing => {
    const id = thing["@iot.id"];
    const count = datastreamCounts.thing[id] || 0;
    return {
      label: `${thing.name || `Thing ${id}`}${count ? ` (${count})` : " "}`,
      value: id,
      disabled: count === 0
    };
  });
  const sensorOptions = (entities?.sensors || []).map(sensor => {
    const id = sensor["@iot.id"];
    const count = datastreamCounts.sensor[id] || 0;
    return {
      label: `${sensor.name || `Sensor ${id}`}${count ? ` (${count})` : " "}`,
      value: id,
      disabled: count === 0
    };
  });
  const observedPropertyOptions = (entities?.observedProperties || []).map(op => {
    const id = op["@iot.id"];
    const count = datastreamCounts.observedProperty[id] || 0;
    return {
      label: `${op.name || `Observed Property ${id}`}${count ? ` (${count})` : " "}`,
      value: id,
      disabled: count === 0
    };
  });

  // Field definitions
  const datastreamFields = React.useMemo(
    () => buildDatastreamFields({
      t,
      thingOptions,
      sensorOptions,
      observedPropertyOptions,
      includePhenomenonTime: false
    }),
    [t, thingOptions, sensorOptions, observedPropertyOptions]
  );
  const datastreamDetailFields = React.useMemo(
    () => buildDatastreamFields({
      t,
      thingOptions,
      sensorOptions,
      observedPropertyOptions,
      includePhenomenonTime: true
    }),
    [t, thingOptions, sensorOptions, observedPropertyOptions]
  );

  // Initialize CRUD handlers
  const {
    handleCancelCreate,
    handleCancelEdit,
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete,
    fetchDatastreamWithExpand,
  } = useDatastreamCRUDHandler({
    item,
    token,
    setShowCreate,
    setExpanded,
    setEditDatastream,
    setCreateLoading,
    setCreateError,
    setEditLoading,
    setEditError,
    refetchAll,
    showCreate,
    editDatastream,
    createLoading,
    editLoading,
    nestedEntitiesMap,
    setNestedEntitiesMap,
    expanded,
  });

  // Initial fetch
  React.useEffect(() => {
    refetchAll();
  }, []);

  // Expand from query param
  React.useEffect(() => {
    if (expandedFromQuery) setExpanded(expandedFromQuery);
  }, [expandedFromQuery]);

  // Fetch nested for each datastream
  React.useEffect(() => {
    if (datastreams.length > 0) {
      datastreams.forEach(ds => {
        fetchDatastreamWithExpand(ds["@iot.id"]);
      });
    }
  }, [datastreams, token]);

  const loading = authLoading || entitiesLoading;
  if (loading) return <LoadingScreen />;
  if (entitiesError) return <p>{entitiesError}</p>;

  const entityListComponent = (
    <EntityList
      items={filtered}
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
      showCreateForm={false}
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
      chipColorStrategy={chipColorStrategy}
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
            label="Last Threshold"
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
            size="sm"
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
      {showCreate && (
        <div className="mb-6">
          <DatastreamCreator
            observationTypeOptions={observationTypeOptions}
            unitOfMeasurementOptions={unitOfMeasurementOptions}
            thingOptions={thingOptions}
            sensorOptions={sensorOptions}
            observedPropertyOptions={observedPropertyOptions}
            locationOptions={locationOptions}
            onCreate={handleCreate}
            onCancel={handleCancelCreate}
            isLoading={createLoading}
            error={createError}
          />
        </div>
      )}
      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={entityMapComponent}
        showRightPanel={showMap}
        initialSplit={split}
      />
    </div>
  );
}
