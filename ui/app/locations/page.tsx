"use client";
import * as React from "react";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { Accordion, AccordionItem, Button, Input, Divider } from "@heroui/react";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import EntityCreator from "../../components/EntityCreator";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";

// Define main and secondary colors from site config
export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

//retrive specific items from site configuration (this and linked items)
const item = siteConfig.items.find(i => i.label === "Locations");
//linked items
const locationsItem = siteConfig.items.find(i => i.label === "Locations");
const historicalLocations = siteConfig.items.find(i => i.label === "HistoricalLocations");
const datastreams = siteConfig.items.find(i => i.label === "Datastreams");

export default function Locations() {
  const { t } = useTranslation();

  // Define fields for the EntityCreator specific to Locations
  const locationFields = [
    { name: "name", label: t("locations.name"), required: true },
    { name: "description", label: t("locations.description") },
    { name: "latitude", label: t("locations.latitude"), type: "number", required: true },
    { name: "longitude", label: t("locations.longitude"), type: "number", required: true },
    { name: "encodingType", label: t("locations.encoding_type"), required: true, default: "application/vnd.geo+json" },
  ];

  //labels for columns in the datastreams table
  const getLabel = (key: string) => {
    //map keys to translated labels
    const map: Record<string, string> = {
      name: t("datastreams.name"),
      description: t("datastreams.description"),
      unitOfMeasurement: t("datastreams.unit_of_measurement"),
      thingId: t("datastreams.thing_id"),
      sensorId: t("datastreams.sensor_id"),
      observedPropertyId: t("datastreams.observed_property_id"),
      observationType: t("datastreams.observation_type"),
      observedArea: t("datastreams.observed_area"),
      phenomenonTime: t("datastreams.phenomenon_time"),
      coordinates: t("datastreams.coordinates"),
    };
    return map[key] || key;
  };

  // Authentication and entities context
  const { token, loading: authLoading } = useAuth();
  const [locations, setLocations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showMap, setShowMap] = React.useState(true);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [split, setSplit] = React.useState(0.5);
  const [isSplitting, setIsSplitting] = React.useState(false);

  // State for creation form
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Fetch entities from context
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();

  // Update locations when entities change
  React.useEffect(() => {
    setLocations(entities.locations);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  // Refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  // Handle map splitter mouse events
  const splitRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newSplit = Math.min(Math.max(x / rect.width, 0.15), 0.85); // min 15%, max 85%
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

  // Filter locations based on search input
  const filteredLocations = locations.filter((loc) =>
    JSON.stringify(loc).toLowerCase().includes(search.toLowerCase())
  );

  // Handle creation of a new location
  const handleCreate = async (newLocation: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        name: newLocation.name,
        description: newLocation.description,
        location: {
          type: "Point",
          coordinates: [
            parseFloat(newLocation.longitude),
            parseFloat(newLocation.latitude)
          ]
        },
        encodingType: newLocation.encodingType
      };
      const res = await createData(item.root, token, payload);
      if (!res) throw new Error("Creation failed");
      setShowCreate(false);
      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);
    } catch (err: any) {
      setCreateError(err.message || "Error creating location");
    } finally {
      setCreateLoading(false);
    }
  };

  // Funzioni per MapWrapper
  const getCoordinates = (loc: any) =>
    Array.isArray(loc.location?.coordinates) ? loc.location.coordinates : null;
  const getId = (loc: any) => String(loc["@iot.id"]);
  const getLabelMap = (loc: any) => loc.name ?? "-";

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-2">
        <SecNavbar title="Locations" />
      </div>
      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0" }}
      />
      <div className="flex mb-4">
        {/* Search filter input */}
        <Input
          size="sm"
          placeholder={t("general.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-location");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0 }}
          aria-label="Add Location"
        >
          +
        </Button>
        {/* Button to toggle map visibility */}
        <Button
          size="sm"
          variant="flat"
          className="ml-auto"
          onPress={() => setShowMap((prev) => !prev)}
          style={{ backgroundColor: secondaryColor, color: "white" }}
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
                    key="new-location"
                    id="location-accordion-item-new-location"
                    title={
                      <div className="flex items-baseline gap-3">
                        <span className="font-bold text-lg text-gray-800">New Location</span>
                      </div>
                    }
                    value="new-location"
                  >
                    <EntityCreator
                      fields={locationFields}
                      onCreate={handleCreate}
                      onCancel={() => setShowCreate(false)}
                      isLoading={createLoading}
                      error={createError}
                      initialValues={{
                        name: "",
                        description: "",
                        latitude: "",
                        longitude: "",
                        encodingType: "application/geo+json"
                      }}
                    />
                  </AccordionItem>
                ]
                : []),
              ...(filteredLocations.length === 0 && !showCreate
                ? [
                  <p key="no-locations" style={{ padding: 16 }}>
                    No available locations.
                  </p>
                ]
                : []),
              ...filteredLocations.map((loc) => (
                <AccordionItem
                  key={loc["@iot.id"]}
                  id={`location-accordion-item-${loc["@iot.id"]}`}
                  title={
                    <div className="flex items-baseline gap-3">
                      <span className="font-bold text-lg text-gray-800">{loc.name ?? "-"}</span>
                      <span className="text-xs text-gray-500">{loc.description ?? "-"}</span>
                    </div>
                  }
                  value={String(loc["@iot.id"])}
                >
                  <div className="mt-2 flex flex-row gap-8">
                    {/* LEFT col with self attributes */}
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(loc).map(([key, value]) =>
                        (value == null || key == "@iot.id" || key == "@iot.selfLink" || key === "location" || !/^[a-z]/.test(key)) ? null : (
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
                      {/* Show coordinates in left col */}
                      <div className="flex items-center gap-2">
                        <label className="w-40 text-sm text-gray-700">Latitude</label>
                        <Input
                          size="sm"
                          readOnly
                          value={loc.location?.coordinates?.[1] ?? "-"}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="w-40 text-sm text-gray-700">Longitude</label>
                        <Input
                          size="sm"
                          readOnly
                          value={loc.location?.coordinates?.[0] ?? "-"}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    {/* Vertical divider */}
                    <div className="w-px bg-gray-300 mx-4" />
                    {/* RIGHT col with linked attributes */}
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(loc).map(([key, value]) =>
                        (value == null || key == "@iot.id" || key == "@iot.selfLink" || key === "location" || !/^[A-Z]/.test(key)) ? null : (
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
                      {/* EDIT AND DELETE BUTTONS */}
                      <div className="flex justify-end mt-4 gap-2 relative">
                        <Button color="warning" variant="bordered">
                          {t("general.edit")}
                        </Button>
                        <DeleteButton
                          endpoint={`${item.root}(${loc["@iot.id"]})`}
                          token={token}
                          onDeleted={() =>
                            setLocations(prev => prev.filter(o => o["@iot.id"] !== loc["@iot.id"]))}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionItem>
              )),
            ]}
          </Accordion>
        </div>
        {/* SPLITTER */}
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
        {/* RIGHT: Map */}
        {showMap && (
          <MapWrapper
            items={filteredLocations}
            getCoordinates={getCoordinates}
            getId={getId}
            getLabel={getLabelMap}
            getGeoJSON={loc => null}
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