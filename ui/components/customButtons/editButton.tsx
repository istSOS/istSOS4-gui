import * as React from "react";
import { Button, Tooltip } from "@heroui/react";
import { EditIcon } from "../icons";
import { useTranslation } from "react-i18next";



type EditButtonProps = {
    onEdit: () => void;
    isLoading?: boolean;
    disabled?: boolean;
};

const EditButton: React.FC<EditButtonProps> = ({ onEdit, isLoading = false, disabled = false }) => {
    const { t } = useTranslation();

    return (
        <Tooltip content={t("general.edit")}>
            <Button
                radius="sm"
                isIconOnly
                color="warning"
                variant="light"
                onPress={onEdit}
                disabled={isLoading || disabled}
            >
                {isLoading ? <span className="loader"></span> : <EditIcon />}
            </Button>
        </Tooltip>
    );
};

export default EditButton;