"use client";
import * as React from "react";
import "leaflet/dist/leaflet.css";
import { Input, Button, Chip, Switch } from "@heroui/react";
import { MAP_TILE_LAYER } from "../config/site";
import { getColorScale } from "./hooks/useColorScale";
import L from "leaflet";
import { usePolygonCenter } from "./hooks/usePolygonCenter";
import { useTimezone } from "../context/TimezoneContext";
import { DateTime } from "luxon";
import { formatDateWithTimezone } from "./hooks/formatDateWithTimezone";
import { useTranslation } from "react-i18next";
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
};
const colorMap = new Map<string, string>([
    ["success", "#4ade80"],
    ["warning", "#facc15"],
    ["danger", "#ef4444"],
    ["default", "#e5e7eb"]
]);
const colorPalette = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
    "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];
function getColorFromId(id: string) {
    let hash = 4353;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) + hash) + id.charCodeAt(i);
    }
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
}: MapWrapperProps) {
    const mapContainerRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<any>(null);
    const markersRef = React.useRef<any[]>([]);
    const geoJSONLayersRef = React.useRef<any[]>([]);
    const [colorMode, setColorMode] = React.useState<boolean>(false);
    const [isSplitting, setIsSplitting] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isSearching, setIsSearching] = React.useState(false);
    const [manualMarker, setManualMarker] = React.useState<any>(null);
    const { timezone } = useTimezone();
    const { t } = useTranslation();
    // Cursor coordinates state
    const [cursorCoords, setCursorCoords] = React.useState<[number, number] | null>(null);
    // Bounding box state for current map view
    const [currentBBox, setCurrentBBox] = React.useState<string>("");
    // State for copy success message
    const [copySuccess, setCopySuccess] = React.useState<boolean>(false);
    // Update cursor coordinates when mouse moves over the map
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
        return () => {
            mapDiv.removeEventListener("mousemove", handleMouseMove);
        };
    }, [showMap, mapContainerRef]);
    const handleCopyBBox = () => {
        if (currentBBox) {
            navigator.clipboard.writeText(currentBBox).then(() => {
                console.log("BBox copied to clipboard:", currentBBox);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            }).catch(err => {
                console.error("Failed to copy BBox: ", err);
            });
        } else {
            console.log("currentBBox is empty");
        }
    };
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
                    mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], 12, {
                        animate: true,
                    });
                    // Add a temporary marker at the found position
                    import("leaflet").then((L) => {
                        if (!mapInstanceRef.current) return;
                        // Remove any previous temporary markers
                        if (manualMarker) {
                            mapInstanceRef.current.removeLayer(manualMarker);
                        }
                        // Create a new temporary marker
                        const newMarker = L.marker([parseFloat(lat), parseFloat(lon)], {
                            icon: L.divIcon({
                                className: 'temporary-marker',
                                html: `<div style="background-color:red;width:20px;height:20px;border-radius:50%;"></div>`
                            })
                        }).addTo(mapInstanceRef.current);
                        setManualMarker(newMarker);
                        setTimeout(() => {
                            if (mapInstanceRef.current && newMarker) {
                                mapInstanceRef.current.removeLayer(newMarker);
                                setManualMarker(null);
                            }
                        }, 5000);
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching search results:", error);
        } finally {
            setIsSearching(false);
        }
    };
    const handleSearchSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        handleSearch(searchQuery);
    };
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
    function getPopupContent(item: any) {
        const chipColor = chipColorStrategy ? chipColorStrategy(item) : "default";
        let color;
        color = colorMap.get(chipColor) || "#e5e7eb";

        return `
        <div style="min-width:180px">
            <div>
                <strong>${item.name ?? "-"}</strong>
                <span style="
                    display:inline-block;
                    padding:2px 8px;
                    border-radius:12px;
                    background:${color};
                    color:#222;
                    font-weight:600;
                    font-size:13px;
                ">
                    ${item.timeAgo ?? "-"}
                </span>
            </div>
            <div>${item.lastValue !== undefined ? `${t("general.last_value")}: <b>${item.lastValue}${item.unitOfMeasurement.symbol}</b>` : ""}</div>
            <div>${item.lastMeasurement ? `${t("general.date")}: <b>${formatDateWithTimezone(item.lastMeasurement, timezone)}</b>` : ""}</div>
        </div>
    `;
    }
    function updateCenterLabels(L, mapInstance, items, getGeoJSON) {
        if (mapInstance._centerValueMarkers) {
            mapInstance._centerValueMarkers.forEach(m => mapInstance.removeLayer(m));
        }
        mapInstance._centerValueMarkers = [];
        items.forEach(item => {
            const geoJSON = getGeoJSON(item)
                ? JSON.parse(JSON.stringify(getGeoJSON(item)))
                : null;
            if (geoJSON) {
                const center = usePolygonCenter(geoJSON);
                if (
                    center &&
                    typeof mapInstance.getZoom === "function" &&
                    mapInstance.getZoom() >= 12
                ) {
                    const valueLabel = L.divIcon({
                        className: "datastream-value-label",
                        html: `<span style="
                            font-weight: bold;
                            font-size: 25px;
                            opacity: 0.5;
                            white-space: nowrap;
                            padding: 0;
                            margin: 0;
                            text-align: left;
                            position: relative;
                            left: -40px;
                        ">
                            ${item.lastValue ?? item.name ?? ""} ${item.unitOfMeasurement?.symbol ?? ""}
                        </span>`,
                    });
                    const marker = L.marker([center[1], center[0]], { icon: valueLabel, interactive: false }).addTo(mapInstance);
                    mapInstance._centerValueMarkers.push(marker);
                }
            }
        });
    }
    React.useEffect(() => {
        if (!showMap || !mapContainerRef.current || typeof window === "undefined") return;
        import("leaflet").then((L) => {
            if (!mapContainerRef.current) return;
            if (!mapContainerRef.current) {
                try {
                    mapInstanceRef.current?.remove();
                } catch (e) { }
                mapInstanceRef.current = null;
            }
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
                        [90, 180],
                    ],
                    maxBoundsViscosity: 1.0,
                }).setView(center, 2);
                mapInstanceRef.current = leafletMap;
                if (mapRef) {
                    mapRef.current = leafletMap;
                }
                L.tileLayer(MAP_TILE_LAYER.url, {
                    attribution: MAP_TILE_LAYER.attribution,
                }).addTo(leafletMap);


                function updateBBox() {
                    if (!mapInstanceRef.current) return;
                    const bounds = mapInstanceRef.current.getBounds();
                    if (!bounds) return;
                    // Format: minLat, minLon, maxLat, maxLon
                    const minLat = bounds.getSouth();
                    const minLon = bounds.getWest();
                    const maxLat = bounds.getNorth();
                    const maxLon = bounds.getEast();
                    const bboxStr = `${minLat.toFixed(6)}, ${minLon.toFixed(6)}, ${maxLat.toFixed(6)}, ${maxLon.toFixed(6)}`;
                    setCurrentBBox(bboxStr);
                    console.log("Updated BBox:", bboxStr);
                }

                mapInstanceRef.current.on("moveend", updateBBox);
                updateBBox();
            }
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
            geoJSONLayersRef.current.forEach((layer) => layer.remove());
            geoJSONLayersRef.current = [];
            items.forEach((item) => {
                const coords = getCoordinates(item);
                const id = getId(item);
                const geoJSON = getGeoJSON(item)
                    ? JSON.parse(JSON.stringify(getGeoJSON(item)))
                    : null;
                if (showMarkers !== false && Array.isArray(coords)) {
                    const marker = L.circleMarker([coords[1], coords[0]], {
                        radius: 6,
                        fillColor: "red",
                        color: "red",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8,
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
                if (geoJSON) {
                    const geoJSONLayer = L.geoJSON(geoJSON, {
                        style: (feature) => {
                            const color = colorMode
                                ? colorMap.get(chipColorStrategy(item))
                                : getColorFromId(id);
                            return {
                                color,
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.4,
                                fillColor: color,
                            };
                        },
                        pointToLayer: (feature, latlng) => {
                            return L.circleMarker(latlng, {
                                radius: 8,
                                fillColor: "#007bffff",
                                color: "#0056b3",
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.9,
                            });
                        },
                        onEachFeature: function (feature, layer) {
                            layer.on({
                                click: () => onMarkerClick && onMarkerClick(id),
                                mouseover: function () {
                                    layer.bindPopup(getPopupContent(item)).openPopup();
                                },
                                mouseout: function () {
                                    layer.closePopup();
                                },
                            });
                        },
                    }).addTo(mapInstanceRef.current);
                    geoJSONLayersRef.current.push(geoJSONLayer);
                }
            });
            updateCenterLabels(L, mapInstanceRef.current, items, getGeoJSON);
            mapInstanceRef.current.on("zoomend", () => {
                updateCenterLabels(L, mapInstanceRef.current, items, getGeoJSON);
            });
            setTimeout(() => {
                mapInstanceRef.current?.invalidateSize();
            }, 200);
        });
    }, [items, showMap, getCoordinates, getId, getLabel, getGeoJSON, onMarkerClick, colorMode, chipColorStrategy]);
    React.useEffect(() => {
        if (!showMap && mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            markersRef.current = [];
            geoJSONLayersRef.current = [];
        }
    }, [showMap]);
    React.useEffect(() => {
        if (!showMap || !expandedId || typeof window === "undefined") return;
        import("leaflet").then(() => {
            const item = items.find((i) => getId(i) === expandedId);
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
                mapInstanceRef.current.setView([coords[1], coords[0]], 12, {
                    animate: true,
                });
            }
        });
    }, [items, showMap, getCoordinates, getId, getLabel, getGeoJSON, onMarkerClick, mapRef]);
    if (!showMap) return null;
    return (
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
                pointerEvents: "auto",
                transition: "flex-basis 0.2s",
                position: "relative",
            }}
        >
            <div style={{ padding: "4px", zIndex: 100, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <Switch
                    checked={colorMode}
                    onChange={() => setColorMode(v => !v)}
                    size="sm"
                    className="mr-2"
                />
                <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", marginRight: "16px" }}>
                    <Input
                        type="text"
                        radius="sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("general.search_location")}
                        style={{
                            width: "200px",
                        }}
                    />
                    <Button
                        radius="sm"
                        type="submit"
                        style={{
                            backgroundColor: "#007BFF",
                            color: "white",
                        }}
                        disabled={isSearching}
                    >
                        {isSearching ? t("general.searching") : t("general.search")}
                    </Button>
                </form>
            </div>
            <div
                ref={mapContainerRef}
                className="w-full border border-gray-300 shadow bg-white"
                style={{
                    minHeight: 0,
                    borderRadius: "8px",
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
            {/* Cursor coordinates box bottom left */}
            <div
                style={{
                    position: "absolute",
                    left: 12,
                    bottom: 12,
                    background: "rgba(255,255,255,0.95)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: "13px",
                    color: "#222",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    zIndex: 200,
                    minWidth: "220px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <div>
                    <span style={{ fontWeight: 500 }}>{t("general.cursor_coordinates") || "Cursor coordinates"}:</span>
                    <br />
                    {cursorCoords
                        ? `Lat: ${cursorCoords[0].toFixed(5)}, Lon: ${cursorCoords[1].toFixed(5)}`
                        : "-"}
                    <br />
                </div>
                <Button
                    radius="sm"
                    size="sm"
                    variant="flat"
                    style={{ minWidth: 32, padding: "0 8px" }}
                    onPress={handleCopyBBox}
                >
                    {"Copy BBox"}
                </Button>
                {copySuccess && <span style={{ color: "green", marginLeft: "10px" }}>Copied!</span>}
            </div>
        </div>
    );
}
