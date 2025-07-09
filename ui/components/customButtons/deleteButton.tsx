import * as React from "react";
import { Button } from "@heroui/react";
import deleteData from "../../server/deleteData";
import { useTranslation } from "react-i18next";

type DeleteButtonProps = {
  endpoint: string; // endpoint completo, es: "/Observations(1)"
  token: string;
  onDeleted?: () => void; // callback opzionale dopo la cancellazione
};

const DeleteButton: React.FC<DeleteButtonProps> = ({ endpoint, token, onDeleted }) => {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { t } = useTranslation();

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteData(endpoint, token);
      setShowConfirm(false);
      if (onDeleted) onDeleted();
    } catch (err) {
      setError("Error during deletion.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {showConfirm && (
        <div className="absolute right-0 -top-24 bg-white border rounded shadow-lg p-4 z-10 flex flex-col items-center">
          <p className="mb-2 text-sm">{t("general.confirm_delete")}</p>
          <div className="flex gap-2">
            <Button
              color="danger"
              size="sm"
              onPress={handleDelete}
              isLoading={isLoading}
            >
              {t("general.yes")}
            </Button>
            <Button
              size="sm"
              variant="bordered"
              onPress={() => setShowConfirm(false)}
              disabled={isLoading}
            >
              {t("general.no")}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
      <Button
        color="danger"
        onPress={() => setShowConfirm(true)}
        disabled={isLoading}
      >
        {t("general.delete")}
      </Button>
    </div>
  );
};

export default DeleteButton;