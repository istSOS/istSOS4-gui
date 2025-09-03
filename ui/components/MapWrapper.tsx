/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from "react";
import "leaflet/dist/leaflet.css";
import { Input, Button, Switch } from "@heroui/react";
import { MAP_TILE_LAYER } from "../config/site";
import L from "leaflet";
import { usePolygonCenter } from "./hooks/usePolygonCenter";
import { useTimezone } from "../context/TimezoneContext";
import { formatDateWithTimezone } from "./hooks/formatDateWithTimezone";
import { useTranslation } from "react-i18next";
import { toWGS84ForDisplay, detectCRSName, pointToWGS84 } from "./hooks/reprojection";
import { getColorScale } from "./hooks/useColorScale";

type MapWrapperProps = {
  items: any[];
  getCoordinates: (item: any) => [number, number] | null;
  getId: (item: any) => string;
  getLabel: (item: any) => string;
  getGeoJSON: (item: any) => any | null;
  expandedId?: string | null;
  onMarkerClick?: (id: string) => void;
  showMap: boolean;
  split: number;
  setSplit: (split: number) => void;
  showMarkers?: boolean;
  mapRef?: React.MutableRefObject<any>;
  chipColorStrategy?: (item: any) => string;
  onBBoxChange?: (bbox: string) => void;
  autoFit?: boolean;
};

//Color mapping for different states (success, warning, danger, default)
const colorMap = new Map<string, string>([
  ["success", "#4ade80"],
  ["warning", "#facc15"],
  ["danger", "#ef4444"],
  ["default", "#e5e7eb"]
]);

//Color palette used for generating colors based on IDs
const colorPalette = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

/**
 * Generates a consistent color for a given ID by hashing the ID and selecting a color from the palette.
 * @param {string} id - The ID to generate a color for.
 * @returns {string} A color from the palette.
 */
function getColorFromId(id: string) {
  let hash = 4353;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) + hash) + id.charCodeAt(i);
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

