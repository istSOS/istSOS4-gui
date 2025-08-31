/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from "react";
import { Button, Tooltip, Input } from "@heroui/react";
import { deleteData } from "../../server/api";
import { useTranslation } from "react-i18next";
import { DeleteIcon } from "../icons";

type DeleteButtonProps = {
  endpoint: string; // Complete endpoint URL for deletion
  token: string;
  entityName: string; // Name of the entity being deleted, for comparison with the confirmation message
  onDeleted?: () => void;
};

const DeleteButton: React.FC<DeleteButtonProps> = ({ endpoint, token, entityName, onDeleted }) => {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmationText, setConfirmationText] = React.useState("");
  const { t } = useTranslation();

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteData(endpoint, token);
      setShowConfirm(false);
      setConfirmationText("");
      if (onDeleted) onDeleted();
    } catch (err) {
      setError("Error during deletion.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const isDeleteEnabled = confirmationText === entityName;

  return (
    <div className="relative">
      {showConfirm && (
        <div className="absolute right-0 -top-10 bg-white border rounded shadow-lg p-4 z-10 flex flex-col items-center w-60">
          <p className="mb-2 text-sm">
            {endpoint.includes("datastream") ? t("general.confirm_delete_datastream") : t("general.confirm_delete")}
          </p>
          <Input
            placeholder={`${entityName}`}
            radius="sm"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button
              radius="sm"
              color="danger"
              variant={isDeleteEnabled ? "solid" : "bordered"}
              size="sm"
              onPress={handleDelete}
              isLoading={isLoading}
              disabled={!isDeleteEnabled}
            >
              {t("general.yes")}
            </Button>
            <Button
              radius="sm"
              size="sm"
              variant="bordered"
              onPress={() => {
                setShowConfirm(false);
                setConfirmationText("");
              }}
              disabled={isLoading}
            >
              {t("general.no")}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
      <Tooltip content={
        t("general.delete")}>
        <Button
          radius="sm"
          isIconOnly
          color="danger"
          variant="light"
          onPress={() => setShowConfirm(true)}
          disabled={isLoading}
        >
          {isLoading ? <span className="loader"></span> : <DeleteIcon />}
        </Button>
      </Tooltip>
    </div>
  );
};

export default DeleteButton;
