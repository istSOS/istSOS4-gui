import React from "react";
import { Button, Divider } from "@heroui/react";
import { SearchBar } from "../bars/searchBar";
import { SecNavbar } from "../bars/secNavbar";
import { useTranslation } from "react-i18next";

interface EntityActionsProps {
  hasMap?: boolean; //Indicates if the map feature is available
  onCreatePress: () => void;
  showMap?: boolean;
  onToggleMap?: () => void;
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
}

export const EntityActions: React.FC<EntityActionsProps> = ({
  title,
  search,
  onSearchChange,
  onCreatePress,
  showMap,
  onToggleMap,
  hasMap
}) => {
  const { t } = useTranslation();

  return (

    <><div className="flex items-center justify-between mb-2">
      <SecNavbar title={title} />
    </div><Divider style={{ backgroundColor: "white", height: 1, margin: "8px 0" }} />
    <div className="flex">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={t("general.search")} />
      
        <Button
          color="primary"
          size="sm"
          onPress={onCreatePress}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0 }}
          aria-label="Add Entity"
        >
          +
        </Button>

        {onToggleMap && hasMap && (
          <Button
            size="sm"
            variant="flat"
            className="ml-auto"
            onPress={onToggleMap}
          >
            {showMap ? t("locations.hide_map") : t("locations.show_map")}
          </Button>
        )}
      </div></>
  );
};