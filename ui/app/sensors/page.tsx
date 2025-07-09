"use client";


import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Divider, Input } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import EntityCreator from "../../components/EntityCreator";
import updateData from "../../server/updateData";
import { useEntities } from "../../context/EntitiesContext";
import { useTranslation } from "react-i18next";

//define color from site condiguration
export const mainColor = siteConfig.main_color;

//retrive specific items from site configuration (this and linked items)
const item = siteConfig.items.find(i => i.label === "Sensors");


export default function Sensors() {

  //initialize translation hook
  const { t } = useTranslation();
  //retrieve entities from context and refetch on mount
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  React.useEffect(() => {
    refetchAll();
  }, []);


  //define the fields for sensor creation
  const sensorFields = [
    { name: "name", label: t("sensors.name"), required: true },
    { name: "description", label: t("sensors.description"), required: false },
    { name: "encodingType", label: t("sensors.encoding_type"), required: true },
    { name: "metadata", label: t("sensors.metadata"), required: false },
    {
      name: "properties",
      label: t("sensors.properties"),
      type: "properties",
      required: false
    },
  ];

  //labels for columns in the sensors table
  const getLabel = (key: string) => {
    //map keys to translated labels
    const map: Record<string, string> = {
      name: t("sensors.name"),
      description: t("sensors.description"),
      encodingType: t("sensors.encoding_type"),
      metadata: t("sensors.metadata"),
      properties: t("sensors.properties"),

    };
    return map[key] || key;
  };




  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sensors, setSensors] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  //state for creating sensors
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);

  //state for editing sensors
  const [editSensor, setEditSensor] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);

  //state for expanded accordion items
  const [expanded, setExpanded] = React.useState(null);

  //update sensors state when entities change
  React.useEffect(() => {
    setSensors(entities.sensors);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  //filter sensors based on search input
  const filtered = sensors.filter(sensor =>
    JSON.stringify(sensor).toLowerCase().includes(search.toLowerCase())
  );

  // --- CREATION ---
  const handleCreate = async (newSensor) => {
    setCreateLoading(true);
    setCreateError(null);
    try {

      const payload: {
        name: any;
        description: any;
        encodingType: any;
        metadata: any;
        properties?: any;
      } = {
        name: newSensor.name,
        description: newSensor.description || "",
        encodingType: newSensor.encodingType || "application/pdf",
        metadata: newSensor.metadata || "",
      };

      if (Array.isArray(newSensor.properties) && newSensor.properties.length > 0) {
        payload.properties = Object.fromEntries(
          newSensor.properties
            .filter(p => p.key)
            .map(p => [p.key, p.value])
        );
      } else {
        payload.properties = {};
      }


      //create the sensor using the server function
      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);

      //refetch sensors after creation
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
    } catch (err) {
      setCreateError(err.message || "Error creating sensor");
    } finally {
      setCreateLoading(false);
    }
  };


  //  --- EDITING ---
  const handleEdit = async (updatedSensor) => {
    setEditLoading(true);
    setEditError(null);
    try {

      const payload = {
        name: updatedSensor.name,
        description: updatedSensor.description || "",
        encodingType: updatedSensor.encodingType || "application/pdf",
        metadata: updatedSensor.metadata || "",
        properties: {},
      };


      if (Array.isArray(updatedSensor.properties) && updatedSensor.properties.length > 0) {
        const props = Object.fromEntries(
          updatedSensor.properties
            .filter(p => p.key)
            .map(p => [p.key, p.value])
        );

        if (Object.keys(props).length > 0) {
          payload.properties = props;
        }
      }

      await updateData(`${item.root}(${editSensor["@iot.id"]})`, token, payload);
      setEditSensor(null);


      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
    } catch (err) {
      setEditError(err.message || "Error editing sensor");
    } finally {
      setEditLoading(false);
    }
  };


  // -- RENDER --
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar title="Sensors" />
      <Divider style={{ backgroundColor: "white", height: 1, margin: "8px 0" }} />
      <div className="flex mb-4">
        <SearchBar value={search} onChange={setSearch} />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-sensor");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0, marginLeft: 8 }}
          aria-label="Add Sensor"
        >
          +
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p>No available sensors.</p>
      ) : (

        <Accordion
          variant="splitted"
          selectedKeys={expanded ? [expanded] : []}
          onSelectionChange={(key) => {
            if (typeof key === "string") setExpanded(key);
            else if (key && typeof key === "object" && "has" in key) {
              const arr = Array.from(key);
              setExpanded(arr[0] != null ? String(arr[0]) : null);
            } else if (Array.isArray(key)) {
              setExpanded(key[0] ?? null);
            } else {
              setExpanded(null);
            }
          }}
        >
          {[
            ...(showCreate ? [
              <AccordionItem
                key="new-sensor"
                id="sensor-accordion-item-new-sensor"
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">New Sensor</span>
                  </div>
                }
                value="new-sensor"
              >
                <EntityCreator
                  fields={sensorFields}
                  onCreate={handleCreate}
                  onCancel={() => setShowCreate(false)}
                  isLoading={createLoading}
                  error={createError}
                  initialValues={{
                    name: "New Sensor",
                    description: "Sensor Description",
                    encodingType: "application/pdf",
                    metadata: "Motion sensor",
                    properties: [],
                  }}
                />
              </AccordionItem>
            ] : []),

            ...filtered.map((sens, idx) => (
              <AccordionItem
                key={sens["@iot.id"] ?? idx}
                title={
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-lg text-gray-800">{sens.name ?? "-"}</span>
                    <span className="text-xs text-gray-500">{sens.description ?? "-"}</span>
                  </div>
                }
              >
                {/* EDITING SENSOR */}
                {editSensor && editSensor["@iot.id"] === sens["@iot.id"] ? (
                  <EntityCreator
                    fields={sensorFields}
                    onCreate={handleEdit}
                    onCancel={() => setEditSensor(null)}
                    isLoading={editLoading}
                    error={editError}
                    initialValues={{
                      "@iot.id": sens["@iot.id"],
                      name: sens.name,
                      description: sens.description,
                      encodingType: sens.encodingType,
                      metadata: sens.metadata,
                      properties: Object.entries(sens.properties || {}).map(([key, value]) => ({ key, value })),
                    }}
                  />
                ) : (
                  <div className="mt-2 flex flex-row gap-8">
                    {/* SX col with self attributes */}
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(sens).map(([key, value]) =>
                        (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[a-z]/.test(key)) ? null : (
                          <div key={key} className="flex items-center gap-2">
                            <label className="w-40 text-sm text-gray-700">
                              {key.includes("@iot") ? key.split("@")[0] : t(getLabel(key))}
                            </label>
                            <Input
                              size="sm"
                              readOnly
                              value={
                                typeof value === "object"
                                  ? JSON.stringify(value)
                                  : value?.toString() ?? "-"
                              }
                              className="flex-1"
                            />
                          </div>
                        )
                      )}
                    </div>

                    {/* vertical divider */}
                    <div className="w-px bg-gray-300 mx-4" />

                    {/* DX col with linked attributes */}
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(sens).map(([key, value]) =>
                        (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[A-Z]/.test(key)) ? null : (
                          <div key={key} className="flex items-center gap-2">
                            <label className="w-40 text-sm text-gray-700">
                              {key.includes("@iot") ? key.split("@")[0] : key}
                            </label>
                            <Button
                              size="sm"
                              variant="solid"
                              onPress={() => {
                                alert(`Go to ${value}`);
                              }}
                            >
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value).split("/").pop() || String(value)}
                            </Button>
                          </div>
                        )
                      )}

                      {/* EDIT AND DELETE BUTTONS */}
                      <div className="flex justify-end mt-4 gap-2 relative">
                        <Button
                          color="warning"
                          variant="bordered"
                          onPress={() => setEditSensor(sens)}
                        >
                          {t("general.edit")}
                        </Button>
                        <DeleteButton
                          endpoint={`${item.root}(${sens["@iot.id"]})`}
                          token={token}
                          onDeleted={() =>
                            setSensors(prev => prev.filter(o => o["@iot.id"] !== sens["@iot.id"]))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </AccordionItem>
            )),
          ]}
        </Accordion>
      )}
    </div>
  );
}