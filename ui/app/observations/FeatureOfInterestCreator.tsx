import React, { useState } from "react";
import { Input, Button } from "@heroui/react";
import DrawGeometryModal from "../../components/modals/DrawGeometryModal";

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!geometry) return;
        onCreate({
            name,
            description,
            encodingType: "application/vnd.geo+json",
            feature: geometry,
        });
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Input
                    label="Nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <Input
                    label="Descrizione"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />


                <Button
                    color={geometry ? "success" : "primary"}
                    onPress={() => {
                        setModalOpen(true);
                        console.log("Modal open:", modalOpen);
                    }}
                    type="button"
                >
                    {geometry ? "Geometry selected" : "Select a geometry on the map"}
                </Button>

                {modalOpen && (
                    <DrawGeometryModal
                        isOpen={modalOpen}
                        onOpenChange={setModalOpen}
                    />
                )}


                {error && <span className="text-red-500">{error}</span>}
                <div className="flex gap-2 mt-2">
                    <Button
                        color="primary"
                        type="submit"
                        isLoading={isLoading}
                        disabled={!geometry}
                    >
                        Crea FeatureOfInterest
                    </Button>
                    <Button color="default" type="button" onPress={onCancel}>
                        Annulla
                    </Button>
                </div>
            </form>

        </>


    );
};

export default FeatureOfInterestCreator;