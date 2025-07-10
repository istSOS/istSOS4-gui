"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spinner, Accordion, AccordionItem } from "@heroui/react";
import { useAuth } from "../context/AuthContext";
import fetchData from "../server/fetchData";
import { useTranslation } from "react-i18next";

interface EntityModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entityUrl: string;
  title?: string;
}

// Define which relations to expand for each entity type
const EXPAND_MAP: Record<string, string[]> = {
  Things: ["Locations", "Datastreams", "HistoricalLocations"],
  Datastreams: ["Thing", "Sensor", "ObservedProperty", "Observations"],
  Sensors: ["Datastreams"],
  Locations: ["Things"],
  ObservedProperties: ["Datastreams"],
  Observations: ["Datastream", "FeatureOfInterest"],
  FeaturesOfInterest: ["Observations"],
  HistoricalLocations: ["Thing", "Locations"],
};

const EntityModal: React.FC<EntityModalProps> = ({ isOpen, onOpenChange, entityUrl, title }) => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [entity, setEntity] = useState<any>(null);
  const [expandedData, setExpandedData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && entityUrl) {
      setLoading(true);
      setError(null);
      setEntity(null);
      setExpandedData({});
      
      // Extract entity type from URL
      const entityType = entityUrl.split('/').pop()?.split('(')[0];
      const expandRelations = entityType ? EXPAND_MAP[entityType] || [] : [];
      
      // Build URL with $expand parameter
      const expandQuery = expandRelations.length > 0 
        ? `?$expand=${expandRelations.join(',')}` 
        : '';
      
      fetchData(`${entityUrl}${expandQuery}`, token)
        .then(data => {
          setEntity(data);
          
          // Pre-fetch expanded relations
          const relationsToFetch: Record<string, string> = {};
          Object.entries(data).forEach(([key, value]) => {
            if (key.endsWith('@iot.navigationLink') && typeof value === 'string') {
              const relationName = key.replace('@iot.navigationLink', '');
              relationsToFetch[relationName] = value;
            }
          });
          
          // Fetch all navigation links
          Promise.all(
            Object.entries(relationsToFetch).map(([name, url]) => 
              fetchData(url, token).then(data => ({ name, data }))
            )
          ).then(results => {
            const expanded = results.reduce((acc, { name, data }) => {
              acc[name] = data;
              return acc;
            }, {} as Record<string, any>);
            setExpandedData(expanded);
          });
        })
        .catch(err => {
          setError(err.message || t("general.fetch_error"));
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setEntity(null);
      setExpandedData({});
    }
  }, [isOpen, entityUrl, token]);

  const getLabel = (key: string) => {
    const map: Record<string, string> = {
      name: t("entity_modal.name"),
      description: t("entity_modal.description"),
      unitOfMeasurement: t("entity_modal.unit_of_measurement"),
      observationType: t("entity_modal.observation_type"),
      observedArea: t("entity_modal.observed_area"),
      phenomenonTime: t("entity_modal.phenomenon_time"),
      properties: t("entity_modal.properties"),
      "@iot.id": t("entity_modal.id"),
      "@iot.selfLink": t("entity_modal.self_link"),
      "Locations@iot.navigationLink": t("entity_modal.locations_link"),
      "Datastreams@iot.navigationLink": t("entity_modal.datastreams_link"),
      "HistoricalLocations@iot.navigationLink": t("entity_modal.historical_locations_link"),
      "Thing@iot.navigationLink": t("entity_modal.thing_link"),
      "Sensor@iot.navigationLink": t("entity_modal.sensor_link"),
      "ObservedProperty@iot.navigationLink": t("entity_modal.observed_property_link"),
      "Observations@iot.navigationLink": t("entity_modal.observations_link"),
      "FeatureOfInterest@iot.navigationLink": t("entity_modal.feature_of_interest_link"),
    };
    return map[key] || key;
  };

  const toggleExpand = (key: string) => {
    const newSet = new Set(expandedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedKeys(newSet);
  };

  const renderValue = (value: any, depth = 0) => {
    if (value === null || value === undefined) return "-";
    
    if (Array.isArray(value)) {
      return (
        <Accordion>
          {value.map((item, index) => (
            <AccordionItem 
              key={index} 
              title={`Item ${index + 1}`}
              className="ml-4"
            >
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(item).map(([subKey, subValue]) => (
                  <div key={subKey} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">
                      {getLabel(subKey)}
                    </label>
                    <div className="p-2 bg-gray-100 rounded-md">
                      {renderValue(subValue, depth + 1)}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
    
    if (typeof value === 'object') {
      return (
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(value).map(([subKey, subValue]) => (
            <div key={subKey} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {getLabel(subKey)}
              </label>
              <div className="p-2 bg-gray-100 rounded-md">
                {renderValue(subValue, depth + 1)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    return String(value);
  };

  const renderExpandedSection = (relationName: string, data: any) => {
    const isExpanded = expandedKeys.has(relationName);
    
    return (
      <div key={relationName} className="mt-4 border-t pt-4">
        <Button 
          variant="light" 
          onPress={() => toggleExpand(relationName)}
          className="flex items-center justify-between w-full"
        >
          <span className="font-medium">{getLabel(relationName)}</span>
          <span>{isExpanded ? "▲" : "▼"}</span>
        </Button>
        
        {isExpanded && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            {Array.isArray(data.value) ? (
              <Accordion>
                {data.value.map((item: any, index: number) => (
                  <AccordionItem 
                    key={index} 
                    title={item.name || `${relationName} ${item["@iot.id"]}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(item).map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-gray-700">
                            {getLabel(key)}
                          </label>
                          <div className="p-2 bg-gray-100 rounded-md">
                            {renderValue(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">
                      {getLabel(key)}
                    </label>
                    <div className="p-2 bg-gray-100 rounded-md">
                      {renderValue(value)}
                    </div>
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
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <Spinner />
                </div>
              ) : error ? (
                <p className="text-danger">{error}</p>
              ) : entity ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(entity).map(([key, value]) => {
                      // Skip internal metadata properties
                      if (key.startsWith('@iot') || key.endsWith('@iot.navigationLink')) {
                        return null;
                      }
                      
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-gray-700">
                            {getLabel(key)}
                          </label>
                          <div className="p-2 bg-gray-100 rounded-md">
                            {renderValue(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Expanded relations */}
                  {Object.entries(expandedData).map(([relationName, data]) => 
                    renderExpandedSection(relationName, data)
                  )}
                  
                  {entity["@iot.selfLink"] && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">{t("entity_modal.links")}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="bordered"
                          onPress={() => window.open(entity["@iot.selfLink"], '_blank')}
                        >
                          {t("entity_modal.self_link")}
                        </Button>
                        
                        {Object.entries(entity)
                          .filter(([key]) => key.endsWith('@iot.navigationLink'))
                          .map(([key, value]) => (
                            <Button
                              key={key}
                              size="sm"
                              variant="bordered"
                              onPress={() => window.open(value as string, '_blank')}
                            >
                              {getLabel(key)}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p>{t("entity_modal.no_data")}</p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose}>
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