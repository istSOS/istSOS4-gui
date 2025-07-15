import React from "react";
import { Button, Divider, Select } from "@heroui/react";
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
  filters?: { [key: string]: { label: string; options: { label: string; value: string | number }[]; value: string | number } };
  onFilterChange?: (key: string, value: string | number) => void;
}

export const EntityActions: React.FC<EntityActionsProps> = ({
  title,
  search,
  onSearchChange,
  onCreatePress,
  showMap,
  onToggleMap,
  hasMap,
  filters = {},
  onFilterChange
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


        {/*FILTERS*/}
        {Object.entries(filters).map(([key, filter]) => (
          <select
            key={key}
            value={filter.value}
            onChange={e => onFilterChange && onFilterChange(key, e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">{filter.label}</option>
            {filter.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ))}
        



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