export default function MapWrapper({
  items,
  getCoordinates,
  getId,
  getLabel,
  getGeoJSON,
  expandedId,
  onMarkerClick,
  showMap,
  split,
  setSplit,
  showMarkers,
  mapRef,
  chipColorStrategy,
  onBBoxChange,
  autoFit = true
}: MapWrapperProps) {
  //Refs for managing the map and its elements
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const geoJSONLayersRef = React.useRef<any[]>([]);
  const previousItemsSignatureRef = React.useRef<string>("");

  //State for managing UI and interactions
  const [colorMode, setColorMode] = React.useState<boolean>(false);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [manualMarker, setManualMarker] = React.useState<any>(null);
  const { timezone, timeShiftHours } = useTimezone();
  const { t } = useTranslation();
  const [cursorCoords, setCursorCoords] = React.useState<[number, number] | null>(null);
  const [currentBBox, setCurrentBBox] = React.useState<string>("");
  const [copySuccess, setCopySuccess] = React.useState<boolean>(false);

  //Effect to handle mouse movement over the map and update cursor coordinates
  React.useEffect(() => {
    if (!showMap || typeof window === "undefined" || !mapContainerRef.current) return;
    const mapDiv = mapContainerRef.current;
    function handleMouseMove(e: MouseEvent) {
      if (!mapInstanceRef.current) return;
      const rect = mapDiv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const point = mapInstanceRef.current.containerPointToLatLng([x, y]);
      if (point) setCursorCoords([point.lat, point.lng]);
    }
    mapDiv.addEventListener("mousemove", handleMouseMove);
    return () => mapDiv.removeEventListener("mousemove", handleMouseMove);
  }, [showMap]);

  //Function to handle copying the bounding box coordinates to clipboard
  const handleCopyBBox = () => {
    if (!currentBBox) return;
    navigator.clipboard.writeText(currentBBox).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => console.error("Failed to copy BBox: ", err));
  };

  //Function to perform a search for a location using OpenStreetMap's Nominatim API
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], 12, { animate: true });
          import("leaflet").then((L) => {
            if (!mapInstanceRef.current) return;
            if (manualMarker) mapInstanceRef.current.removeLayer(manualMarker);
            const newMarker = L.marker([parseFloat(lat), parseFloat(lon)], {
              icon: L.divIcon({
                className: "temporary-marker",
                html: `<div style="background:red;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`
              })
            }).addTo(mapInstanceRef.current);
            setManualMarker(newMarker);
            setTimeout(() => {
              if (mapInstanceRef.current && newMarker) {
                mapInstanceRef.current.removeLayer(newMarker);
                setManualMarker(null);
              }
            }, 4500);
          });
        }
      }
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  //Handle form submission for search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  //Effect to handle resizing of the map
  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newSplit = Math.min(Math.max(1 - x / rect.width, 0.15), 0.85);
      setSplit(1 - newSplit);
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
  }, [isSplitting, setSplit]);

  //Function to generate HTML content for a marker popup
  function getPopupContent(item: any) {
    const chipColor = chipColorStrategy ? chipColorStrategy(item) : "default";
    const color = colorMap.get(chipColor) || "#e5e7eb";
    return `
      <div style="min-width:180px">
        <div>
          <strong>${item.name ?? "-"}</strong>
          <span style="
            display:inline-block;
            padding:2px 8px;
            margin-left:6px;
            border-radius:12px;
            background:${color};
            color:#222;
            font-weight:600;
            font-size:12px;
          ">
            ${item.timeAgo ?? "-"}
          </span>
        </div>
        <div>${
          item.lastValue !== undefined
            ? `${t("general.last_value")}: <b>${item.lastValue}${item.unitOfMeasurement?.symbol || ""}</b>`
            : ""
        }</div>
        <div>${
          item.lastMeasurement
            ? `${t("general.date")}: <b>${formatDateWithTimezone(
                item.lastMeasurement,
                timezone,
                timeShiftHours
              )}</b>`
            : ""
        }</div>
      </div>
    `;
  }

  //Function to update center labels on the map, handling overlaps by placing labels in a circular pattern
  function updateCenterLabels(L, mapInstance, items, getGeoJSON) {
    if (mapInstance._centerValueMarkers) {
      mapInstance._centerValueMarkers.forEach(m => mapInstance.removeLayer(m));
    }
    mapInstance._centerValueMarkers = [];
    const placedLabels = [];
    const labelSpacing = 50;
    const circleRadius = 60;
    items.forEach(item => {
      const rawGeo = getGeoJSON(item);
      if (!rawGeo) return;
      const displayGeo = toWGS84ForDisplay(rawGeo);
      const center = usePolygonCenter(displayGeo);
      if (center && typeof mapInstance.getZoom === "function" && mapInstance.getZoom() >= 12) {
        const point = mapInstance.latLngToLayerPoint([center[1], center[0]]);
        const labelText = `${item.lastValue ?? item.name ?? ""} ${item.unitOfMeasurement?.symbol ?? ""}`;
        let overlapDetected = false;
        for (const placedLabel of placedLabels) {
          const distance = Math.sqrt(
            Math.pow(point.x - placedLabel.point.x, 2) +
            Math.pow(point.y - placedLabel.point.y, 2)
          );
          if (distance < labelSpacing) {
            overlapDetected = true;
            break;
          }
        }
        if (overlapDetected) {
          const overlapCount = placedLabels.filter(placedLabel => {
            const distance = Math.sqrt(
              Math.pow(point.x - placedLabel.point.x, 2) +
              Math.pow(point.y - placedLabel.point.y, 2)
            );
            return distance < labelSpacing;
          }).length;
          const angleStep = (2 * Math.PI) / (overlapCount + 1);
          let adjustedPoint;
          for (let i = 0; i <= overlapCount; i++) {
            const angle = i * angleStep;
            adjustedPoint = {
              x: point.x + circleRadius * Math.cos(angle),
              y: point.y + circleRadius * Math.sin(angle)
            };
            let newPositionOverlaps = false;
            for (const placedLabel of placedLabels) {
              const distance = Math.sqrt(
                Math.pow(adjustedPoint.x - placedLabel.point.x, 2) +
                Math.pow(adjustedPoint.y - placedLabel.point.y, 2)
              );
              if (distance < labelSpacing) {
                newPositionOverlaps = true;
                break;
              }
            }
            if (!newPositionOverlaps) {
              break;
            }
          }
          if (adjustedPoint) {
            point.x = adjustedPoint.x;
            point.y = adjustedPoint.y;
          }
        }
        const adjustedLatLng = mapInstance.layerPointToLatLng([point.x, point.y]);
        const valueLabel = L.divIcon({
          className: "datastream-value-label",
          html: `<span style="
              font-weight:600;
              font-size:22px;
              opacity:.5;
              white-space:nowrap;
              position:relative;
              left:-40px;
            ">${labelText}</span>`
        });
        const marker = L.marker([adjustedLatLng.lat, adjustedLatLng.lng], {
          icon: valueLabel,
          interactive: false
        }).addTo(mapInstance);
        placedLabels.push({
          point: point,
          labelText: labelText
        });
        mapInstance._centerValueMarkers.push(marker);
      }
    });
  }

  //Effect to initialize and update the map
  React.useEffect(() => {
    if (!showMap || !mapContainerRef.current || typeof window === "undefined") return;
    import("leaflet").then((L) => {
      if (!mapContainerRef.current) return;
      if (!mapInstanceRef.current) {
        let center: [number, number] = [0, 0];
        const first = items[0] && getCoordinates(items[0]);
        if (first && typeof first[0] === "number" && typeof first[1] === "number") {
          center = [first[1], first[0]];
        }
        const leafletMap = L.map(mapContainerRef.current, {
          worldCopyJump: false,
          maxBounds: [
            [-90, -180],
            [90, 180]
          ],
          maxBoundsViscosity: 1.0
        }).setView(center, 2);
        mapInstanceRef.current = leafletMap;
        if (mapRef) mapRef.current = leafletMap;
        L.tileLayer(MAP_TILE_LAYER.url, {
          attribution: MAP_TILE_LAYER.attribution
        }).addTo(leafletMap);
        function updateBBox() {
          if (!mapInstanceRef.current) return;
          const b = mapInstanceRef.current.getBounds();
          if (!b) return;
          const minLat = b.getSouth();
          const minLon = b.getWest();
          const maxLat = b.getNorth();
          const maxLon = b.getEast();
          const bboxStr = `${minLat.toFixed(6)}, ${minLon.toFixed(6)}, ${maxLat.toFixed(6)}, ${maxLon.toFixed(6)}`;
          setCurrentBBox(bboxStr);
          onBBoxChange && onBBoxChange(bboxStr);
        }
        mapInstanceRef.current.on("moveend", updateBBox);
        updateBBox();
      }
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      geoJSONLayersRef.current.forEach(layer => layer.remove());
      geoJSONLayersRef.current = [];
      items.forEach(item => {
        const id = getId(item);
        const rawGeo = getGeoJSON(item) ? JSON.parse(JSON.stringify(getGeoJSON(item))) : null;
        const originalCRS = rawGeo ? detectCRSName(rawGeo) : "EPSG:4326";
        const displayGeo = rawGeo ? toWGS84ForDisplay(rawGeo) : null;
        let coords = getCoordinates(item);
        if (coords && originalCRS !== "EPSG:4326") {
          coords = pointToWGS84(coords, originalCRS);
        }
        if (!coords && displayGeo && displayGeo.type === "Point") {
          coords = displayGeo.coordinates;
        }
        if (showMarkers !== false && Array.isArray(coords)) {
          const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 6,
            fillColor: "red",
            color: "red",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          })
            .addTo(mapInstanceRef.current)
            .on("click", () => onMarkerClick && onMarkerClick(id))
            .on("mouseover", function () {
              marker.bindPopup(getPopupContent(item)).openPopup();
            })
            .on("mouseout", function () {
              marker.closePopup();
            });
          markersRef.current.push(marker);
        }
        if (displayGeo) {
          const geoLayer = L.geoJSON(displayGeo, {
            style: () => {
              const color = colorMode
                ? colorMap.get(chipColorStrategy ? chipColorStrategy(item) : "default") || "#e5e7eb"
                : getColorFromId(id);
              return {
                color,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.4,
                fillColor: color
              };
            },
            pointToLayer: (_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 8,
                fillColor: "#007bff",
                color: "#0056b3",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
              }),
            onEachFeature: (_f, layer) => {
              layer.on({
                click: () => onMarkerClick && onMarkerClick(id),
                mouseover: function () {
                  layer.bindPopup(getPopupContent(item)).openPopup();
                },
                mouseout: function () {
                  layer.closePopup();
                }
              });
            }
          }).addTo(mapInstanceRef.current);
          geoJSONLayersRef.current.push(geoLayer);
        }
      });
      updateCenterLabels(L, mapInstanceRef.current, items, getGeoJSON);
      mapInstanceRef.current.on("zoomend", () =>
        updateCenterLabels(L, mapInstanceRef.current, items, getGeoJSON)
      );
      if (autoFit) {
        const signature = items.map(i => getId(i)).sort().join("|");
        if (signature !== previousItemsSignatureRef.current) {
          previousItemsSignatureRef.current = signature;
          const bounds = L.latLngBounds([]);
          markersRef.current.forEach(m => m.getLatLng && bounds.extend(m.getLatLng()));
          geoJSONLayersRef.current.forEach(layer => {
            if (layer.getBounds) {
              const b = layer.getBounds();
              if (b.isValid()) bounds.extend(b);
            }
          });
          if (bounds.isValid()) {
            const single = bounds.getNorthEast().equals(bounds.getSouthWest());
            if (single) {
              mapInstanceRef.current.setView(bounds.getCenter(), 13, { animate: true });
            } else {
              mapInstanceRef.current.fitBounds(bounds, {
                padding: [30, 30],
                maxZoom: 15,
                animate: true
              });
            }
          }
        }
      }
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 180);
    });
  }, [
    items,
    showMap,
    getCoordinates,
    getId,
    getLabel,
    getGeoJSON,
    onMarkerClick,
    colorMode,
    chipColorStrategy,
    autoFit
  ]);

  //Effect to clean up the map when it is hidden
  React.useEffect(() => {
    if (!showMap && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
      geoJSONLayersRef.current = [];
    }
  }, [showMap]);

  //Effect to focus on an expanded item
  React.useEffect(() => {
    if (!showMap || !expandedId || typeof window === "undefined") return;
    import("leaflet").then(() => {
      const item = items.find(i => getId(i) === expandedId);
      const coords = item && getCoordinates(item);
      if (
        mapInstanceRef.current &&
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === "number" &&
        typeof coords[1] === "number" &&
        !isNaN(coords[0]) &&
        !isNaN(coords[1])
      ) {
        mapInstanceRef.current.setView([coords[1], coords[0]], 12, { animate: true });
      }
    });
  }, [expandedId, showMap, items, getCoordinates, getId]);

  //Render nothing if the map is not shown
  if (!showMap) return null;

  return (
    //Main container for the map
    <div
      id="resizable-map-wrapper"
      className="relative"
      style={{
        flexBasis: `${(1 - split) * 100}%`,
        minWidth: 150,
        height: "calc(100vh - 300px)",
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        position: "relative"
      }}
    >
      {/*Controls and search bar*/}
      <div
        style={{
          padding: "4px",
          zIndex: 100,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Color mode</span>
          <Switch
            checked={colorMode}
            onChange={() => setColorMode(v => !v)}
            size="sm"
          />
        </div>
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Input
            type="text"
            radius="sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t("general.search_location")}
            style={{ width: 200 }}
          />
          <Button
            radius="sm"
            type="submit"
            style={{ backgroundColor: "#007BFF", color: "#fff" }}
            disabled={isSearching}
          >
            {isSearching ? t("general.searching") : t("general.search")}
          </Button>
        </form>
      </div>

      {/*Map container*/}
      <div
        ref={mapContainerRef}
        className="w-full border border-gray-300 shadow bg-white"
        style={{
          minHeight: 0,
          borderRadius: 8,
          overflow: "hidden",
          position: "absolute",
          inset: 0,
          zIndex: 5
        }}
      />

      {/*Coordinates and bounding box info*/}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          background: "rgba(255,255,255,0.95)",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 13,
          color: "#222",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          zIndex: 200,
          minWidth: 240,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <div style={{ lineHeight: 1.3 }}>
          <span style={{ fontWeight: 500 }}>{t("general.cursor_coordinates")}:</span>
          <br />
          {cursorCoords
            ? `Lat: ${cursorCoords[0].toFixed(5)}, Lon: ${cursorCoords[1].toFixed(5)}`
            : "-"}
          <br />
          <span style={{ fontWeight: 500 }}>BBox:</span><br />
          <span style={{ fontSize: 11 }}>{currentBBox || "-"}</span>
        </div>
        <Button
          radius="sm"
          size="sm"
          variant="flat"
          style={{ minWidth: 60, padding: "0 8px" }}
          onPress={handleCopyBBox}
        >
          Copy BBox
        </Button>
        {copySuccess && (
          <span style={{ color: "green", fontSize: 11 }}>Copied!</span>
        )}
      </div>
    </div>
  );
}
