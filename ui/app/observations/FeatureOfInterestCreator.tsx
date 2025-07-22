import React, { useState } from "react";
import { Input, Button } from "@heroui/react";
import DrawGeometryModal from "../../components/modals/DrawGeometryModal";
import createData from "../../server/createData";
import { useAuth } from "../../context/AuthContext";

import { siteConfig } from "../../config/site";
const item = siteConfig.items.find(i => i.label === "FeaturesOfInterest");

type Props = {
    onCreate: (foi: any) => void;
    onCancel: () => void;
    isLoading?: boolean;
    error?: string | null;
};

const FeatureOfInterestCreator: React.FC<Props> = ({
    onCreate,
    onCancel,
    isLoading,
    error,
}) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [geometry, setGeometry] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [latitude, setLatitude] = useState<string>("");
    const [longitude, setLongitude] = useState<string>("");
    const auth = useAuth();

    
    React.useEffect(() => {
        if (latitude && longitude) {
            const lat = parseFloat(latitude);
            const lon = parseFloat(longitude);
            if (!isNaN(lat) && !isNaN(lon)) {
                setGeometry({
                    type: "Point",
                    coordinates: [lat, lon],
                });
            } else {
                setGeometry(null);
            }
        } else if (!latitude && !longitude) {
            setGeometry(null);
        }
    }, [latitude, longitude]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!geometry) return;
        setSubmitLoading(true);
        setSubmitError(null);
        try {
            const foiPayload = {
                name,
                description,
                encodingType: "application/vnd.geo+json",
                feature: geometry,
            };
            // Call API
            const foiRes = await createData(item.root, auth.token, foiPayload);
            onCreate(foiRes);
        } catch (err: any) {
            setSubmitError(err.message || "Error creating FeatureOfInterest");
        } finally {
            setSubmitLoading(false);
        }
    };

    // Disabilita il bottone se lat/lon sono compilati
    const isLatLonFilled = latitude !== "" || longitude !== "";

       const isGeometryValid = geometry !== null;

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                <Input
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <Input
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <div className="flex gap-2 items-end">
                    <Button
                        color={geometry && !isLatLonFilled ? "success" : "primary"}
                        onPress={() => setModalOpen(true)}
                        type="button"
                        disabled={isLatLonFilled}
                    >
                        {geometry && !isLatLonFilled
                            ? "Geometry selected"
                            : "Select a geometry on the map"}
                    </Button>
                    <Input
                        label="Latitude"
                        type="number"
                        value={latitude}
                        onChange={e => setLatitude(e.target.value)}
                        step="any"
                        min={-90}
                        max={90}
                        className="w-32"
                        placeholder="Lat"
                    />
                    <Input
                        label="Longitude"
                        type="number"
                        value={longitude}
                        onChange={e => setLongitude(e.target.value)}
                        step="any"
                        min={-180}
                        max={180}
                        className="w-36"
                        placeholder="Lon"
                    />
                </div>

                {modalOpen && (
                    <DrawGeometryModal
                        isOpen={modalOpen}
                        onOpenChange={setModalOpen}
                        onGeometryDrawn={(geojson) => {
                            setGeometry(geojson.geometry);
                            setLatitude("");
                            setLongitude("");
                            setModalOpen(false);
                        }}
                    />
                )}

                {submitError && <span className="text-red-500">{submitError}</span>}
                <div className="flex gap-2 mt-2">
                    <Button
                        color="primary"
                        type="submit"
                        isLoading={submitLoading}
                        disabled={!isGeometryValid}
                    >
                        Create FeatureOfInterest
                    </Button>
                    <Button color="default" type="button" onPress={onCancel}>
                        Cancel
                    </Button>
                </div>
            </form>
        </>
    );
};

export default FeatureOfInterestCreator;