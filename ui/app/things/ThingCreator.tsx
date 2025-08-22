"use client";

import * as React from "react";
import {
  Button,
  Input,
  Select,
  SelectItem
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import LocationCreator from "../locations/LocationCreator";
import { buildThingFields } from "./utils";

interface ThingCreatorProps {
  onCreate: (thing: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  locationOptions: Array<any>;
}

const ThingCreator: React.FC<ThingCreatorProps> = ({
  onCreate,
  onCancel,
  isLoading,
  error,
  locationOptions
}) => {
  const { t } = useTranslation();

  const fields = React.useMemo(
    () => buildThingFields({ t, locationOptions }),
    [t, locationOptions]
  );

  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    fields.forEach(f => {
      if (f.name === "properties") v[f.name] = [];
      else v[f.name] = f.defaultValue !== undefined ? f.defaultValue : "";
    });
    return v;
  });

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [showLocationCreator, setShowLocationCreator] = React.useState(false);
  const [pendingLocation, setPendingLocation] = React.useState<any>(null);

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    for (const f of fields) {
      if (f.required) {
        const val = values[f.name];
        if (
          val === "" ||
          val === null ||
          val === undefined ||
          (Array.isArray(val) && val.length === 0)
        ) return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    setTouched(fields.reduce((acc, f) => ({ ...acc, [f.name]: true }), {}));
    if (!validate()) return;

    const payload: Record<string, any> = {
      name: values.name,
      description: values.description,
      properties: {}
    };

    if (Array.isArray(values.properties) && values.properties.length > 0) {
      payload.properties = Object.fromEntries(
        values.properties
          .filter((p: any) => p.key)
          .map((p: any) => [p.key, p.value])
      );
    }

    if (values.Location && !pendingLocation) {
      payload.Location = values.Location;
    }

    if (pendingLocation) {
      payload.newLocation = pendingLocation;
      payload.Location = null;
    }

    await onCreate(payload);
  };

  const renderField = (field: any) => {
    if (field.name === "Location") {
      return (
        <div className="flex flex-col gap-2">
          {!showLocationCreator && (
            <>
              <Select
                size="sm"
                variant="bordered"
                label={field.label}
                value={values.Location}
                onChange={e => {
                  handleChange(field.name, e.target.value);
                  if (pendingLocation) setPendingLocation(null);
                }}
                isRequired={field.required && !pendingLocation}
                selectedKeys={values.Location ? [String(values.Location)] : []}
                isDisabled={!!pendingLocation}
              >
                {(field.options || []).map((opt: any) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  color="primary"
                  variant="solid"
                  onPress={() => {
                    setShowLocationCreator(true);
                    handleChange("Location", "");
                  }}
                  isDisabled={isLoading}
                >
                  + New Location
                </Button>
                {pendingLocation && (
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => setPendingLocation(null)}
                  >
                    Remove Pending
                  </Button>
                )}
              </div>
              {pendingLocation && (
                <div className="text-xs text-green-600">
                  New Location will be created with this Thing.
                </div>
              )}
            </>
          )}
          {showLocationCreator && (
            <div className="border border-default-200 rounded-md p-3 bg-content2 flex flex-col gap-3">
              <div className="text-xs font-semibold opacity-70">
                Inline Location Creation
              </div>
              <LocationCreator
                onCreate={loc => {
                  setPendingLocation(loc);
                  setShowLocationCreator(false);
                }}
                onCancel={() => {
                  setShowLocationCreator(false);
                  if (!pendingLocation) handleChange("Location", "");
                }}
                isLoading={false}
                error={null}
              />
            </div>
          )}
        </div>
      );
    }

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
                label="Key"
                placeholder="Key"
                value={prop.key || ""}
                onChange={e => {
                  const newProps = [...properties];
                  newProps[idx] = { ...newProps[idx], key: e.target.value };
                  setValues(v => ({ ...v, properties: newProps }));
                }}
                className="flex-1"
              />
              <Input
                size="sm"
                variant="bordered"
                label="Value"
                placeholder="Value"
                value={prop.value || ""}
                onChange={e => {
                  const newProps = [...properties];
                  newProps[idx] = { ...newProps[idx], value: e.target.value };
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
            onPress={() => {
              setValues(v => ({
                ...v,
                properties: [...(v.properties || []), { key: "", value: "" }]
              }));
            }}
          >
            Add property
          </Button>
        </div>
      );
    }

    const invalid =
      field.required &&
      touched[field.name] &&
      (values[field.name] === "" ||
        values[field.name] === null ||
        values[field.name] === undefined);

    return (
      <Input
        size="sm"
        variant="bordered"
        label={field.label}
        value={values[field.name]}
        onChange={e => handleChange(field.name, e.target.value)}
        isRequired={field.required}
        validationState={invalid ? "invalid" : "valid"}
        errorMessage={invalid ? "Required field" : undefined}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4 border border-default-200 rounded-md p-4 bg-content1 bg-gray-100">
      <div className="text-sm font-medium">Create Thing</div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div
            key={f.name}
            className={f.name === "properties" ? "col-span-2" : ""}
          >
            {renderField(f)}
          </div>
        ))}
      </div>
      {error && <div className="text-danger text-xs">{error}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          color="primary"
          isLoading={isLoading}
          onPress={handleSubmit}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="bordered"
          onPress={onCancel}
          isDisabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ThingCreator;