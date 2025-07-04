import * as React from "react";
import { Button, Input } from "@heroui/react";

interface EntityCreatorProps {
  fields: Array<{
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    default?: any;
  }>;
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
  // Initialize values with initialValues or field defaults
  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const vals: Record<string, any> = {};
    fields.forEach(field => {
      if (initialValues && initialValues[field.name] !== undefined) {
        vals[field.name] = initialValues[field.name];
      } else if (field.default !== undefined) {
        vals[field.name] = field.default;
      } else {
        vals[field.name] = "";
      }
    });
    return vals;
  });

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    await onCreate(values);
  };

  return (
    <div className="mt-2 flex flex-row gap-8">
      <div className="flex-1 flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.name} className="flex items-center gap-2">
            <label className="w-40 text-sm text-gray-700">
              {field.label}
            </label>
            <Input
              size="sm"
              type={field.type || "text"}
              value={values[field.name]}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="flex-1"
              required={field.required}
            />
          </div>
        ))}
        {error && (
          <div style={{ color: "red", marginBottom: 8, marginTop: 4 }}>
            {error}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Button
            color="primary"
            size="sm"
            isLoading={isLoading}
            onPress={handleSubmit}
          >
            Create
          </Button>
          <Button
            variant="bordered"
            size="sm"
            onPress={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EntityCreator;