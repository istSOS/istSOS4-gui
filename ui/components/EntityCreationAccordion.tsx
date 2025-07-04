import { AccordionItem, Button, Input } from "@heroui/react";

// Generic creation accordion component
function EntityCreationAccordion({
  fields,
  values,
  setValues,
  error,
  loading,
  onCreate,
  onCancel,
  title = "New Entity",
}: {
  fields: {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
  }[];
  values: Record<string, any>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  error?: string | null;
  loading?: boolean;
  onCreate: () => void;
  onCancel: () => void;
  title?: string;
}) {
  return (
    <AccordionItem
      key="new-entity"
      id="entity-accordion-item-new-entity"
      title={
        <div className="flex items-baseline gap-3">
          <span className="font-bold text-lg text-gray-800">{title}</span>
        </div>
      }
      value="new-entity"
    >
      <div className="mt-2 flex flex-row gap-8">
        {/* LEFT col with self attributes */}
        <div className="flex-1 flex flex-col gap-2">
          {fields.map((field) => (
            <div className="flex items-center gap-2" key={field.name}>
              <label className="w-40 text-sm text-gray-700">{field.label}</label>
              <Input
                size="sm"
                type={field.type || "text"}
                value={values[field.name]}
                onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                className="flex-1"
                required={field.required}
                placeholder={field.placeholder}
              />
            </div>
          ))}
          {error && (
            <div style={{ color: "red", marginBottom: 8, marginTop: 4 }}>{error}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Button
              color="primary"
              size="sm"
              isLoading={loading}
              onPress={onCreate}
            >
              Create
            </Button>
            <Button
              variant="bordered"
              size="sm"
              onPress={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
        {/* vertical divider */}
        <div className="w-px bg-gray-300 mx-4" />
        {/* RIGHT col with linked attributes (empty for creation) */}
        <div className="flex-1 flex flex-col gap-2"></div>
      </div>
    </AccordionItem>
  );
} 
export default EntityCreationAccordion;