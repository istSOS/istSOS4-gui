export const unitOfMeasurementOptions = [
    //name, symbol, definition
    { label: "Centigrade", value: "Centigrade", symbol: "°C", definition: "A unit of temperature on the Celsius scale." },
    { label: "Fahrenheit", value: "Fahrenheit", symbol: "°F", definition: "A unit of temperature on the Fahrenheit scale." },
    { label: "Kelvin", value: "Kelvin", symbol: "K", definition: "The SI base unit of thermodynamic temperature." },
    { label: "Meter", value: "Meter", symbol: "m", definition: "The base unit of length in the International System of Units (SI)." },
    { label: "Kilogram", value: "Kilogram", symbol: "kg", definition: "The base unit of mass in the International System of Units (SI)." },
    { label: "Second", value: "Second", symbol: "s", definition: "The base unit of time in the International System of Units (SI)." },
    { label: "Hertz", value: "Hertz", symbol: "Hz", definition: "The unit of frequency, equal to one cycle per second." },
    { label: "Pascal", value: "Pascal", symbol: "Pa", definition: "The SI unit of pressure, equal to one newton per square meter." },

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
    thingOptions: Array<{ label: string; value: any; disabled?: boolean }>;
    sensorOptions: Array<{ label: string; value: any; disabled?: boolean }>;
    observedPropertyOptions: Array<{ label: string; value: any; disabled?: boolean }>;
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