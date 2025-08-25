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

interface ThingValues {
  name: string;
  description: string;
  properties: Array<{ key: string; value: string }>;
  Locations: string[];
  [k: string]: any;
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

  const [values, setValues] = React.useState<ThingValues>(() => {
    const init: ThingValues = {
      name: "",
      description: "",
      properties: [],
      Locations: []
    };
    fields.forEach(f => {
      if (f.name === "properties" || f.name === "Location") return;
      if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
      else if (init[f.name] === undefined) init[f.name] = "";
    });
    return init;
  });

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  //new locations being created alongside the Thing
  const [newLocations, setNewLocations] = React.useState<any[]>([]);
  const [addingNewLocation, setAddingNewLocation] = React.useState(false);

  // Helpers for properties and locations
  const addProperty = () =>
    setValues(v => ({
      ...v,
      properties: [...v.properties, { key: "", value: "" }]
    }));

  const updateProperty = (idx: number, field: "key" | "value", val: string) =>
    setValues(v => {
      const arr = [...v.properties];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...v, properties: arr };
    });

  const removeProperty = (idx: number) =>
    setValues(v => ({
      ...v,
      properties: v.properties.filter((_, i) => i !== idx)
    }));

  const handleChange = (name: string, value: any) =>
    setValues(prev => ({ ...prev, [name]: value }));

  const validate = () => {
    for (const f of fields) {
      if (f.required) {
        if (f.name === "Location") {
          continue;
        }
        const val = (values as any)[f.name];
        if (
          val === "" ||
          val === null ||
          val === undefined ||
          (Array.isArray(val) && val.length === 0)
        ) return false;
      }
    }
    const locationField = fields.find(f => f.name === "Location");
    if (locationField?.required) {
      if ((values.Locations?.length || 0) === 0 && newLocations.length === 0) {
        return false;
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
      properties: Object.fromEntries(
        values.properties.filter(p => p.key).map(p => [p.key, p.value])
      )
    };

    if (values.Locations.length > 0) {
      payload.Locations = values.Locations;
    }
    if (newLocations.length > 0) {
      payload.newLocations = newLocations;
    }

    await onCreate(payload);
  };

  const renderPropertiesEditor = () => (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Properties</span>
        <Button
          size="sm"
            variant="bordered"
          onPress={addProperty}
          disabled={isLoading}
        >
          + Add
        </Button>
      </div>
      {values.properties.length === 0 && (
        <div className="text-xs text-default-500">No properties.</div>
      )}
      <div className="flex flex-col gap-2">
        {values.properties.map((p, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-2 items-center">
            <Input
              size="sm"
              variant="bordered"
              label="Key"
              value={p.key}
              onChange={e => updateProperty(idx, "key", e.target.value)}
              className="col-span-2"
            />
            <Input
              size="sm"
              variant="bordered"
              label="Value"
              value={p.value}
              onChange={e => updateProperty(idx, "value", e.target.value)}
              className="col-span-2"
            />
            <Button
              size="md"
              color="danger"
              variant="bordered"
              onPress={() => removeProperty(idx)}
              className="w-4"
            >
              -
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLocationField = () => {
    const locationField = fields.find(f => f.name === "Location");
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="text-sm font-medium">Locations</div>
        <Select
          selectionMode="multiple"
          size="sm"
          variant="bordered"
          label="Select Existing Locations"
          selectedKeys={new Set(values.Locations)}
          onSelectionChange={keys => {
            const arr = Array.from(keys).map(k => String(k));
            setValues(v => ({ ...v, Locations: arr }));
          }}
          isDisabled={isLoading}
          isRequired={!!locationField?.required}
        >
          {(locationOptions || []).map((opt: any) => (
            <SelectItem key={opt.value}>{opt.label}</SelectItem>
          ))}
        </Select>

        <div className="flex flex-col gap-2 border border-default-200 rounded-md p-3 bg-content2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">New Locations</span>
            {!addingNewLocation && (
              <Button
                size="sm"
                variant="bordered"
                onPress={() => setAddingNewLocation(true)}
                disabled={isLoading}
              >
                + Add New Location
              </Button>
            )}
          </div>

          {addingNewLocation && (
            <LocationCreator
              onCreate={loc => {
                setNewLocations(prev => [...prev, loc]);
                setAddingNewLocation(false);
              }}
              onCancel={() => {
                setAddingNewLocation(false);
              }}
              isLoading={false}
              error={null}
            />
          )}

          {newLocations.length === 0 && !addingNewLocation && (
            <div className="text-xs text-default-500">
              No new locations added.
            </div>
          )}

          {newLocations.length > 0 && (
            <div className="flex flex-col gap-2">
              {newLocations.map((loc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border border-success-200 rounded-md px-2 py-1 bg-success-50 text-xs"
                >
                  <span className="truncate">
                    {loc.name || `New Location ${idx + 1}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => {
                        alert(JSON.stringify(loc, null, 2));
                      }}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() =>
                        setNewLocations(list => list.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] opacity-60">
          You can mix existing and newly created Locations.
          {locationField?.required
            ? " At least one is required."
            : " (Optional)."}
        </div>
      </div>
    );
  };

  const renderBasicField = (field: any) => {
    if (field.name === "properties") return renderPropertiesEditor();
    if (field.name === "Location") return renderLocationField();

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
        label={field.label || field.name}
        value={values[field.name] ?? ""}
        onChange={e => handleChange(field.name, e.target.value)}
        isRequired={field.required}
        validationState={invalid ? "invalid" : "valid"}
        errorMessage={invalid ? "Required field" : undefined}
      />
    );
  };

  const propertyField = fields.find(f => f.name === "properties");
  const locationField = fields.find(f => f.name === "Location");
  const otherFields = fields.filter(
    f => f.name !== "properties" && f.name !== "Location"
  );

  return (
    <div className="flex flex-col gap-4 border border-default-200 rounded-md p-4 bg-content1 bg-gray-100">
      <div className="text-sm font-medium">Create Thing</div>

      <div className="grid grid-cols-2 gap-4">
        {otherFields.map(f => (
          <div key={f.name}>{renderBasicField(f)}</div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 items-start">
        {propertyField && <div>{renderBasicField(propertyField)}</div>}
        {locationField && <div>{renderBasicField(locationField)}</div>}
      </div>

      {error && <div className="text-danger text-xs">{error}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          color="primary"
          isLoading={isLoading}
          onPress={handleSubmit}
          isDisabled={isLoading || !validate()}
        >
          Save Thing
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