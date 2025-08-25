export function buildObservedPropertyFields(t: (k: string) => string) {
    return [
        { name: "name", label: "Name", required: true, defaultValue: "New ObservedProperty" },
        { name: "description", label: "Description", required: false, defaultValue: "Default Description" },
        { name: "definition", label: "Definition", required: false, defaultValue: "http://www.qudt.org/qudt/owl/1.0.0/quantity/Instances.html/Observed_Property" },
        {
            name: "properties",
            label: "Properties",
            type: "properties",
            required: false
        },
    ];
}