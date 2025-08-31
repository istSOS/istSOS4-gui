"use client";
import React, { useState, useEffect } from "react";
import { Input, Button, Textarea } from "@heroui/react";
import DrawGeometryModal from "../../components/modals/DrawGeometryModal";

type Props = {
  onCreate: (pendingLocation: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
};

const LocationCreator: React.FC<Props> = ({
  onCreate,
  onCancel,
  isLoading,
  error
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [encodingType, setEncodingType] = useState("application/geo+json");

  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");

  const [geometry, setGeometry] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [geometryValid, setGeometryValid] = useState(false);

  useEffect(() => {
    if (latitude !== "" && longitude !== "") {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        setGeometry({
          type: "Point",
          coordinates: [lon, lat]
        });
        setGeometryValid(true);
      } else {
        setGeometry(null);
        setGeometryValid(false);
      }
    } else if (latitude === "" && longitude === "" && (!geometry || geometry.type === "Point")) {
      if (geometry && geometry.type !== "Point") {
        setGeometryValid(true);
      } else {
        setGeometry(null);
        setGeometryValid(false);
      }
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (geometry) {
      const validTypes = [
        "Point",
        "LineString",
        "Polygon",
        "MultiPolygon",
        "MultiLineString",
        "MultiPoint"
      ];
      const ok =
        typeof geometry === "object" &&
        geometry.type &&
        validTypes.includes(geometry.type) &&
        geometry.coordinates;
      setGeometryValid(!!ok);
    } else {
      setGeometryValid(false);
    }
  }, [geometry]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setLatitude("");
    setLongitude("");
    setGeometry(null);
    setGeometryValid(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!geometryValid) return;
    onCreate({
      name,
      description,
      encodingType,
      location: geometry
    });
    resetForm();
  };

  const disabled = isLoading || !name || !geometryValid;

  const handleGeometryDrawn = (geojson: any) => {
    if (geojson?.geometry) {
      setGeometry(geojson.geometry);
      setLatitude("");
      setLongitude("");
    } else {
      setGeometry(null);
    }
    setModalOpen(false);
  };

  const clearGeometry = () => {
    setGeometry(null);
    setGeometryValid(false);
    setLatitude("");
    setLongitude("");
  };

  const isLatLonFilled = latitude !== "" || longitude !== "";

  return (
    <form
      onSubmit={handleSubmit}
      className="
        flex flex-col gap-6
        border border-default-200
        rounded-md p-5
        bg-content1 bg-gray-100
      "
      aria-label="Create Location"
    >
      <div className="text-sm font-semibold">
        Create Location
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input
          size="sm"
          variant="bordered"
          label="Name"
          value={name}
          isRequired
          onChange={e => setName(e.target.value)}
          required
        />

        <Input
          size="sm"
          variant="bordered"
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <Input
          size="sm"
          variant="bordered"
          label="Encoding Type"
          value={encodingType}
          onChange={e => setEncodingType(e.target.value)}
        />

        <div className="col-span-3 flex flex-wrap items-end gap-3">
            <Button
              radius="sm"
              size="sm"
              color={geometry && !isLatLonFilled ? "success" : "default"}
              onPress={() => setModalOpen(true)}
              type="button"
              disabled={isLatLonFilled || isLoading}
            >
              {geometry && !isLatLonFilled
                ? "Geometry selected"
                : "Select geometry on map"}
            </Button>

            <Input
              size="sm"
              variant="bordered"
              label="Latitude"
              type="number"
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              step="any"
              min={-90}
              max={90}
              className="w-40 h-10"
              isDisabled={!!geometry && geometry.type !== "Point"}
            />
            <Input
              size="sm"
              variant="bordered"
              label="Longitude"
              type="number"
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              step="any"
              min={-180}
              max={180}
              className="w-40 h-10"
              isDisabled={!!geometry && geometry.type !== "Point"}
            />

            {geometry && (
              <Button
                radius="sm"
                size="sm"
                variant="bordered"
                color="danger"
                type="button"
                onPress={clearGeometry}
                disabled={isLoading}
              >
                Clear geometry
              </Button>
            )}
        </div>

        <div className="col-span-2">
          <Textarea
            size="sm"
            variant="bordered"
            label="GeoJSON Geometry Preview"
            value={
              geometry
                ? JSON.stringify(geometry, null, 2)
                : "Select a geometry or enter coordinates"
            }
            readOnly
            className="font-mono text-xs"
            minRows={5}
          />
        </div>

        {error && (
          <div className="col-span-2 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="col-span-2 flex flex-wrap items-center gap-3 mt-1">
          <Button
            radius="sm"
            size="sm"
            color="primary"
            type="submit"
            isDisabled={disabled}
            isLoading={isLoading}
          >
            Save Location
          </Button>
          <Button
            radius="sm"
            size="sm"
            variant="bordered"
            type="button"
            onPress={() => {
              resetForm();
              onCancel();
            }}
            isDisabled={isLoading}
          >
            Cancel
          </Button>
          {geometryValid && name && (
            <span className="text-xs text-success-600 font-medium">
              Ready to submit
            </span>
          )}
          {!geometryValid && (
            <span className="text-xs text-warning-600">
              Provide valid coordinates or draw a geometry
            </span>
          )}
        </div>
      </div>

      {modalOpen && (
        <DrawGeometryModal
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          onGeometryDrawn={handleGeometryDrawn}
        />
      )}
    </form>
  );
};

export default LocationCreator;