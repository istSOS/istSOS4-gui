import * as React from "react";
import "leaflet/dist/leaflet.css";

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
};

// Color palette for features
const colorPalette = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
    "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

// Generate a stable color from an id using a hash function
function getColorFromId(id: string) {
    let hash = 4353;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) + hash) + id.charCodeAt(i); // hash * 33 + c
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
}: MapWrapperProps) {
    const mapContainerRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<any>(null);
    const markersRef = React.useRef<any[]>([]);
    const geoJSONLayersRef = React.useRef<any[]>([]);
    const [isSplitting, setIsSplitting] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isSearching, setIsSearching] = React.useState(false);

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

    React.useEffect(() => {
        if (!showMap || !mapContainerRef.current || typeof window === "undefined") return;
        import("leaflet").then((L) => {
            if (!mapContainerRef.current) return;

            if (!mapInstanceRef.current) {
                const first = items[0] && getCoordinates(items[0]);
                const center = first || [0, 0];
                const leafletMap = L.map(mapContainerRef.current, {
                    worldCopyJump: false,
                    maxBounds: [
                        [-90, -180],
                        [90, 180],
                    ],
                    maxBoundsViscosity: 1.0,
                }).setView(center, 2);
                mapInstanceRef.current = leafletMap;
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                }).addTo(leafletMap);
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
                            marker.bindPopup(getLabel(item)).openPopup();
                        })
                        .on("mouseout", function () {
                            marker.closePopup();
                        });
                    markersRef.current.push(marker);
                }

                if (geoJSON) {
                    const geoJSONLayer = L.geoJSON(geoJSON, {
                        style: (feature) => {

                            const color = getColorFromId(id);
                            console.log("ID:", id, "Color:", color, "GeoJSON:", geoJSON);
                            return {
                                color,
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.4,
                                fillColor: color,
                            };
                        },
                        onEachFeature: function (feature, layer) {
                            layer.on({
                                click: () => onMarkerClick && onMarkerClick(id),
                                mouseover: function () {
                                    layer.bindPopup(getLabel(item)).openPopup();
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

            setTimeout(() => {
                mapInstanceRef.current?.invalidateSize();
            }, 200);
        });
    }, [items, showMap, getCoordinates, getId, getLabel, getGeoJSON, onMarkerClick]);

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
                mapInstanceRef.current.setView([coords[1], coords[0]], 13, {
                    animate: true,
                });
            }
        });
    }, [expandedId, showMap, items, getCoordinates, getId]);

    if (!showMap) return null;

    return (
        <div
            id="resizable-map-wrapper"
            className="relative"
            style={{
                flexBasis: `${(1 - split) * 100}%`,
                minWidth: 150,
                //maxWidth: "100%",
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
            <div style={{ padding: "5px", zIndex: 900, display: "flex", justifyContent: "flex-end" }}>
                <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center" }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for a location..."
                        style={{
                            padding: "4px",
                            width: "200px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                            fontSize: "14px",
                            boxSizing: "border-box",
                        }}
                    />
                    <button
                        type="submit"
                        style={{
                            width: "70px",
                            padding: "4px 0",
                            marginLeft: "8px",
                            backgroundColor: "#007BFF",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                        disabled={isSearching}
                    >
                        {isSearching ? "Searching..." : "Search"}
                    </button>
                </form>
            </div>
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
    );
}