import React from "react";
import { Button, Chip, Divider, Select, SelectItem, Tooltip } from "@heroui/react";
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
  filters?: {
    [key: string]: {
      label: string;
      options: Array<{
        label: string;
        value: string | number;
        disabled?: boolean;
        count?: number;
      }>;
      value: string | number;
    }
  };
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
      <div className="flex flex-col justify-between items-start">
        <div className="flex items-center w-full">
          <SearchBar
            value={search}
            onChange={onSearchChange}
            placeholder={t("general.search_placeholder")}
          />
          <div className="flex-1" />
          <Tooltip content={`Create New ${title}`}>
            <Button
              radius="sm"
              onPress={onCreatePress}
              style={{ fontSize: 24, padding: "0 20px", minWidth: 0, marginLeft: "8px" }}
              aria-label="Add Entity"
            >
              +
            </Button>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between w-full mt-2 mb-2">
          <div className="flex items-center">
            {Object.entries(filters).map(([key, filter]) => (
              <Select
                key={key}
                radius="sm"
                selectedKeys={
                  filter.value !== undefined && filter.value !== null
                    ? new Set([filter.value])
                    : new Set()
                }
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
                placeholder={filter.label}
                renderValue={(items) => {
                  if (!items) return filter.label;
                  const item = Array.from(items)[0];
                  return <span>{item.textValue}</span>;
                }}

                classNames={{popoverContent: "w-auto"}}
              >
                {filter.options.map(opt => (
                  <SelectItem
                    key={opt.value}
                    textValue={opt.label}
                    isDisabled={opt.disabled}
                    
                    
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="truncate">{opt.label}</span>
                      {typeof opt.count === "number" && opt.count > 0 && (
                        <Chip
                          size="sm"
                          variant="flat"
                          color="primary"
                        >
                          {opt.count}
                        </Chip>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </Select>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
