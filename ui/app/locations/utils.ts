export function buildLocationFields(t: (k: string) => string) {
    return [
        { name: "name", label: t("locations.name"), required: true, defaultValue: "New Location" },
        { name: "description", label: t("locations.description"), required: false, defaultValue: "Location Description" },
        { name: "latitude", label: t("locations.latitude"), type: "number", required: true },
        { name: "longitude", label: t("locations.longitude"), type: "number", required: true },
        { name: "encodingType", label: t("locations.encoding_type"), required: true, defaultValue: "application/vnd.geo+json" },
    ];
}