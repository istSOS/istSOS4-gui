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

    // Lat / Lon manual point inputs
    const [latitude, setLatitude] = useState<string>("");
    const [longitude, setLongitude] = useState<string>("");

    // Geometry from map (GeoJSON Geometry object)
    const [geometry, setGeometry] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Validation
    const [geometryValid, setGeometryValid] = useState(false);

    // Keep geometry in sync with lat/lon (like FeatureOfInterestCreator)
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
            // Do not clear geometry if it was a non-point drawn shape
            if (geometry && geometry.type !== "Point") {
                // keep drawn geometry
                setGeometryValid(true);
            } else {
                setGeometry(null);
                setGeometryValid(false);
            }
        }
    }, [latitude, longitude]);

    // Validate when geometry changes (drawn on map)
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

        // geometry already represents either drawn shape or point from lat/lon
        const payload = {
            name,
            description,
            encodingType,
            location: geometry
        };
        onCreate(payload);
        resetForm();
    };

    const disabled = isLoading || !name || !geometryValid;

    const handleGeometryDrawn = (geojson: any) => {
        // Expecting geojson.geometry
        if (geojson?.geometry) {
            setGeometry(geojson.geometry);
            // Clear manual lat/lon so the user understands geometry comes from map
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
            className="flex flex-col gap-4"
            aria-label="Create Location"
        >
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <Input
                        size="sm"
                        variant="bordered"
                        label="Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="col-span-2">
                    <Input
                        size="sm"
                        variant="bordered"
                        label="Description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>

                <div className="col-span-2">
                    <Input
                        size="sm"
                        variant="bordered"
                        label="Encoding Type"
                        value={encodingType}
                        onChange={e => setEncodingType(e.target.value)}
                    />
                </div>

                {/* Geometry selection controls (mirroring FeatureOfInterestCreator style) */}
                <div className="col-span-2 flex flex-wrap items-end gap-3">
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
                        className="w-40"
                        placeholder="Lat"
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
                        className="w-44"
                        placeholder="Lon"
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

                {/* GeoJSON Preview */}

                <div className="col-span-2">
                    <Textarea
                        size="sm"
                        variant="bordered"
                        label="GeoJSON Geometry Preview"
                        value={geometry ? JSON.stringify(geometry, null, 2) : "Select a geometry or enter coordinates"}
                        readOnly
                        className="font-mono text-xs"
                        minRows={5}
                    />
                </div>


                {error && (
                    <div className="col-span-2 text-sm text-red-600">
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
                        Create Location
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
                        <span className="text-xs text-green-600 font-medium">
                            Ready to submit
                        </span>
                    )}
                    {!geometryValid && (
                        <span className="text-xs text-amber-600">
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