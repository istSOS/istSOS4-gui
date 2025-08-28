"use client";
import React from "react";
import { Accordion, AccordionItem, Button, Input, Textarea, Chip } from "@heroui/react";
import EntityCreator from "../components/EntityCreator";
import DeleteButton from "../components/customButtons/deleteButton";
import EditButton from "../components/customButtons/editButton";
import { EditIcon } from "../components/icons";
import { useTranslation } from "react-i18next";
import EntityModal from "./modals/EntityModal";
import { useRouter } from "next/navigation";
import { getTimeAgoDays, getColorScale } from "./hooks/useColorScale";
import { useTimezone } from "../context/TimezoneContext";
import { DateTime } from "luxon";
import { formatDateWithTimezone } from "./hooks/formatDateWithTimezone";
import LocationCreator from "../app/locations/LocationCreator";

const EntityAccordion = ({
  items,
  fields,
  expandedId,
  onItemSelect,
  entityType,
  onEdit,
  onSaveEdit,
  onDelete,
  onCreate,
  handleCancelCreate,
  handleCancelEdit,
  showCreateForm,
  isCreating,
  createError,
  editEntity,
  isEditing,
  editError,
  token,
  nestedEntities = {},
  sortOrder,
  setSortOrder,
  chipColorStrategy
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  // Modal state for nested entity details
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalEntity, setModalEntity] = React.useState<any>(null);
  const [modalNestedEntities, setModalNestedEntities] = React.useState<Record<string, any>>({});

  const { timezone } = useTimezone();

  // Stato per mostrare il LocationCreator inline per una Thing
  const [locationCreateForId, setLocationCreateForId] = React.useState<string | null>(null);

  const getLabel = (key) => {
    const map = {
      name: t(`${entityType}.name`),
      description: t(`${entityType}.description`),
      unitOfMeasurement: t(`${entityType}.unit_of_measurement`),
      observationType: t(`${entityType}.observation_type`),
      observedArea: t(`${entityType}.observed_area`),
      phenomenonTime: t(`${entityType}.phenomenon_time`),
      properties: t(`${entityType}.properties`),
      thingId: t(`${entityType}.thing_id`),
      sensorId: t(`${entityType}.sensor_id`),
      observedPropertyId: t(`${entityType}.observed_property_id`),
      latitude: t(`${entityType}.latitude`),
      longitude: t(`${entityType}.longitude`),
      encodingType: t(`${entityType}.encoding_type`),
      timeAgo: t(`general.last`),
      lastMeasurement: t(`general.end_date`),
      lastValue: t(`general.last_value`),
      startDate: t(`general.start_date`),
      endDate: t(`general.end_date`),
    };
    return map[key] || key;
  };

  const handleEditClick = (entity) => {
    if (onEdit) onEdit(entity);
    if (onItemSelect) onItemSelect(String(entity["@iot.id"]));
  };


  const handleLocationCreate = (loc, thingId) => {

    setLocationCreateForId(null);

  };

  return (
    <>
      <div className="bg-gray-100 p-1 rounded-md">
        {/* Header for the accordion "table" */}
        {entityType === "datastreams" && !showCreateForm && (
          <div className="grid grid-cols-5 gap-x-8 pl-2 py-1 pr-60 font-semibold text-gray-700 text-sm">
            <span>{getLabel("name")}</span>
            <span
              className="pl-4 cursor-pointer select-none hover:underline"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              title={sortOrder === "desc" ? "Sort by oldest" : "Sort by newest"}
            >
              {t("general.last")}
              {sortOrder === "desc" ? " ↓" : " ↑"}
            </span>
            <span className="pl-8">{t("general.last_value")}</span>
            <span className="pl-12">{t("general.start_date")}</span>
            <span className="pl-16">{t("general.end_date")}</span>
          </div>
        )}

        {/* Accordion rows with buttons outside the trigger */}
        <div>
          {showCreateForm && (
            <div className="flex items-center w-full">
              <div className="flex-1">
                <Accordion
                  isCompact
                  selectedKeys={["new-entity"]}
                >
                  <AccordionItem
                    key="new-entity"
                    id={`entity-accordion-item-new-${entityType}`}
                    title={
                      <div className="grid grid-cols-5 gap-2 pl-2 items-center w-full">
                        <span className="font-bold text-lg text-gray-800">New {entityType}</span>
                      </div>
                    }
                    value="new-entity"
                  >
                    <EntityCreator
                      fields={fields}
                      onCreate={onCreate}
                      onCancel={handleCancelCreate}
                      isLoading={isCreating}
                      error={createError}
                      initialValues={
                        fields.reduce((acc, field) => {
                          acc[field.name] = field.defaultValue || "";
                          return acc;
                        }, {})
                      }
                    />

                  </AccordionItem>
                </Accordion>
              </div>
              {/* No actions for new entity */}
              <div className="w-32" />
            </div>
          )}

          {items.length === 0 && !showCreateForm ? (
            <p>No available {entityType.toLowerCase()}s.</p>
          ) : (
            items.map((entity, idx) => (
              <div key={entity["@iot.id"] ?? idx} className="flex items-center w-full border-b border-gray-300 last:border-b-0">
                {/* AccordionItem (trigger and content) */}
                <div className="flex-1">
                  <Accordion
                    isCompact
                    selectedKeys={expandedId ? [expandedId] : []}
                    onSelectionChange={(key) => {
                      if (typeof key === "string") onItemSelect(key);
                      else if (key && typeof key === "object" && "has" in key) {
                        const arr = Array.from(key);
                        onItemSelect(arr[0] != null ? String(arr[0]) : null);
                      } else if (Array.isArray(key)) {
                        onItemSelect(key[0] ?? null);
                      } else {
                        onItemSelect(null);
                      }
                    }}
                  >
                    <AccordionItem
                      key={entity["@iot.id"] ?? idx}
                      title={
                        <div className="grid grid-cols-5 w-full">
                          <span className="font-bold text-gray-800">{entity.name ?? entity["@iot.id"] ?? "-"}</span>
                          {entityType === "datastreams" ? (
                            <>
                              <Chip
                                className="capitalize"
                                variant="dot"
                                color={
                                  entityType === "datastreams"
                                    ? (chipColorStrategy
                                      ? chipColorStrategy(entity)
                                      : getColorScale(items, entity))
                                    : "default"
                                }
                              >
                                {entity.timeAgo ?? "-"}
                              </Chip>
                              <span className="text-gray-600">{entity.lastValue ?? "-"} {entity.unitOfMeasurement?.symbol ?? "-"}</span>
                              <span className="text-gray-600">
                                {formatDateWithTimezone(entity.startDate, timezone)}
                              </span>
                              <span className="text-gray-600">
                                {formatDateWithTimezone(entity.endDate, timezone)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-600">{entity.description ?? "-"}</span>
                            </>
                          )}
                        </div>
                      }
                      value={String(entity["@iot.id"] ?? idx)}
                    >
                      {editEntity && editEntity["@iot.id"] === entity["@iot.id"] ? (
                        <div className="mt-2 flex flex-row gap-8">
                          <div className="flex-[2] gap-2">
                            <EntityCreator
                              fields={fields}
                              onCreate={(updatedEntity) => onSaveEdit(updatedEntity, entity)}
                              onCancel={handleCancelEdit}
                              isLoading={isEditing}
                              error={editError}
                              initialValues={
                                fields.reduce((acc, field) => {
                                  let value = entity[field.name];
                                  if (field.type === "select" && value && typeof value === "object" && "@iot.id" in value) {
                                    acc[field.name] = String(value["@iot.id"]);
                                  } else if (field.name === "unitOfMeasurement" && value && typeof value === "object") {
                                    acc[field.name] = value.name || "";
                                  } else if (field.name === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
                                    acc[field.name] = Object.entries(value).map(([k, v]) => ({ key: k, value: v }));
                                  } else {
                                    acc[field.name] = value ?? "";
                                  }
                                  return acc;
                                }, {})
                              }

                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-row gap-8">
                          <div className="flex-[2] grid grid-cols-2 gap-2">
                            {fields.map(field => {
                              const value = entity[field.name];
                              if (value == null) return null;

                              let displayValue: string;
                              if (field.name === "unitOfMeasurement" && value && typeof value === "object") {
                                displayValue = `${value.symbol || ""} ${value.name ? `(${value.name})` : ""}`.trim() || "-";
                              } else if (typeof value === "object") {
                                displayValue = JSON.stringify(value);
                              } else {
                                displayValue = value?.toString() ?? "-";
                              }

                              return (
                                <div key={field.name} className="flex items-center gap-2">
                                  <Textarea
                                    disableAutosize
                                    readOnly
                                    variant="bordered"
                                    size="sm"
                                    label={field.label || getLabel(field.name)}
                                    value={displayValue}
                                    className="flex-1"
                                  />
                                </div>
                              );
                            })}

                            <div className="col-span-2">
                              <hr className="my-1" />
                              <span className="font-semibold text-gray-700 block mb-1">
                                {t("general.nested_entities") || "Nested Entities"}:
                              </span>

                              <div className="flex gap-2 items-center mb-2">
                                {/* Render buttons for nested entities */}
                                {Object.entries(nestedEntities?.[entity["@iot.id"]] || {})
                                  .filter(([key]) => key !== "Observations")
                                  .map(([key, nestedEntity]) => {
                                    if (!nestedEntity) return null;
                                    const entitiesArray = Array.isArray(nestedEntity) ? nestedEntity : [nestedEntity];
                                    return (
                                      <div key={key} className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{key}:</span>
                                        {entitiesArray.map((ent, idx) => (
                                          <Button
                                            radius="sm"
                                            key={ent["@iot.id"] || idx}
                                            size="sm"
                                            variant="solid"
                                            onPress={() => {
                                              setModalEntity(ent);
                                              const nestedId = ent?.["@iot.id"];
                                              setModalNestedEntities(nestedEntities?.[nestedId] || {});
                                              setModalOpen(true);
                                            }}
                                          >
                                            {(ent.name || ent.description || ent["@iot.id"] || "Details")}
                                          </Button>
                                        ))}
                                      </div>
                                    );
                                  })}

                              </div>

                              {/* Se il bottone è stato premuto, mostra il LocationCreator inline */}
                              {entityType === "things" && locationCreateForId === String(entity["@iot.id"]) && (
                                <div className="mt-2 p-2 border rounded bg-white">
                                  <LocationCreator
                                    onCreate={loc => handleLocationCreate(loc, entity["@iot.id"])}
                                    onCancel={() => setLocationCreateForId(null)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </AccordionItem>
                  </Accordion>
                </div>
                {/* EDIT AND DELETE BUTTONS */}
                <div className="flex items-center gap-1 pr-2">
                  <EditButton
                    onEdit={() => handleEditClick(entity)}
                    isLoading={isEditing && editEntity && editEntity["@iot.id"] === entity["@iot.id"]}
                  />
                  <DeleteButton
                    endpoint={`${entityType}(${entity["@iot.id"]})`}
                    token={token}
                    entityName={entity.name || entity["@iot.id"] || ""}
                    onDeleted={() => onDelete(entity["@iot.id"])}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal for nested entity details */}
      {modalOpen && modalEntity && (
        <EntityModal
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          entity={modalEntity}
          nestedEntities={modalNestedEntities}
          title={modalEntity.name || null}
        />
      )}
    </>
  );
};

export default EntityAccordion;