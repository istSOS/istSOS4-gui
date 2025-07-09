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
};

// Funzione per generare un colore pastello casuale ma stabile per ogni id
function getRandomColor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 50%, 50%)`;
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
}: MapWrapperProps) {
    const mapContainerRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<any>(null);
    const markersRef = React.useRef<any[]>([]);
    const geoJSONLayersRef = React.useRef<any[]>([]);
    const [isSplitting, setIsSplitting] = React.useState(false);

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
            if (!mapContainerRef.current) {
                return;
            }

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
                const geoJSON = getGeoJSON(item);

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
                    const color = getRandomColor(getId(item));
                    const geoJSONLayer = L.geoJSON(geoJSON, {
                        style: {
                            color,
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.2,
                            fillColor: color,
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

        import("leaflet").then((L) => {
            const item = items.find((i) => getId(i) === expandedId);
            const coords = item && getCoordinates(item);

            if (mapInstanceRef.current && coords) {
                mapInstanceRef.current.setView([coords[1], coords[0]], 8, {
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
                maxWidth: "85%",
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


            {/* Splitter */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 4,
                    height: "100%",
                    cursor: "col-resize",
                    background: "#eee",
                    zIndex: 20,
                    userSelect: "none",
                }}
                onMouseDown={() => setIsSplitting(true)}
            />
        </div>
    );
}