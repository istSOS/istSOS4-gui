export const unitOfMeasurementOptions = [
    { name: "Degree Celsius", symbol: "°C", definition: "http://qudt.org/vocab/unit/DEG_C" },
    { name: "Degree Fahrenheit", symbol: "°F", definition: "http://qudt.org/vocab/unit/DEG_F" },
    { name: "Kelvin", symbol: "K", definition: "http://qudt.org/vocab/unit/K" },
    { name: "Meter", symbol: "m", definition: "http://qudt.org/vocab/unit/M" },
    { name: "Kilogram", symbol: "kg", definition: "http://qudt.org/vocab/unit/KiloGM" },
    { name: "Second", symbol: "s", definition: "http://qudt.org/vocab/unit/SEC" },
    { name: "Hertz", symbol: "Hz", definition: "http://qudt.org/vocab/unit/HZ" },
    { name: "Pascal", symbol: "Pa", definition: "http://qudt.org/vocab/unit/PA" }
];


export const observationTypeURIs = [
    //label, value
    { label: "OM_Measurement", value: "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement" },
    { label: "OM_CategoryObservation", value: "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_CategoryObservation" },
    { label: "OM_CountObservation", value: "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_CountObservation" },
    { label: "OM_Observation", value: "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Observation" },
    { label: "OM_TruthObservation", value: "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_TruthObservation" }
];




export function buildDatastreamFields(params: {
    t: (k: string) => string;
    thingOptions: Array<any>;
    sensorOptions: Array<any>;
    observedPropertyOptions: Array<any>;
    includePhenomenonTime?: boolean;
}) {
    const {
        t,
        thingOptions,
        sensorOptions,
        observedPropertyOptions,
        includePhenomenonTime = false
    } = params;

    const base = [
        { name: "name", label: t("datastreams.name"), required: true, defaultValue: "New Datastream" },
        { name: "description", label: t("datastreams.description"), required: false, defaultValue: "Datastream Description" },
        {
            name: "unitOfMeasurement",
            label: t("datastreams.unit_of_measurement"),
            required: true,
            type: "select",
            options: unitOfMeasurementOptions
        },
        {
            name: "observationType",
            label: t("datastreams.observation_type"),
            required: true,
            type: "select",
            options: observationTypeURIs
        },
        {
            name: "properties",
            label: t("things.properties"),
            type: "properties",
            required: false
        },
        {
            name: "thingId",
            label: "Thing",
            required: false,
            type: "select",
            options: thingOptions
        },
        {
            name: "sensorId",
            label: "Sensor",
            required: false,
            type: "select",
            options: sensorOptions
        },
        {
            name: "observedPropertyId",
            label: "ObservedProperty",
            required: false,
            type: "select",
            options: observedPropertyOptions
        },
    ];

    if (includePhenomenonTime) {
        return [
            ...base,
            { name: "phenomenonTime", label: t("datastreams.phenomenon_time"), type: "datetime-local", required: false }
        ];
    }
    return base;
}