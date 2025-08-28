export function buildThingFields(params: {
    t: (k: string) => string;
    locationOptions: Array<{ label: string; value: any; disabled?: boolean }>;
}) {
    const { t, locationOptions } = params;

    return [
        { name: "name", label: t("things.name"), required: true, defaultValue: "New Thing" },
        { name: "description", label: t("things.description"), required: false, defaultValue: "Thing Description" },
        {
            name: "properties",
            label: "Properties",
            type: "properties",
            required: false
        },
        {
            name: "Location",
            label: "Location",
            required: false,
            type: "select",
            options: locationOptions
        }
    ];
}