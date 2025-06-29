"use client";

import * as React from "react";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Input } from "@heroui/react";
import "leaflet/dist/leaflet.css";

export const mainColor = siteConfig.main_color;

export default function Locations() {
  const { token, loading: authLoading } = useAuth();
  const [locations, setLocations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [mapHeight, setMapHeight] = React.useState(300);
  const [isResizing, setIsResizing] = React.useState(false);
  const [showMap, setShowMap] = React.useState(true);
  const [expanded, setExpanded] = React.useState<number | null>(null);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

  // Used to focus a marker on the map
  const focusLocation = (coordinates: [number, number], idx?: number) => {
    setShowMap(true);
    if (typeof idx === "number") {
      setExpanded(idx);
      setTimeout(() => {
        const el = document.getElementById(`location-accordion-item-${idx}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
    setTimeout(() => {
      if (mapInstanceRef.current && coordinates) {
        mapInstanceRef.current.setView([coordinates[1], coordinates[0]], 14, { animate: true });
      }
    }, 200);
  };

  React.useEffect(() => {
    if (!token || authLoading) return;
    async function getData() {
      try {
        const locationData = await fetchData(
          "http://api:5000/istsos4/v1.1/Locations",
          token
        );
        setLocations(locationData?.value || []);
      } catch (err) {
        console.error(err);
        setError("Error during data loading.");
      } finally {
        setLoading(false);
      }
    }
    getData();
  }, [token, authLoading]);

  // Table columns (not used, kept for compatibility with comments)
  const columns = React.useMemo(
    () =>
      locations.length > 0
        ? Object.keys(locations[0]).filter((col) => col !== "location")
        : [],
    [locations]
  );

  const filteredLocations = locations.filter((loc) =>
    JSON.stringify(loc).toLowerCase().includes(search.toLowerCase())
  );

  // Create and update map and markers
  React.useEffect(() => {
    if (!showMap || !mapContainerRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      if (!mapInstanceRef.current) {
        const first = filteredLocations[0]?.location?.coordinates;
        const center = first ? [first[1], first[0]] : [45, 10];

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

      // Update markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      filteredLocations.forEach((loc, idx) => {
        const coords = loc.location?.coordinates;
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
            .on("click", () => {
              setExpanded(idx);
              setTimeout(() => {
                const el = document.getElementById(`location-accordion-item-${idx}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
            });
          markersRef.current.push(marker);
        }
      });

      // Force map redraw
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


  // Handle map resize
  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const containerTop = document
        .getElementById("resizable-map-wrapper")
        ?.getBoundingClientRect().top;
      if (containerTop !== undefined) {
        const newHeight = Math.max(100, window.innerHeight - e.clientY);
        setMapHeight(newHeight);
      }
    }
    function onMouseUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    if (isResizing) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4 min-h-[600px] relative" style={{ overflow: "hidden" }}>
      <SecNavbar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search locations..."
      />
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Locations
      </h1>
      <div className="mb-4">
        <Button
          size="sm"
          variant="ghost"
          onPress={() => setShowMap((v) => !v)}
        >
          {showMap ? "Hide map" : "Show map"}
        </Button>
      </div>
      <div className="flex flex-row gap-6" style={{ height: `calc(100vh - 180px)` }}>
        {/* LEFT: Scrollable list */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto pr-2">
          {/* table removed, now Accordion */}
          {filteredLocations.length === 0 ? (
            <p>No available locations.</p>
          ) : (
            <Accordion
              variant="splitted"
              defaultValue={expanded !== null ? [expanded.toString()] : []}
              onChange={(keys) => {
                if (Array.isArray(keys) && keys.length > 0) setExpanded(Number(keys[0]));
                else setExpanded(null);
              }}
            >
              {filteredLocations.map((loc, idx) => (
                <AccordionItem
                  key={loc["@iot.id"] ?? idx}
                  id={`location-accordion-item-${idx}`}
                  title={
                    <div className="flex items-baseline gap-3">
                      <span className="font-bold text-lg text-gray-800">{loc.name ?? "-"}</span>
                      <span className="text-xs text-gray-500">{loc.description ?? "-"}</span>
                    </div>
                  }
                  value={idx}
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
                        <label className="w-40 text-sm text-gray-700">Longitude</label>
                        <Input
                          size="sm"
                          readOnly
                          value={loc.location?.coordinates?.[0] ?? "-"}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="w-40 text-sm text-gray-700">Latitude</label>
                        <Input
                          size="sm"
                          readOnly
                          value={loc.location?.coordinates?.[1] ?? "-"}
                          className="flex-1"
                        />
                      </div>
                      {/* View in map button */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => focusLocation(loc.location?.coordinates, idx)}
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
                    </div>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        {/* RIGHT: Map, resizable vertically */}
        {showMap && (
          <div
            id="resizable-map-wrapper"
            className="relative"
            style={{
              width: 500,
              minWidth: 300,
              maxWidth: 700,
              height: mapHeight,
              minHeight: 100,
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              pointerEvents: "auto",
            }}
          >
            <div
              className="w-full h-3 cursor-row-resize bg-gray-300 hover:bg-gray-400 transition"
              style={{
                borderRadius: "8px 8px 0 0",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                pointerEvents: "auto",
              }}
              onMouseDown={() => setIsResizing(true)}
              title="Drag to resize map"
            />
            <div
              ref={mapContainerRef}
              className="w-full border border-gray-300 shadow bg-white"
              style={{
                minHeight: 0,
                borderRadius: "0 0 8px 8px",
                overflow: "hidden",
                position: "absolute",
                top: 3,
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