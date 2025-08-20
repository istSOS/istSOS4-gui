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
            label: t("things.properties"),
            type: "properties",
            required: false
        },
        {
            name: "locationId",
            label: t("things.location"),
            required: false,
            type: "select",
            options: locationOptions
        }
    ];
}