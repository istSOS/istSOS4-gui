"use client";
import React, { useState, useEffect } from "react";
import { Input, Button } from "@heroui/react";

type Props = {
  onCreate: (pendingLocation: any) => void; // returns raw payload (NOT created yet)
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

  const [geometryValid, setGeometryValid] = useState(false);

  useEffect(() => {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      setGeometryValid(!isNaN(lat) && !isNaN(lon));
    } else {
      setGeometryValid(false);
    }
  }, [latitude, longitude]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!geometryValid) return;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const payload = {
      name,
      description,
      encodingType,
      location: {
        type: "Point",
        coordinates: [lon, lat]
      }
    };
    onCreate(payload); // parent will later POST this (deferred create like other pending entities)
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setLatitude("");
    setLongitude("");
    setGeometryValid(false);
  };

  const disabled = isLoading || !name || !geometryValid;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-3"
      aria-label="Create Location"
    >
      <div className="flex items-center col-span-2">
        <Input
          size="sm"
          variant="bordered"
            label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="flex-1"
        />
      </div>
      <div className="flex items-center col-span-2">
        <Input
          size="sm"
          variant="bordered"
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="flex-1"
        />
      </div>
      <div className="flex items-center col-span-2">
        <Input
          size="sm"
          variant="bordered"
          label="Encoding Type"
          value={encodingType}
          onChange={e => setEncodingType(e.target.value)}
          className="flex-1"
        />
      </div>
      <div className="flex items-center">
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
          required
        />
      </div>
      <div className="flex items-center">
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
          required
        />
      </div>

      {error && (
        <div className="col-span-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="col-span-2 flex items-center gap-2 mt-2">
        <Button
          size="sm"
          radius="sm"
          color="primary"
          type="submit"
          isDisabled={disabled}
          isLoading={isLoading}
        >
          Add pending Location
        </Button>
        <Button
          size="sm"
          radius="sm"
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
        {geometryValid && (
          <span className="text-xs text-green-600 font-medium">
            Geometry OK
          </span>
        )}
      </div>
    </form>
  );
};

export default LocationCreator;