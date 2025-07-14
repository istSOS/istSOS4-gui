"use client";
import React from "react";
import { Accordion, AccordionItem, Button, Input } from "@heroui/react";
import EntityCreator from "../components/EntityCreator";
import DeleteButton from "../components/customButtons/deleteButton";
import { useTranslation } from "react-i18next";
import EntityModal from "./EntityModal";
import { useRouter } from "next/navigation";

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
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  // Modal state for nested entity details
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalEntity, setModalEntity] = React.useState<any>(null);
  const [modalNestedEntities, setModalNestedEntities] = React.useState<Record<string, any>>({});

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
    };
    return map[key] || key;
  };

  const handleEditClick = (entity) => {
    if (onEdit) {
      onEdit(entity);
    }
  };

  // Helper to get the nested entity object from the map
  const getNestedEntity = (entity, key) => {
    if (!entity || !entity["@iot.id"] || !nestedEntities) return null;
    const nested = nestedEntities[entity["@iot.id"]];
    if (nested && nested[key]) return nested[key];
    return null;
  };

  return (
    <>
      <Accordion
        variant="splitted"
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
        {showCreateForm && (
          <AccordionItem
            key="new-entity"
            id={`entity-accordion-item-new-${entityType}`}
            title={
              <div className="flex items-baseline gap-3">
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
        )}
        {items.length === 0 && !showCreateForm ? (
          <p>No available {entityType.toLowerCase()}s.</p>
        ) : (
          items.map((entity, idx) => (
            <AccordionItem
              key={entity["@iot.id"] ?? idx}
              title={
                <div className="flex items-baseline gap-3">
                  <span className="font-bold text-lg text-gray-800">{entity.name ?? "-"}</span>
                  <span className="text-xs text-gray-500">{entity.description ?? "-"}</span>
                </div>
              }
              value={String(entity["@iot.id"] ?? idx)}
            >
              {editEntity && editEntity["@iot.id"] === entity["@iot.id"] ? (
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
                        const match = (field.options || []).find(
                          opt =>
                            opt.label === value.name &&
                            opt.symbol === value.symbol &&
                            opt.definition === value.definition
                        );
                        acc[field.name] = match ? match.value : "";
                      } else if (field.name === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
                        acc[field.name] = Object.entries(value).map(([k, v]) => ({ key: k, value: v }));
                      } else {
                        acc[field.name] = value ?? "";
                      }
                      return acc;
                    }, {})
                  }
                />
              ) : (
                <div className="mt-2 flex flex-row gap-8">
                  <div className="flex-[2] flex flex-col gap-2">
                    {Object.entries(entity).map(([key, value]) =>
                      (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[a-z]/.test(key)) ? null : (
                        <div key={key} className="flex items-center gap-2">
                          <label className="w-40 text-sm text-gray-700">
                            {getLabel(key)}
                          </label>
                          <Input
                            size="sm"
                            readOnly
                            value={
                              typeof value === "object"
                                ? JSON.stringify(value)
                                : value?.toString() ?? "-"
                            }
                            className="flex-1"
                          />

                        </div>
                      )

                    )}

                  </div>

                  <div className="w-px bg-gray-300" />
                  <div className="flex-[1] flex flex-col gap-2">
                    {/* Render buttons for nested entities */}
                    {Object.entries(nestedEntities?.[entity["@iot.id"]] || {}).map(([key, nestedEntity]) => {
                      if (!nestedEntity) return null;
                      console.log("Entity Type: " + entityType)
                      const entitiesArray = Array.isArray(nestedEntity) ? nestedEntity : [nestedEntity];
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-sm font-medium">{key}:</span>
                          {entitiesArray.map((ent, idx) => (
                            <Button
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

                    {/* If entityType is 'datastreams', show the "See observations values..." button */}
                    {entityType === "datastreams" && (
                      <div className="flex mt-4">
                        <Button
                          color="primary"
                          variant="solid"
                          onPress={() => {
                            // Replace this with the navigation or modal logic ()
                            // ex. route to `/datastreams/[id]/observations` DO IT LATER
                            router.push(`/datastreams/${entity["@iot.id"]}/observations`);
                          }}
                        >
                          View Observation values
                        </Button>
                      </div>
                    )}


                    <div
                      className="absolute bottom-0 right-0 w-full flex justify-end gap-2"
                      style={{ padding: "8px" }}
                    >

                      <Button color="warning" variant="bordered" onPress={() => handleEditClick(entity)}>
                        {t("general.edit")}
                      </Button>
                      <DeleteButton
                        endpoint={`${entityType}(${entity["@iot.id"]})`}
                        token={token}
                        onDeleted={() => onDelete(entity["@iot.id"])}
                      />
                    </div>

                  </div>
                </div>

              )}
            </AccordionItem>
          ))
        )}
      </Accordion>
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