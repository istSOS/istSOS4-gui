"use client";

import * as React from "react";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
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

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

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

  React.useEffect(() => {
    if (!mapContainerRef.current || typeof window === "undefined") return;

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
        }
        ).setView(center, 4);
        mapInstanceRef.current = leafletMap;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(leafletMap);
      }
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);


      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      filteredLocations.forEach((loc) => {
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
            .bindPopup(`<pre>${JSON.stringify(loc, null, 2)}</pre>`);
          markersRef.current.push(marker);
        }
      });
    });
  }, [filteredLocations]);

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
      <div className="overflow-x-auto mb-6">
        <table className="min-w-max table-auto border border-gray-300 bg-white">
          <thead>
            <tr className="bg-gray-100">
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 border">
                  {col}
                </th>
              ))}
              <th className="px-4 py-2 border">Longitude</th>
              <th className="px-4 py-2 border">Latitude</th>
            </tr>
          </thead>
          <tbody>
            {filteredLocations.map((obs, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 border">
                    {typeof obs[col] === "object"
                      ? JSON.stringify(obs[col])
                      : obs[col]?.toString() ?? "-"}
                  </td>
                ))}
                <td className="px-4 py-2 border">
                  {obs.location?.coordinates?.[0] ?? "-"}
                </td>
                <td className="px-4 py-2 border">
                  {obs.location?.coordinates?.[1] ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      <div
        id="resizable-map-wrapper"
        className="fixed left-0 right-0 z-50"
        style={{
          bottom: 0,
          height: mapHeight,
          minHeight: 100,
          pointerEvents: "none",
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
    </div>
  );
}
