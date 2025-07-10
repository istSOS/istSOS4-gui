"use client";
// EntityAccordion.jsx
import React from "react";
import { Accordion, AccordionItem, Button, Input } from "@heroui/react";
import EntityCreator from "../components/EntityCreator";
import DeleteButton from "../components/customButtons/deleteButton";
import { useTranslation } from "react-i18next";

import { useRouter } from "next/navigation"; //TEMP

const entityLinkMap = {
  Thing: "/things",
  Sensor: "/sensors",
  ObservedProperty: "/observed-properties",
  FeatureOfInterest: "/features-of-interest",
  Location: "/locations",
  Datastream: "/datastreams",
  HistoricalLocation: "/historical-locations",
}; //TEMP

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
}) => {
  const { t } = useTranslation();
  const router = useRouter(); //TEMP

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

  return (
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
                acc[field.name] = field.default || "";
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

                    // Campi select: usa sempre stringa
                    if (field.type === "select" && value && typeof value === "object" && "@iot.id" in value) {
                      acc[field.name] = String(value["@iot.id"]);
                    }
                    // unitOfMeasurement (oggetto con name, symbol, definition)
                    else if (field.name === "unitOfMeasurement" && value && typeof value === "object") {
                      const match = (field.options || []).find(
                        opt =>
                          opt.label === value.name &&
                          opt.symbol === value.symbol &&
                          opt.definition === value.definition
                      );
                      acc[field.name] = match ? match.value : "";
                    }
                    // properties (oggetto -> array di {key, value})
                    else if (field.name === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
                      acc[field.name] = Object.entries(value).map(([k, v]) => ({ key: k, value: v }));
                    }
                    // Default
                    else {
                      acc[field.name] = value ?? "";
                    }
                    return acc;
                  }, {})
                }
              />
            ) : (
              <div className="mt-2 flex flex-row gap-8">
                <div className="flex-1 flex flex-col gap-2">
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
                <div className="w-px bg-gray-300 mx-4" />
                <div className="flex-1 flex flex-col gap-2">
                  {Object.entries(entity).map(([key, value]) =>
                    (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[A-Z]/.test(key)) ? null : (
                      <div key={key} className="flex items-center gap-2">

                        <Button
                          size="sm"
                          variant="solid"
                          onPress={() => {
                            const entityName = entityType.charAt(0).toUpperCase() + entityType.slice(1);
                            const entityId = entity["@iot.id"];
                            const expandKey = String(value).split("/").pop() || String(value);
                            const expandUrl = `${entityName}(${entityId})?$expand=${expandKey}`;

                            alert(`${expandUrl}`);
                          }}
                        >
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value).split("/").pop() || String(value)}
                        </Button>
                      </div>
                    )
                  )}
                  <div className="flex justify-end mt-4 gap-2 relative">
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
  );
};

export default EntityAccordion;
