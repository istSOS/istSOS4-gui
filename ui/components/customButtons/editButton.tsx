import * as React from "react";
import { Button } from "@heroui/react";
import { EditIcon } from "../icons";

type EditButtonProps = {
    onEdit: () => void;
    isLoading?: boolean;
    disabled?: boolean;
};

const EditButton: React.FC<EditButtonProps> = ({ onEdit, isLoading = false, disabled = false }) => (
    <Button
        radius="sm"
        isIconOnly
        color="warning"
        onPress={onEdit}
        disabled={isLoading || disabled}
    >
        {isLoading ? <span className="loader"></span> : <EditIcon />}
    </Button>
);

export default EditButton;