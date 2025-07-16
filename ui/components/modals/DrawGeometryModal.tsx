"use client";
import React, { useState, useRef, useEffect } from "react";
import { Modal, ModalContent, Button } from "@heroui/react";
import MapWrapper from "../MapWrapper";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface Props {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title?: string;
}

const DrawGeometryModal: React.FC<Props> = ({ isOpen, onOpenChange, title }) => {
  const [drawnGeometries, setDrawnGeometries] = useState<any[]>([]);
  const mapRef = useRef<any>(null);
  const controlsInitializedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      controlsInitializedRef.current = false;
      return;
    }

    let map: any;
    let drawnItems: any;
    let drawControl: any;

    const initializeControls = (L: any) => {
      if (!mapRef.current || controlsInitializedRef.current) return;

      map = mapRef.current;

      // Remove existing controls and layers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Control.Draw) {
          map.removeControl(layer);
        }
      });

      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      drawControl = new L.Control.Draw({
        draw: {
          polyline: false,
          rectangle: false,
          circle: false,
          marker: true,
          polygon: true,
        },
        edit: { featureGroup: drawnItems },
      });

      map.addControl(drawControl);
      controlsInitializedRef.current = true;

      // Restore drawn geometries on open
      drawnGeometries.forEach((geojson) => {
        const layer = L.geoJSON(geojson);
        layer.eachLayer((l: any) => drawnItems.addLayer(l));
      });

      map.on(L.Draw.Event.CREATED, function (e: any) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        setDrawnGeometries((prev) => [...prev, layer.toGeoJSON()]);
      });
    };

    import("leaflet").then((L) => {
      if (!controlsInitializedRef.current) {
        import("leaflet-draw").then(() => {
          initializeControls(L);
        });
      }
    });

    // Cleanup: remove controls and layers when modal closes
    return () => {
      if (map && drawControl) {
        map.removeControl(drawControl);
      }
      if (map && drawnItems) {
        map.removeLayer(drawnItems);
      }
      controlsInitializedRef.current = false;
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
              getCoordinates={(item) => (item.geometry.type === "Point" ? item.geometry.coordinates : null)}
              getId={(item) => item.id || Math.random().toString()}
              getLabel={(item) => item.geometry.type}
              getGeoJSON={(item) => item}
              showMap={true}
              split={0}
              setSplit={() => {}}
              showMarkers={true}
              mapRef={mapRef}
            />
          </div>
          <div className="mt-4 text-gray-500 text-sm">Use the tools on the map to draw points and polygons.</div>
          <Button color="primary" onPress={() => onOpenChange(false)} className="mt-6">
            Close
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
};

export default DrawGeometryModal;
