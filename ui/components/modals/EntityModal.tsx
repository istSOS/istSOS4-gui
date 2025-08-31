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

"use client";

import React, { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Accordion, AccordionItem } from "@heroui/react";
import { useTranslation } from "react-i18next";


interface EntityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entity: any; //main entity data
  nestedEntities?: Record<string, any>; //nested entities data
  title?: string;
}

const EntityModal: React.FC<EntityModalProps> = ({
  isOpen,
  onOpenChange,
  entity,
  nestedEntities = {},
  title,
}) => {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const getLabel = (key: string) => {
    const map: Record<string, string> = {
      name: t("fields.name"),
      description: t("fields.description"),
      unitOfMeasurement: t("fields.unit_of_measurement"),
      observationType: t("fields.observation_type"),
      observedArea: t("fields.observed_area"),
      phenomenonTime: t("fields.phenomenon_time"),
      properties: t("fields.properties"),
      "@iot.id": t("fields.id"),
      "@iot.selfLink": t("fields.self_link"),
    };
    return map[key] || key;
  };

  const toggleExpand = (key: string) => {
    const newSet = new Set(expandedKeys);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedKeys(newSet);
  };

  const renderValue = (value: any, depth = 0) => {
    if (value === null || value === undefined) return "-";
    if (Array.isArray(value)) {
      return (
        <Accordion>
          {value.map((item, idx) => (
            <AccordionItem key={idx} title={`Item ${idx + 1}`}>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(item).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">{getLabel(k)}</label>
                    <div className="p-2 bg-gray-100 rounded-md">{renderValue(v, depth + 1)}</div>
                  </div>
                ))}
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
    if (typeof value === "object") {
      return (
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{getLabel(k)}</label>
              <div className="p-2 bg-gray-100 rounded-md">{renderValue(v, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  };

  const renderExpandedSection = (relationName: string, data: any) => {
    const isExpanded = expandedKeys.has(relationName);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div key={relationName} className="mt-4 border-t pt-4">
          <Button
            radius="sm"
            variant="light"
            onPress={() => toggleExpand(relationName)}
            className="flex items-center justify-between w-full"
          >
            <span className="font-medium">{getLabel(relationName)}</span>
            <span>{isExpanded ? "▲" : "▼"}</span>
          </Button>
          {isExpanded && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-500">
              {t("fields.no_data")}
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={relationName} className="mt-4 border-t pt-4">
        <Button
          radius="sm"
          variant="light"
          onPress={() => toggleExpand(relationName)}
          className="flex items-center justify-between w-full"
        >
          <span className="font-medium">{getLabel(relationName)}</span>
          <span>{isExpanded ? "▲" : "▼"}</span>
        </Button>
        {isExpanded && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            {Array.isArray(data) ? (
              <Accordion>
                {data.map((item: any, idx: number) => (
                  <AccordionItem key={idx} title={item.name || `${relationName} ${item["@iot.id"]}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(item).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-gray-700">{getLabel(k)}</label>
                          <div className="p-2 bg-gray-100 rounded-md">{renderValue(v)}</div>
                        </div>
                      ))}
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">{getLabel(k)}</label>
                    <div className="p-2 bg-gray-100 rounded-md">{renderValue(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              {title || t("entity_modal.title")}
            </ModalHeader>
            <ModalBody className="max-h-[70vh] overflow-y-auto">
              {!entity ? (
                <p>{t("fields..no_data")}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(entity).map(([key, value]) => {
                      // Skip internal metadata properties
                      if (key.startsWith('@iot') || key.endsWith('@iot.navigationLink')) return null;
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-gray-700">{getLabel(key)}</label>
                          <div className="p-2 bg-gray-100 rounded-md">{renderValue(value)}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Nested relations */}
                  {Object.entries(nestedEntities).map(([relationName, data]) =>
                    renderExpandedSection(relationName, data)
                  )}
                  {entity["@iot.selfLink"] && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">{t("fields.links")}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          radius="sm"
                          size="sm"
                          variant="bordered"
                          onPress={() => window.open(entity["@iot.selfLink"], "_blank")}
                        >
                          {t("fields.self_link")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                radius="sm"
                color="primary"
                onPress={onClose}>
                {t("general.close")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default EntityModal;