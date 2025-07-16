"use client";

import React, { useState, useRef, useEffect } from "react";
import { Modal, ModalContent, Button } from "@heroui/react";
import MapWrapper from "../MapWrapper";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// This modal allows the user to draw points and polygons on the map.
// Drawing tools are provided by leaflet-draw, loaded dynamically on client side.

interface Props {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title?: string;
}

const DrawGeometryModal: React.FC<Props> = ({
    isOpen,
    onOpenChange,
    title,
}) => {
    // Store drawn geometries as GeoJSON
    const [drawnGeometries, setDrawnGeometries] = useState<any[]>([]);
    // Reference to the Leaflet map instance
    const mapRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;

        let map: any;
        let drawnItems: any;
        let drawControl: any;

        // Dynamically import leaflet and leaflet-draw only on client side
        import("leaflet").then(L => {
            // Access the map instance from MapWrapper
            if (!mapRef.current) return;
            map = mapRef.current;

            // Create a feature group to store drawn items
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);

            import("leaflet-draw").then(() => {
                // Add drawing controls (only marker and polygon)
                drawControl = new L.Control.Draw({
                    draw: {
                        polyline: false,
                        rectangle: false,
                        circle: false,
                        marker: false,
                        polygon: false,
                    },
                    edit: { featureGroup: drawnItems }
                });
                map.addControl(drawControl);

                // Listen for new drawn geometries
                map.on(L.Draw.Event.CREATED, function (e: any) {
                    drawnItems.addLayer(e.layer);
                    setDrawnGeometries(prev => [...prev, e.layer.toGeoJSON()]);
                });
            });
        });

        // Cleanup: remove controls and layers when modal closes
        return () => {
            if (map && drawControl) {
                map.removeControl(drawControl);
            }
            if (map && drawnItems) {
                map.removeLayer(drawnItems);
            }
        };
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
            <ModalContent>
                <div className="p-8 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold mb-4">{title || "Draw geometry"}</h2>
                    <div style={{ width: "100%", height: "400px", borderRadius: 8, overflow: "hidden" }}>
                        
                        <MapWrapper
                            items={drawnGeometries}
                            getCoordinates={item => item.geometry.type === "Point" ? item.geometry.coordinates : null}
                            getId={item => item.id || Math.random().toString()}
                            getLabel={item => item.geometry.type}
                            getGeoJSON={item => item}
                            showMap={true}
                            split={0}
                            setSplit={() => {}}
                            showMarkers={true}
                            mapRef={mapRef} 
                        />
                    </div>
                    <div className="mt-4 text-gray-500 text-sm">
                        Use the tools on the map to draw points and polygons.
                    </div>
                    <Button color="primary" onPress={() => onOpenChange(false)} className="mt-6">
                        Close
                    </Button>
                </div>
            </ModalContent>
        </Modal>
    );
};

export default DrawGeometryModal;