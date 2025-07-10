"use client";

import * as React from "react";
import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { useTranslation } from "react-i18next";

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
        vals[field.name] = []; // Ensure properties start as an empty array if not provided
      } else {
        vals[field.name] = ""; // Default empty value
      }
    });
    return vals;
  });

  const { t } = useTranslation();

  const handleCoordinateChange = (index: number, lngOrLat: "lng" | "lat", value: string) => {
    setValues((prev) => {
      const coords = [...(prev.coordinates || [])];
      coords[index] = [...coords[index]];
      coords[index][lngOrLat === "lng" ? 0 : 1] = value;
      return { ...prev, coordinates: coords };
    });
  };

  const addCoordinate = () => {
    setValues((prev) => ({
      ...prev,
      coordinates: [...(prev.coordinates || []), [0, 0]]
    }));
  };

  const removeCoordinate = (index: number) => {
    setValues((prev) => ({
      ...prev,
      coordinates: prev.coordinates.filter((_, i) => i !== index)
    }));
  };

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    await onCreate(values);
  };

  const renderField = (field: Field) => {
    if (field.type === "properties") {
      const properties = Array.isArray(values.properties) ? values.properties : [];
      return (
        <div className="flex flex-col gap-2 w-full">
          {properties.map((prop, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                size="sm"
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
                size="sm"
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
      case "textarea":
        return (
          <Textarea
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="flex-1"
          />
        );
      case "datetime-local":
        return (
          <Input
            type="datetime-local"
            value={values[field.name]}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="flex-1"
          />
        );
      case "number":
        return (
          <Input
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
    <div className="mt-2 flex flex-row gap-8">
      <div className="flex-1 flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.name} className="flex items-center gap-2">
            <label className="w-40 text-sm text-gray-700">
              {field.label}
            </label>
            {renderField(field)}
          </div>
        ))}
        {error && <div style={{ color: "red", marginBottom: 8, marginTop: 4 }}>{error}</div>}
        <div className="flex items-center gap-2 mt-2">
          <Button color="primary" size="sm" isLoading={isLoading} onPress={handleSubmit}>
            {t("general.create")}
          </Button>
          <Button variant="bordered" size="sm" onPress={onCancel} disabled={isLoading}>
            {t("general.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EntityCreator;
