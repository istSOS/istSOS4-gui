"use client";
import * as React from "react";
import {
    Input,
    Textarea,
    Button,
    Select,
    SelectItem,
    Switch,
    Divider
} from "@heroui/react";
import { buildDatastreamFields } from "./utils";
import { useTranslation } from "react-i18next";
import ThingCreator from "../things/ThingCreator";
import SensorCreator from "../sensors/SensorCreator";
import { useSearchParams } from "next/navigation";

interface Option {
    name?: string
    label?: string;
    value?: any;
    symbol?: string;
    definition?: string;
}

interface DatastreamCreatorProps {
    observationTypeOptions: Option[];
    unitOfMeasurementOptions: Option[];
    thingOptions: Option[];
    sensorOptions: Option[];
    observedPropertyOptions: Option[];
    locationOptions: Option[];
    onCreate: (payload: any) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
    error: string | null;
}

const DatastreamCreator: React.FC<DatastreamCreatorProps> = ({
    observationTypeOptions,
    unitOfMeasurementOptions,
    thingOptions,
    sensorOptions,
    observedPropertyOptions,
    locationOptions,
    onCreate,
    onCancel,
    isLoading,
    error
}) => {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const selectedNetwork = searchParams.get("network");

    // Build field configs
    const datastreamFields = React.useMemo(
        () =>
            buildDatastreamFields({
                t,
                thingOptions,
                sensorOptions,
                observedPropertyOptions
            }),
        [t, thingOptions, sensorOptions, observedPropertyOptions]
    );


    const labelFor = (name: string) =>
        datastreamFields.find(f => f.name === name)?.label || name;

    const getFirstKey = (keys: any) => {
        if (!keys) return "";
        if (typeof keys === "string") return keys;
        return Array.from(keys)[0] || "";
    };

    const [ds, setDs] = React.useState(() => {
        const init: any = {
            name: "",
            description: "",
            observationType: "",
            unitOfMeasurement: "",
            properties: [] as Array<{ key: string; value: string }>
        };
        datastreamFields.forEach(f => {
            if (
                ["name", "description", "observationType", "unitOfMeasurement"].includes(
                    f.name
                )
            ) {
                if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
            }
        });
        return init;
    });

    // State for Thing
    const [useExistingThing, setUseExistingThing] = React.useState(true);
    const [thingId, setThingId] = React.useState("");
    const [newThing, setNewThing] = React.useState<any | null>(null);

    // State for Sensor
    const [useExistingSensor, setUseExistingSensor] = React.useState(true);
    const [sensorId, setSensorId] = React.useState("");
    const [newSensor, setNewSensor] = React.useState<any | null>(null);

    // State for ObservedProperty
    const [useExistingObservedProperty, setUseExistingObservedProperty] =
        React.useState(true);
    const [observedPropertyId, setObservedPropertyId] = React.useState("");
    const [newObservedProperty, setNewObservedProperty] = React.useState({
        name: "",
        definition: "",
        description: ""
    });

    // Local errors
    const [localError, setLocalError] = React.useState<string | null>(null);

    // JSON Editor State
    const [showJsonEditor, setShowJsonEditor] = React.useState(false);
    const [jsonContent, setJsonContent] = React.useState<string>("");

    const updateDs = (k: string, v: any) => setDs(p => ({ ...p, [k]: v }));

    const addDsProperty = () =>
        updateDs("properties", [...ds.properties, { key: "", value: "" }]);

    const removeDsProperty = (i: number) =>
        updateDs(
            "properties",
            ds.properties.filter((_, idx) => idx !== i)
        );

    const buildPropertiesObject = (arr: Array<{ key: string; value: string }>) =>
        Object.fromEntries(arr.filter(p => p.key).map(p => [p.key, p.value]));

    const validate = () => {
        if (!ds.name || !ds.observationType || !ds.unitOfMeasurement) return false;
        if (useExistingThing && !thingId) return false;
        if (!useExistingThing && !newThing) return false;
        if (useExistingSensor && !sensorId) return false;
        if (!useExistingSensor && !newSensor) return false;
        if (useExistingObservedProperty && !observedPropertyId) return false;
        if (
            !useExistingObservedProperty &&
            (!newObservedProperty.name || !newObservedProperty.definition)
        )
            return false;
        return true;
    };

    const handleSubmit = async () => {
        setLocalError(null);
        if (!validate()) return;
        const uomOpt = unitOfMeasurementOptions.find(
            o => o.name === ds.unitOfMeasurement
        );
        if (!uomOpt) {
            setLocalError("Invalid Unit of Measurement");
            return;
        }
        const payload = {
            unitOfMeasurement: {
                name: uomOpt.name,
                symbol: uomOpt.symbol,
                definition: uomOpt.definition
            },
            description: ds.description,
            name: ds.name,
            observationType: ds.observationType,
            ObservedProperty: useExistingObservedProperty
                ? { "@iot.id": Number(observedPropertyId) }
                : {
                    name: newObservedProperty.name,
                    definition: newObservedProperty.definition,
                    description: newObservedProperty.description
                },
            Sensor: useExistingSensor
                ? { "@iot.id": Number(sensorId) }
                : {
                    name: newSensor.name,
                    description: newSensor.description,
                    encodingType: newSensor.encodingType,
                    metadata: newSensor.metadata
                },
            Thing: useExistingThing
                ? { "@iot.id": Number(thingId) }
                : {
                    name: newThing.name,
                    description: newThing.description,
                    properties: newThing.properties || {},
                    Locations: newThing.newLocation
                        ? [
                            {
                                name: newThing.newLocation.name,
                                description: newThing.newLocation.description,
                                encodingType: newThing.newLocation.encodingType || "application/vnd.geo+json",
                                location: newThing.newLocation.location
                            }
                        ]
                        : newThing.Location
                            ? [{ "@iot.id": Number(newThing.Location) }]
                            : []
                },
            network: selectedNetwork || "acsot",
        };

        await onCreate(payload);
    };

    const renderPropertiesEditor = (
        list: Array<{ key: string; value: string }>,
        onChange: (idx: number, field: "key" | "value", v: string) => void,
        onAdd: () => void,
        onRemove: (idx: number) => void,
        title: string
    ) => (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{title}</span>
                <Button
                    size="sm"
                    variant="bordered"
                    onPress={onAdd}
                    disabled={isLoading}
                >
                    + Add
                </Button>
            </div>
            {list.length === 0 && (
                <div className="text-xs text-default-500">No properties.</div>
            )}
            <div className="flex flex-col gap-2">
                {list.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2">
                        <Input
                            size="sm"
                            variant="bordered"
                            label="Key"
                            value={p.key}
                            onChange={e => onChange(idx, "key", e.target.value)}
                            className="col-span-2"
                        />
                        <Input
                            size="sm"
                            variant="bordered"
                            label="Value"
                            value={p.value}
                            onChange={e => onChange(idx, "value", e.target.value)}
                            className="col-span-2"
                        />
                        <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            onPress={() => onRemove(idx)}
                        >
                            -
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );


    const renderJsonEditor = () => {
        
        const entityJson = {
            unitOfMeasurement: unitOfMeasurementOptions.find(
                o => o.name === ds.unitOfMeasurement
            ) || { name: "", symbol: "", definition: "" },
            description: ds.description,
            name: ds.name,
            observationType: ds.observationType,
            ObservedProperty: useExistingObservedProperty
                ? { "@iot.id": Number(observedPropertyId) }
                : {
                    name: newObservedProperty.name,
                    definition: newObservedProperty.definition,
                    description: newObservedProperty.description
                },
            Sensor: useExistingSensor
                ? { "@iot.id": Number(sensorId) }
                : {
                    name: newSensor?.name || "",
                    description: newSensor?.description || "",
                    encodingType: newSensor?.encodingType || "",
                    metadata: newSensor?.metadata || ""
                },
            Thing: useExistingThing
                ? { "@iot.id": Number(thingId) }
                : {
                    name: newThing?.name || "",
                    description: newThing?.description || "",
                    properties: newThing?.properties || {},
                    Locations: newThing?.newLocation
                        ? [
                            {
                                name: newThing.newLocation.name,
                                description: newThing.newLocation.description,
                                encodingType: newThing.newLocation.encodingType || "application/vnd.geo+json",
                                location: newThing.newLocation.location
                            }
                        ]
                        : newThing?.Location
                            ? [{ "@iot.id": Number(newThing.Location) }]
                            : []
                }
        };

        setJsonContent(JSON.stringify(entityJson, null, 2));
        setShowJsonEditor(true);
    };

    const renderEntityBlock = (
        title: string,
        useExisting: boolean,
        setUseExisting: (value: boolean) => void,
        existingOptions: Option[],
        existingId: string,
        setExistingId: (value: string) => void,
        newEntity: any,
        setNewEntity: (value: any) => void,
        creatorComponent: React.ReactNode,
        //renderNewEntity: (entity: any) => React.ReactNode
    ) => (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{title}</span>
                
                <Switch
                    size="sm"
                    isSelected={!useExisting}
                    onValueChange={v => {
                        setUseExisting(!v);
                        if (v) {
                            setExistingId("");
                            setNewEntity(null);
                        }
                    }}
                >
                    {useExisting ? "Existing" : "New"}
                </Switch>
            </div>
            {useExisting ? (
                <Select
                    size="sm"
                    variant="bordered"
                    label={`Select ${title}`}
                    selectedKeys={existingId ? new Set([existingId]) : new Set()}
                    onSelectionChange={keys => setExistingId(getFirstKey(keys) as string)}
                    isRequired
                >
                    {existingOptions.map(o => (
                        <SelectItem key={o.value}>{o.label}</SelectItem>
                    ))}
                </Select>
            ) : (
                <div className="flex flex-col gap-3">
                    {!newEntity && creatorComponent}
                    {newEntity && (
                        <div className="border border-success-300 rounded-md p-3 bg-success-50 text-sm">
                            New {title} saved
                            
                        </div>
                    )}
                </div>
            )}
        </div>
    );


    return (
        <div className="flex flex-col gap-6 border border-default-200 rounded-md p-5 bg-content1 bg-gray-100">
            <div className="text-sm font-semibold">Create Datastream</div>
            <div className="grid grid-cols-2 gap-4">
                <Input
                    size="sm"
                    variant="bordered"
                    label={labelFor("name")}
                    value={ds.name}
                    onChange={e => updateDs("name", e.target.value)}
                    isRequired
                />
                <Input
                    size="sm"
                    variant="bordered"
                    label={labelFor("description")}
                    value={ds.description}
                    onChange={e => updateDs("description", e.target.value)}
                />
                <Select
                    size="sm"
                    variant="bordered"
                    label={labelFor("observationType")}
                    selectedKeys={
                        ds.observationType ? new Set([ds.observationType]) : new Set()
                    }
                    onSelectionChange={keys =>
                        updateDs("observationType", getFirstKey(keys))
                    }
                    isRequired
                >
                    {observationTypeOptions.map(o => (
                        <SelectItem key={o.value}>{o.label}</SelectItem>
                    ))}
                </Select>

                <Select
                    size="sm"
                    variant="bordered"
                    label={labelFor("unitOfMeasurement")}
                    selectedKeys={
                        ds.unitOfMeasurement ? new Set([ds.unitOfMeasurement]) : new Set()
                    }
                    onSelectionChange={keys =>
                        updateDs("unitOfMeasurement", getFirstKey(keys))
                    }
                    isRequired
                >
                    {unitOfMeasurementOptions.map(o => (
                        <SelectItem key={o.name}>{o.symbol}</SelectItem>
                    ))}
                </Select>
                <div className="col-span-2">
                    {renderPropertiesEditor(
                        ds.properties,
                        (idx, f, val) => {
                            const arr = [...ds.properties];
                            arr[idx] = { ...arr[idx], [f]: val };
                            updateDs("properties", arr);
                        },
                        addDsProperty,
                        removeDsProperty,
                        labelFor("properties")
                    )}
                </div>
            </div>
            <Divider />
            {renderEntityBlock(
                "Thing",
                useExistingThing,
                setUseExistingThing,
                thingOptions,
                thingId,
                setThingId,
                newThing,
                setNewThing,
                <ThingCreator
                    onCreate={async payload => {
                        setNewThing(payload);
                    }}
                    onCancel={() => {
                        setUseExistingThing(true);
                        setNewThing(null);
                    }}
                    isLoading={false}
                    error={null}
                    locationOptions={locationOptions}
                />,
            )}
            <Divider />
            {renderEntityBlock(
                "Sensor",
                useExistingSensor,
                setUseExistingSensor,
                sensorOptions,
                sensorId,
                setSensorId,
                newSensor,
                setNewSensor,
                <SensorCreator
                    onCreate={async payload => {
                        setNewSensor(payload);
                    }}
                    onCancel={() => {
                        setUseExistingSensor(true);
                        setNewSensor(null);
                    }}
                    isLoading={false}
                    error={null}
                />,
            )}
            <Divider />
            {renderEntityBlock(
                "Observed Property",
                useExistingObservedProperty,
                setUseExistingObservedProperty,
                observedPropertyOptions,
                observedPropertyId,
                setObservedPropertyId,
                newObservedProperty,
                setNewObservedProperty,
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        size="sm"
                        variant="bordered"
                        label="Name"
                        value={newObservedProperty.name}
                        onChange={e =>
                            setNewObservedProperty(p => ({ ...p, name: e.target.value }))
                        }
                        isRequired
                    />
                    <Input
                        size="sm"
                        variant="bordered"
                        label="Definition (URI)"
                        value={newObservedProperty.definition}
                        onChange={e =>
                            setNewObservedProperty(p => ({
                                ...p,
                                definition: e.target.value
                            }))
                        }
                        isRequired
                    />
                    <Textarea
                        size="sm"
                        variant="bordered"
                        label="Description"
                        className="col-span-2"
                        value={newObservedProperty.description}
                        onChange={e =>
                            setNewObservedProperty(p => ({
                                ...p,
                                description: e.target.value
                            }))
                        }
                    />
                </div>,
            )}
            <Divider />

            {showJsonEditor && (
                <div className="flex flex-col gap-2">
                    <Textarea
                        classNames={{
                            
                            input: "resize-y min-h-[40px]",
                        }}
                        variant="bordered"
                        label="JSON Editor"
                        value={jsonContent}
                        onChange={e => setJsonContent(e.target.value)}
                        className="col-span-2"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="bordered"
                            onPress={() => {
                                try {
                                    const parsedJson = JSON.parse(jsonContent);
                                    // Update states with parsed JSON data
                                    setDs(p => ({ ...p, description: parsedJson.description, name: parsedJson.name }));
                                    // Update other states accordingly
                                    setShowJsonEditor(false);
                                } catch (e) {
                                    setLocalError("Invalid JSON");
                                }
                            }}
                        >
                            Save
                        </Button>
                        <Button
                            size="sm"
                            variant="bordered"
                            color="danger"
                            onPress={() => setShowJsonEditor(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
            {(error || localError) && (
                <div className="text-xs text-danger">{localError || error}</div>
            )}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    color="primary"
                    onPress={handleSubmit}
                    isLoading={isLoading}
                    isDisabled={isLoading || !validate()}
                >
                    Create
                </Button>

                <Button
                    size="sm"
                    variant="bordered"
                    onPress={renderJsonEditor}
                >
                    JSON Preview
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
            <div className="text-[10px] opacity-60">
                Entities created in New mode will be deep inserted; otherwise references
                by @iot.id will be used.
            </div>
        </div>
    );
};

export default DatastreamCreator;