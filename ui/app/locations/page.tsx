"use client";

const item = siteConfig.items.find(i => i.label === "Locations");

import * as React from "react";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { Accordion, AccordionItem, Button, Input, Divider } from "@heroui/react";
import "leaflet/dist/leaflet.css";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import EntityCreationAccordion from "../../components/EntityCreationAccordion";

export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;


export default function Locations() {

  const { token, loading: authLoading } = useAuth();

  const [locations, setLocations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showMap, setShowMap] = React.useState(true);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const [split, setSplit] = React.useState(0.5);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const splitRef = React.useRef<HTMLDivElement>(null);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

  // Creation Accordion logic (generic)
  const [creating, setCreating] = React.useState(false);
  const [creationValues, setCreationValues] = React.useState({
    name: "",
    description: "",
    latitude: "",
    longitude: "",
    encodingType: "application/vnd.geo+json"
  });
  const [creationError, setCreationError] = React.useState<string | null>(null);
  const [createLoading, setCreateLoading] = React.useState(false);

  // Define fields for the entity creation (generic)
  const creationFields = [
    { name: "name", label: "Name", required: true },
    { name: "description", label: "Description" },
    { name: "latitude", label: "Latitude", type: "number", required: true },
    { name: "longitude", label: "Longitude", type: "number", required: true },
    { name: "encodingType", label: "Encoding Type", required: true, placeholder: "application/vnd.geo+json" },
  ];

  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();

  //fetch locations from entities context
  React.useEffect(() => {
    setLocations(entities.locations);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  //refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  //focus a marker on the map
  const focusLocation = (coordinates: [number, number], id?: string) => {
    setShowMap(true);
    if (typeof id === "string") {
      setExpanded(id);
      setTimeout(() => {
        const el = document.getElementById(`location-accordion-item-${id}`);
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

  //filter locations based on search input
  const filteredLocations = locations.filter((loc) =>
    JSON.stringify(loc).toLowerCase().includes(search.toLowerCase())
  );

  //create and update map and markers
  React.useEffect(() => {
    if (!showMap || !mapContainerRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {

      //if the map container is not available, do nothing
      if (!mapContainerRef.current) {
        return;
      }

      if (!mapInstanceRef.current) {

        const first = filteredLocations[0]?.location?.coordinates;
        const center = [45, 10];

        const leafletMap = L.map(mapContainerRef.current, {
          worldCopyJump: false,
          maxBounds: [
            [-90, -180],
            [90, 180]
          ],
          maxBoundsViscosity: 1.0,
        }).setView(center, 4);
        mapInstanceRef.current = leafletMap;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(leafletMap);
      }

      //update markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      filteredLocations.forEach((loc) => {
        const coords = loc.location?.coordinates;
        const id = String(loc["@iot.id"]);
        if (Array.isArray(coords)) {
          const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 6,
            fillColor: "red",
            color: "red",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          })
            .addTo(mapInstanceRef.current)
            //when a point is clicked, its details are expanded in the list
            .on("click", () => {
              setExpanded(id);
              setTimeout(() => {
                const el = document.getElementById(`location-accordion-item-${id}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
            })
            .on("mouseover", function () {
              marker.bindPopup(loc.name ?? "-").openPopup();
            })
            .on("mouseout", function () {
              marker.closePopup();
            });
          markersRef.current.push(marker);
        }
      });

      //forced map redraw
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
    });
  }, [filteredLocations, showMap]);

  React.useEffect(() => {
    if (!showMap && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
    }
  }, [showMap]);

  // Generic handleCreate for locations
  const handleCreate = async () => {
    setCreateLoading(true);
    setCreationError(null);
    try {
      const payload = {
        name: creationValues.name,
        description: creationValues.description,
        location: {
          type: "Point",
          coordinates: [
            parseFloat(creationValues.longitude),
            parseFloat(creationValues.latitude)
          ]
        },
        encodingType: creationValues.encodingType
      };
      const res = await createData(item.root, token, payload);
      if (!res) throw new Error("Creation failed");
      setCreating(false);
      setCreationValues({
        name: "",
        description: "",
        latitude: "",
        longitude: "",
        encodingType: "application/vnd.geo+json"
      });
      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);
    } catch (err: any) {
      setCreationError(err.message || "Error creating location");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="min-h-screen p-4">

      <div className="flex items-center justify-between mb-2">
        <SecNavbar
          title="Locations"
        />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setCreating(true);
            setExpanded("new-entity");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0 }}
          aria-label="Add Location"
        >
          +
        </Button>
      </div>

      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0", }}
      ></Divider>

      <div className="flex mb-4">

        {/* search filter input */}
        <Input
          size="sm"
          placeholder="Search locations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />

        {/* button toggle map visibility */}
        <Button
          size="sm"
          variant="flat"
          className="ml-auto"
          onPress={() => setShowMap((prev) => !prev)}
          style={{ backgroundColor: secondaryColor, color: "white" }}
        >
          {showMap ? "Hide Map" : "Show Map"}
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
              ...(creating
                ? [
                  <EntityCreationAccordion
                    key="new-entity"
                    fields={creationFields}
                    values={creationValues}
                    setValues={setCreationValues}
                    error={creationError}
                    loading={createLoading}
                    onCreate={handleCreate}
                    onCancel={() => {
                      setCreating(false);
                      setCreationError(null);
                      setCreationValues({
                        name: "",
                        description: "",
                        latitude: "",
                        longitude: "",
                        encodingType: "application/vnd.geo+json"
                      });
                    }}
                    title="New Location"
                  />
                ]
                : []),
              ...(filteredLocations.length === 0 && !creating
                ? [
                  <p key="no-locations" style={{ padding: 16 }}>
                    No available locations.
                  </p>
                ]
                : filteredLocations.map((loc) => (
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
                        {/* View in map button */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              focusLocation(loc.location?.coordinates, String(loc["@iot.id"]));
                            }}
                            disabled={!loc.location?.coordinates}
                          >
                            View in map
                          </Button>
                        </div>
                      </div>
                      {/* vertical divider */}
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
                            Edit
                          </Button>

                          {/* Refetch not called here because it cause the refresh of
                            the page and makes a bug in the map */}
                          <DeleteButton
                            endpoint={`${item.root}(${loc["@iot.id"]})`}
                            token={token}
                            onDeleted={() =>
                              setLocations(prev => prev.filter(o => o["@iot.id"]
                                !== loc["@iot.id"]))}
                          />
                        </div>

                      </div>
                    </div>
                  </AccordionItem>
                )))
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
          <div
            id="resizable-map-wrapper"
            className="relative"
            style={{
              flexBasis: `${(1 - split) * 100}%`,
              minWidth: 150,
              maxWidth: "85%",
              height: "calc(100vh - 300px)",

              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              pointerEvents: "auto",
              transition: isSplitting ? "none" : "flex-basis 0.2s",
              position: "relative",
            }}
          >
            <div
              ref={mapContainerRef}
              className="w-full border border-gray-300 shadow bg-white"
              style={{
                minHeight: 0,
                borderRadius: "0 0 8px 8px",
                overflow: "hidden",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 5,
                pointerEvents: "auto",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}