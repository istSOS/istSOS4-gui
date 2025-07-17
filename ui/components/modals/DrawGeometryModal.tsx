import React, { useState, useEffect, useRef } from "react";
import { Modal, ModalContent, Button } from "@heroui/react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface Props {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title?: string;
    onGeometryDrawn?: (geometry: any) => void;
}

const DrawGeometryModal: React.FC<Props> = ({ isOpen, onOpenChange, title, onGeometryDrawn }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const drawnItemsRef = useRef<any>(null);
    const [selectedGeometry, setSelectedGeometry] = useState<any>(null);
    const [isMapInitialized, setIsMapInitialized] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        
        const initializeMap = async () => {
            const L = await import("leaflet");
            await import("leaflet-draw"); // importa come side-effect

            // Recupera L patchato da window, se necessario
            const Leaflet = (window as any).L || L;

            if (!mapContainerRef.current || mapRef.current) return;

            // Inizializza la mappa
            mapRef.current = Leaflet.map(mapContainerRef.current, {
                center: [40, 15],
                zoom: 2
            });

            Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);

            // Inizializza il layer per gli elementi disegnati
            drawnItemsRef.current = new Leaflet.FeatureGroup();
            mapRef.current.addLayer(drawnItemsRef.current);

            // Aggiungi i controlli di disegno
            const drawControl = new Leaflet.Control.Draw({
                draw: {
                    polyline: false,
                    rectangle: false,
                    circle: false,
                    marker: true,
                    polygon: true,
                },
                edit: {
                    featureGroup: drawnItemsRef.current
                }
            });

            mapRef.current.addControl(drawControl);

            // Gestisci gli eventi
            mapRef.current.on(Leaflet.Draw.Event.CREATED, (e: any) => {
                const layer = e.layer;
                drawnItemsRef.current.addLayer(layer);
                setSelectedGeometry(layer.toGeoJSON());
            });

            mapRef.current.on("draw:deleted", () => {
                setSelectedGeometry(null);
            });

            setIsMapInitialized(true);
        };
        

        initializeMap();

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                drawnItemsRef.current = null;
                setIsMapInitialized(false);
            }
        };
    }, [isOpen]);

    useEffect(() => {
        // Pulisci la mappa quando il modal viene chiuso
        if (!isOpen && mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            drawnItemsRef.current = null;
            setSelectedGeometry(null);
            setIsMapInitialized(false);
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (selectedGeometry && onGeometryDrawn) {
            onGeometryDrawn(selectedGeometry);
            onOpenChange(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
            <ModalContent>
                <div className="p-8 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold mb-4">{title || "Draw geometry"}</h2>
                    <div
                        ref={mapContainerRef}
                        style={{
                            width: "100%",
                            height: "400px",
                            borderRadius: 8,
                            overflow: "hidden",
                            zIndex: 1000
                        }}
                    />
                    <div className="mt-4 text-gray-500 text-sm">
                        {isMapInitialized
                            ? "Use the tools on the map to draw points and polygons."
                            : "Initializing map..."}
                    </div>
                    <div className="flex mt-6">
                        <Button
                            color="primary"
                            onPress={handleConfirm}
                            className="mr-4"
                            disabled={!selectedGeometry}
                        >
                            Confirm Selection
                        </Button>
                        <Button onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </ModalContent>
        </Modal>
    );
};

export default DrawGeometryModal;