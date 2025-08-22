"use client";

import * as React from "react";
import { Input, Textarea, Button } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { buildSensorFields } from "./utils";

interface SensorField {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: any;
}

interface SensorCreatorProps {
  onCreate: (sensor: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

const SensorCreator: React.FC<SensorCreatorProps> = ({
  onCreate,
  onCancel,
  isLoading,
  error
}) => {
  const { t } = useTranslation();

  const fields: SensorField[] = React.useMemo(() => buildSensorFields(t), [t]);

  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    fields.forEach(f => {
      v[f.name] = f.defaultValue !== undefined ? f.defaultValue : "";
    });
    return v;
  });

  // Se cambiano i campi (es. cambio lingua) riallineo i valori mancanti
  React.useEffect(() => {
    setValues(prev => {
      const next: Record<string, any> = { ...prev };
      fields.forEach(f => {
        if (!(f.name in next)) {
          next[f.name] = f.defaultValue !== undefined ? f.defaultValue : "";
        }
      });
      return next;
    });
  }, [fields]);

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    for (const f of fields) {
      if (
        f.required &&
        (values[f.name] === "" ||
          values[f.name] === undefined ||
            values[f.name] === null)
      ) {
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    setTouched(fields.reduce((acc, f) => ({ ...acc, [f.name]: true }), {}));
    if (!validate()) return;
    await onCreate(values);
  };

  const renderField = (field: SensorField) => {
    const invalid =
      field.required && touched[field.name] && !values[field.name];

    if (field.name === "metadata") {
      return (
        <Textarea
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
    }

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
    <div className="flex flex-col gap-3 border border-default-200 rounded-md p-4 bg-content1 bg-gray-100">
      <div className="text-sm font-medium">Create Sensor</div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.name} className={f.name === "metadata" ? "col-span-2" : ""}>
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
          Create
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

export default SensorCreator;