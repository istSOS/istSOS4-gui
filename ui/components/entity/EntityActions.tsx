import React from "react";
import { Button, Divider, Select, SelectItem } from "@heroui/react";
import { SearchBar } from "../bars/searchBar";
import { SecNavbar } from "../bars/secNavbar";
import { useTranslation } from "react-i18next";

interface EntityActionsProps {
  hasMap?: boolean;
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
    <>


      <div className="flex items-center justify-between mb-2">
        <SecNavbar title={title} />
      </div>


      <Divider style={{ backgroundColor: "white", height: 1, margin: "8px 0" }} />


      <div className="flex flex-col justify-between items-start" >


        <div className="flex items-center w-full">
          <SearchBar
            value={search}
            onChange={onSearchChange}
            placeholder={t("general.search")}
          />
          <Button
            radius="sm"
            color="primary"
            onPress={onCreatePress}
            style={{ fontSize: 24, padding: "0 20px", minWidth: 0 }}
            aria-label="Add Entity"
          >
            +
          </Button>
        </div>



        <div className="flex items-center justify-between w-full mt-2 mb-2">

          <div className="flex items-center">
            {/* FILTERS */}
            {Object.entries(filters).map(([key, filter]) => (
              <Select

                key={key}
                radius="sm"

                selectedKeys={filter.value !== undefined && filter.value !== null ? [filter.value] : []}
                onSelectionChange={(selection) => {
                  if (onFilterChange) {
                    const selectedValue = Array.from(selection)[0];
                    onFilterChange(key, selectedValue);
                  }
                }}
                
                aria-label={filter.label}
                style={{
                  marginRight: "8px",
                  minWidth: "180px",
                  maxWidth: "300px",
                  width: "auto",
                }}
              >
                <SelectItem key="">{filter.label}</SelectItem>
                <>
                  {filter.options.map(opt => (
                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                  ))}
                </>
              </Select>
            ))}
          </div>

        </div>
      </div>

      
      { /* Divider to separate actions from content */ }

      { /*
      <Divider style={{ backgroundColor: "white", height: 3, margin: "8px 0", borderRadius: "8px" }} />
      */}

    </>
  );
};
