"use client";

import * as React from "react";
import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { useTranslation } from "react-i18next";
import FeatureOfInterestCreator from "../app/observations/FeatureOfInterestCreator";
import LocationCreator from "../app/things/LocationCreator";

interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string; symbol?: string; definition?: string }>;
}

interface EntityCreatorProps {
  fields: Field[];
  onCreate: (entity: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  initialValues?: Record<string, any>;
}

export const EntityCreator: React.FC<EntityCreatorProps> = ({
  fields,
  onCreate,
  onCancel,
  isLoading,
  error,
  initialValues,
}) => {
  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const vals: Record<string, any> = {};
    fields.forEach((field) => {
      if (initialValues && initialValues[field.name] !== undefined) {
        vals[field.name] = initialValues[field.name];
      } else if (field.type === "coordinates") {
        vals[field.name] = [
          [8.9606, 46.0211],
          [8.9610, 46.0215]
        ];
      } else if (field.name === "properties") {
        vals[field.name] = [];
      } else {
        vals[field.name] = "";
      }
    });
    return vals;
  });

  const { t } = useTranslation();

  // State for FOI modal and new FOI
  const [foiModalOpen, setFoiModalOpen] = React.useState(false);
  const [newFoi, setNewFoi] = React.useState<any>(null);
  const [newLocation, setNewLocation] = React.useState<any>(null);

  // State for FeatureOfInterest options
  const [foiOptions, setFoiOptions] = React.useState(
    fields.find(f => f.name === "FeatureOfInterest")?.options || []
  );

  // Keep foiOptions in sync with fields if fields change
  React.useEffect(() => {
    setFoiOptions(fields.find(f => f.name === "FeatureOfInterest")?.options || []);
  }, [fields]);


  // When a new FOI is created, add it to the options and select it
  const handleFoiCreate = (foi: any) => {
    setNewFoi(foi);
    setFoiModalOpen(false);
    const foiId = foi["@iot.id"] || foi.id || foi.name || "";
    const foiLabel = foi.name || foi["@iot.id"] || foi.id;
    setFoiOptions(prev => {
      // Avoid duplicates
      if (prev.some(opt => opt.value === foiId)) return prev;
      return [
        ...prev,
        {
          label: foiLabel,
          value: foiId,
        }
      ];
    });
    setValues((prev) => ({
      ...prev,
      FeatureOfInterest: foiId,
    }));
  };

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  // On submit, include newFoi if present
  const handleSubmit = async () => {
    const payload = { ...values };
    if (newFoi) {
      payload.newFoi = newFoi;
      payload.FeatureOfInterest = null; // Will be set after FOI creation
    }
    await onCreate(payload);
    setNewFoi(null);
  };

  // Field rendering
  const renderField = (field: Field) => {

    //to remove
    if (field.name === "FeatureOfInterest") {
      return (
        <div className="flex flex-col gap-2 w-full">
          {!foiModalOpen && (
            <Select
              size="sm"
              radius="sm"
              value={values.FeatureOfInterest}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="flex-1"
              required={field.required}
              items={foiOptions}
            >
              {(item) => (
                <SelectItem key={item.value}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          )}
          <Button
            radius="sm"
            size="sm"
            color="primary"
            onPress={() => setFoiModalOpen(true)}
            type="button"
            disabled={foiModalOpen}
          >
            + {t("observations.create_new_feature_of_interest") || "Create new FeatureOfInterest"}
          </Button>
          {newFoi && (
            <div className="text-green-700 text-xs">
              {t("observations.new_feature_of_interest_ready") || "New FeatureOfInterest ready to be created!"}
            </div>
          )}
          {foiModalOpen && (
            <FeatureOfInterestCreator
              onCreate={handleFoiCreate}
              onCancel={() => setFoiModalOpen(false)}
            />
          )}
        </div>
      );
    }
    if (field.type === "properties") {
      const properties = Array.isArray(values.properties) ? values.properties : [];
      return (
        <div className="flex flex-col gap-2 pl-2 w-full">
          {properties.map((prop, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                size="sm"
                variant="bordered"
                label={t("general.property_key") || "Key"}
                placeholder={t("general.property_key") || "Key"}
                value={prop.key || ""}
                onChange={e => {
                  const newProps = [...properties];
                  newProps[idx] = {
                    ...newProps[idx],
                    key: e.target.value
                  };
                  setValues(v => ({ ...v, properties: newProps }));
                }}
                className="flex-1"
              />
              <Input
                size="sm"
                variant="bordered"
                label={t("general.property_value") || "Value"}
                placeholder={t("general.property_value") || "Value"}
                value={prop.value || ""}
                onChange={e => {
                  const newProps = [...properties];
                  newProps[idx] = {
                    ...newProps[idx],
                    value: e.target.value
                  };
                  setValues(v => ({ ...v, properties: newProps }));
                }}
                className="flex-1"
              />
              <Button
                radius="sm"
                size="sm"
                variant="bordered"
                color="danger"
                onPress={() => {
                  setValues(v => ({
                    ...v,
                    properties: properties.filter((_, i) => i !== idx)
                  }));
                }}
              >-</Button>
            </div>
          ))}
          <Button
            radius="sm"
            size="sm"
            color="primary"
            variant="bordered"
            onPress={() => {
              setValues(v => ({
                ...v,
                properties: [...(v.properties || []), { key: "", value: "" }]
              }));
            }}
          >{t("general.add_property") || "Add property"}</Button>
        </div>
      );
    }
    switch (field.type) {
      case "select":
        return (
          <Select
            size="sm"
            variant="bordered"
            label={field.label}
            name={field.name}
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="flex-1"
            required={field.required}
          >
            {field.options?.map((option) => (
              <SelectItem key={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        );

      case "datetime-local":
        return (
          <Input
            size="sm"
            variant="bordered"
            label={field.label}
            type="datetime-local"
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="flex-1"
          />
        );
      case "number":
        return (
          <Input
            size="sm"
            variant="bordered"
            label={field.label}
            type="number"
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="flex-1"
            required={field.required}
          />
        );
      default:
        return (
          <Input
            size="sm"
            variant="bordered"
            label={field.label}
            type="text"
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="flex-1"
            required={field.required}
          />
        );
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((field) => (
        <div key={field.name} className="flex items-center gap-2">
          {renderField(field)}
        </div>
      ))}
      {error && <div className="col-span-2" style={{ color: "red", marginBottom: 8, marginTop: 4 }}>{error}</div>}
      <div className="col-span-2 flex items-center gap-2 mt-2">
        <Button
          radius="sm"
          color="primary"
          size="sm" isLoading={isLoading} onPress={handleSubmit}>
          {t("general.create")}
        </Button>
        <Button
          radius="sm"
          variant="bordered"
          size="sm" onPress={onCancel} disabled={isLoading}>
          {t("general.cancel")}
        </Button>
      </div>
    </div>
  );
};

export default EntityCreator;