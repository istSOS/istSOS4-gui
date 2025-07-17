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
    const auth = useAuth();

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


                <Button
                    color={geometry ? "success" : "primary"}
                    onPress={() => {
                        setModalOpen(true);
                        //console.log("Modal open:", modalOpen);
                    }}
                    type="button"
                >
                    {geometry ? "Geometry selected" : "Select a geometry on the map"}
                </Button>

                {modalOpen && (
                    <DrawGeometryModal
                        isOpen={modalOpen}
                        onOpenChange={setModalOpen}
                        onGeometryDrawn={(geojson) => {
                            setGeometry(geojson.geometry);
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
                        disabled={!geometry}
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