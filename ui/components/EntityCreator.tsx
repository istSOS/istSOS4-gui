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

import * as React from "react";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  DatePicker,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import FeatureOfInterestCreator from "../app/observations/FeatureOfInterestCreator";
import LocationCreator from "../app/locations/LocationCreator";
import { parseDateTime, getLocalTimeZone } from "@internationalized/date";
import { unitOfMeasurementOptions } from "../app/datastreams/utils";

interface FieldOption {
  label: string;
  value: string;
  symbol?: string;
  definition?: string;
}

interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: FieldOption[];
}

interface EntityCreatorProps {
  fields: Field[];
  onCreate: (entity: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  initialValues?: Record<string, any>;
}

/**
 * Helper: normalize a single value (number/string) to a Set<string> for selectedKeys.
 */
const toKeySet = (v: any) =>
  v === undefined || v === null || v === ""
    ? new Set<string>()
    : new Set<string>([String(v)]);

/**
 * Helper: extract first key from Selection object Heroui gives.
 */
const firstFromSelection = (keys: any): string => {
  if (!keys) return "";
  if (typeof keys === "string") return keys;
  if (Array.isArray(keys)) return keys[0] || "";
  const arr = Array.from(keys as Set<string>);
  return arr[0] || "";
};

export const EntityCreator: React.FC<EntityCreatorProps> = ({
  fields,
  onCreate,
  onCancel,
  isLoading,
  error,
  initialValues,
}) => {
  const { t } = useTranslation();

  // Form state initialization with fallback defaults
  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const vals: Record<string, any> = {};
    fields.forEach((field) => {
      if (initialValues && initialValues[field.name] !== undefined) {
        const iv = initialValues[field.name];
        // Normalize numbers to string for select consistency
        vals[field.name] =
            typeof iv === "number" ? String(iv) : iv;
      } else if (field.type === "coordinates") {
        vals[field.name] = [
          [8.9606, 46.0211],
          [8.961, 46.0215],
        ];
      } else if (field.name === "properties") {
        vals[field.name] = [];
      } else {
        vals[field.name] = "";
      }
    });
    return vals;
  });

  // FeatureOfInterest inline creation
  const [foiModalOpen, setFoiModalOpen] = React.useState(false);
  const [newFoi, setNewFoi] = React.useState<any>(null);
  const [foiOptions, setFoiOptions] = React.useState<FieldOption[]>(
    fields.find((f) => f.name === "FeatureOfInterest")?.options || []
  );

  React.useEffect(() => {
    setFoiOptions(
      fields.find((f) => f.name === "FeatureOfInterest")?.options || []
    );
  }, [fields]);

  const handleFoiCreate = (foi: any) => {
    setNewFoi(foi);
    setFoiModalOpen(false);
    const foiId = foi["@iot.id"] || foi.id || foi.name || "";
    const foiLabel = foi.name || foi["@iot.id"] || foi.id;
    setFoiOptions((prev) => {
      if (prev.some((opt) => opt.value === foiId)) return prev;
      return [...prev, { label: foiLabel, value: foiId }];
    });
    setValues((prev) => ({ ...prev, FeatureOfInterest: foiId }));
  };

  // Inline Sensor creation (for Datastream flow)
  const [sensorModalOpen, setSensorModalOpen] = React.useState(false);
  const [newSensor, setNewSensor] = React.useState<any>(null);
  const [sensorForm, setSensorForm] = React.useState({
    name: "",
    description: "",
    encodingType: "application/pdf",
    metadata: "",
  });

  const resetSensorForm = () =>
    setSensorForm({
      name: "",
      description: "",
      encodingType: "application/pdf",
      metadata: "",
    });

  const handleSaveNewSensor = () => {
    if (!sensorForm.name || !sensorForm.description || !sensorForm.encodingType)
      return;
    setNewSensor({ ...sensorForm });
    setSensorModalOpen(false);
    // Clear selected sensorId to avoid ambiguity
    setValues((v) => ({ ...v, sensorId: "" }));
  };

  const handleRemoveNewSensor = () => {
    setNewSensor(null);
    resetSensorForm();
  };

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  // Submit: inject inline created entities into payload
  const handleSubmit = async () => {
    const payload = { ...values };
    if (newFoi) {
      payload.newFoi = newFoi;
      payload.FeatureOfInterest = null;
    }
    if (newSensor) {
      payload.newSensor = newSensor;
      payload.sensorId = null;
    }
    // Transform unitOfMeasurement string to object
    if (
      typeof payload.unitOfMeasurement === "string" &&
      payload.unitOfMeasurement
    ) {
      const match = unitOfMeasurementOptions.find(
        (u) => u.name === payload.unitOfMeasurement
      );
      if (match) {
        payload.unitOfMeasurement = {
          name: match.name,
          symbol: match.symbol,
          definition: match.definition,
        };
      }
    }
    await onCreate(payload);
    setNewFoi(null);
    setNewSensor(null);
  };

  // Render logic per field
  const renderField = (field: Field) => {
    // FeatureOfInterest special block
    if (field.name === "FeatureOfInterest") {
      return (
        <div className="flex flex-col gap-2 w-full">
          {!foiModalOpen && (
            <Select
              size="sm"
              radius="sm"
              label={field.label}
              selectedKeys={toKeySet(values.FeatureOfInterest)}
              onSelectionChange={(keys) =>
                handleChange(field.name, firstFromSelection(keys))
              }
              className="flex-1"
              required={field.required}
            >
              {foiOptions.map((opt) => (
                <SelectItem key={opt.value}>{opt.label}</SelectItem>
              ))}
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
            + {t("observations.create_new_feature_of_interest") ||
              "Create new FeatureOfInterest"}
          </Button>
          {newFoi && (
            <div className="text-green-700 text-xs">
              {t("observations.new_feature_of_interest_ready") ||
                "New FeatureOfInterest ready to be created!"}
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

    // Sensor block (inline creation)
    if (field.name === "sensorId") {
      return (
        <div className="flex flex-col gap-2 w-full">
          {!sensorModalOpen && (
            <div className="flex gap-2 items-start">
              <Select
                size="sm"
                radius="sm"
                variant="bordered"
                label={field.label}
                selectedKeys={toKeySet(values.sensorId)}
                onSelectionChange={(keys) => {
                  const first = firstFromSelection(keys);
                  handleChange(field.name, first);
                  if (newSensor) {
                    setNewSensor(null);
                    resetSensorForm();
                  }
                }}
                className="flex-1"
                required={!newSensor && field.required}
              >
                {field.options?.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
              <Button
                radius="sm"
                color="primary"
                onPress={() => setSensorModalOpen(true)}
                type="button"
                className="shrink-0"
              >
                +
              </Button>
            </div>
          )}

          {sensorModalOpen && (
            <div className="flex flex-col gap-2 border border-gray-300 rounded-md p-2 bg-white/5">
              <div className="text-xs font-semibold opacity-80">
                Sensor Creation
              </div>
              <Input
                size="sm"
                variant="bordered"
                label="Name"
                value={sensorForm.name}
                onChange={(e) =>
                  setSensorForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <Input
                size="sm"
                variant="bordered"
                label="Description"
                value={sensorForm.description}
                onChange={(e) =>
                  setSensorForm((f) => ({ ...f, description: e.target.value }))
                }
                required
              />
              <Input
                size="sm"
                variant="bordered"
                label="Encoding Type"
                value={sensorForm.encodingType}
                onChange={(e) =>
                  setSensorForm((f) => ({
                    ...f,
                    encodingType: e.target.value,
                  }))
                }
                required
              />
              <Textarea
                size="sm"
                variant="bordered"
                label="Metadata"
                value={sensorForm.metadata}
                onChange={(e) =>
                  setSensorForm((f) => ({ ...f, metadata: e.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button
                  radius="sm"
                  size="sm"
                  color="primary"
                  variant="solid"
                  onPress={handleSaveNewSensor}
                >
                  Save
                </Button>
                <Button
                  radius="sm"
                  size="sm"
                  variant="bordered"
                  onPress={() => {
                    setSensorModalOpen(false);
                    if (!newSensor) resetSensorForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {newSensor && !sensorModalOpen && (
            <div className="flex items-center justify-between">
              <div className="text-green-700 text-xs">
                {t("datastreams.new_sensor_ready") ||
                  "New Sensor ready to be created with the Datastream!"}
              </div>
              <Button
                radius="sm"
                size="sm"
                variant="light"
                color="danger"
                onPress={handleRemoveNewSensor}
              >
                {t("general.remove") || "Remove"}
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Dynamic properties array
    if (field.type === "properties") {
      const properties = Array.isArray(values.properties)
        ? values.properties
        : [];
      return (
        <div className="flex flex-col gap-2 pl-2 w-full">
          {properties.map((prop: any, idx: number) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                size="sm"
                variant="bordered"
                label={t("general.property_key") || "Key"}
                placeholder={t("general.property_key") || "Key"}
                value={prop.key || ""}
                onChange={(e) => {
                  const newProps = [...properties];
                  newProps[idx] = { ...newProps[idx], key: e.target.value };
                  setValues((v) => ({ ...v, properties: newProps }));
                }}
                className="flex-1"
              />
              <Input
                size="sm"
                variant="bordered"
                label={t("general.property_value") || "Value"}
                placeholder={t("general.property_value") || "Value"}
                value={prop.value || ""}
                onChange={(e) => {
                  const newProps = [...properties];
                  newProps[idx] = { ...newProps[idx], value: e.target.value };
                  setValues((v) => ({ ...v, properties: newProps }));
                }}
                className="flex-1"
              />
              <Button
                radius="sm"
                size="sm"
                variant="bordered"
                color="danger"
                onPress={() =>
                  setValues((v) => ({
                    ...v,
                    properties: properties.filter((_, i) => i !== idx),
                  }))
                }
              >
                -
              </Button>
            </div>
          ))}
          <Button
            radius="sm"
            size="sm"
            color="primary"
            variant="bordered"
            onPress={() =>
              setValues((v) => ({
                ...v,
                properties: [...(v.properties || []), { key: "", value: "" }],
              }))
            }
          >
            {t("general.add_property") || "Add property"}
          </Button>
        </div>
      );
    }

    // Unit of Measurement select
    if (field.name === "unitOfMeasurement") {
      return (
        <Select
          size="sm"
            variant="bordered"
            label={field.label}
            selectedKeys={toKeySet(values.unitOfMeasurement)}
            onSelectionChange={(keys) =>
              handleChange("unitOfMeasurement", firstFromSelection(keys))
            }
            required={field.required}
        >
          {unitOfMeasurementOptions.map((u) => (
            <SelectItem key={u.name}>{u.symbol}</SelectItem>
          ))}
        </Select>
      );
    }

    // Generic select
    if (field.type === "select") {
      return (
        <Select
          size="sm"
          variant="bordered"
          label={field.label}
          selectedKeys={toKeySet(values[field.name])}
          onSelectionChange={(keys) =>
            handleChange(field.name, firstFromSelection(keys))
          }
          className="flex-1"
          required={field.required}
        >
          {field.options?.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
      );
    }

    // Date/time
    if (field.type === "datetime-local") {
      const raw: string | undefined = values[field.name];
      let dateValue: any = undefined;
      if (raw) {
        try {
          const cleaned = raw.replace(/Z$/, "");
          dateValue = parseDateTime(cleaned);
        } catch {
          dateValue = undefined;
        }
      }
      return (
        <DatePicker
          size="sm"
          variant="bordered"
          label={field.label}
          granularity="minute"
          value={dateValue}
          onChange={(val) => {
            if (!val) {
              handleChange(field.name, "");
              return;
            }
            const jsDate = val.toDate(getLocalTimeZone());
            handleChange(field.name, jsDate.toISOString());
          }}
          className="flex-1"
        />
      );
    }

    // Number
    if (field.type === "number") {
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
    }

    // Default text
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
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((field) => (
        <div key={field.name} className="flex items-center gap-2">
          {renderField(field)}
        </div>
      ))}
      {error && (
        <div
          className="col-span-2"
          style={{ color: "red", marginBottom: 8, marginTop: 4 }}
        >
          {error}
        </div>
      )}
      <div className="col-span-2 flex items-center gap-2 mt-2">
        <Button
          radius="sm"
          color="primary"
          size="sm"
          isLoading={isLoading}
          onPress={handleSubmit}
        >
          {t("general.create")}
        </Button>
        <Button
          radius="sm"
          variant="bordered"
          size="sm"
          onPress={onCancel}
          disabled={isLoading}
        >
          {t("general.cancel")}
        </Button>
      </div>
    </div>
  );
};

export default EntityCreator;