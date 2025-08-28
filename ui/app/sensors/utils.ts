export function buildSensorFields(t: (k: string) => string) {

    return [
        { name: "name", label: t("sensors.name"), required: true, defaultValue: "New Sensor" },
        { name: "description", label: t("sensors.description"), required: false, defaultValue: "Default Description" },
        { name: "encodingType", label: t("sensors.encoding_type"), required: false, defaultValue: "application/pdf" },
        { name: "metadata", label: t("sensors.metadata"), required: false, defaultValue: "Default sensor" },
    ];
}