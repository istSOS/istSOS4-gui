"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
//import { unitOfMeasurementOptions, observationTypeURIs } from "./utils";
import { useTranslation } from "react-i18next";
import createData from "../../server/createData";
import updateData from "../../server/updateData";
import fetchData from "../../server/fetchData";
import deleteData from "../../server/deleteData";
//Reusable components
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import MapWrapper from "../../components/MapWrapper";
// Constants
//export const mainColor = siteConfig.main_color;
const item = siteConfig.items.find(i => i.label === "Sensors");
// Main component
export default function Sensors() {
  // Hooks
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  // State management
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState({});
  const [sensors, setSensors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);
  const [editSensor, setEditSensor] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);


  const defaultValues = {
    name: "New Sensor",
    description: "Default Description",
    encodingType: "application/pdf",
    metadata: "Default sensor"
  }

  // Filter sensors
  const filtered = sensors.filter(sensor => {
    const id = sensor["@iot.id"];
    const nested = nestedEntitiesMap[id] || {};
    const matchesSearch = JSON.stringify(sensor).toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Fetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);
  // Set sensors and loading/error states
  React.useEffect(() => {
    setSensors(entities.sensors || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  // Sensor fields configuration
  const sensorFields = [
    { name: "name", label: t("sensors.name"), required: true, defaultValue: defaultValues.name },
    { name: "description", label: t("sensors.description"), required: false, defaultValue: defaultValues.description },
    { name: "encodingType", label: t("sensors.encoding_type"), required: false, defaultValue: defaultValues.encodingType },
    { name: "metadata", label: t("sensors.metadata"), required: false, defaultValue: defaultValues.metadata },
  ];
  // Handlers for CRUD operations
  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditSensor(null);
  const handleCreate = async (newSensor) => {
    setCreateLoading(true);
    setCreateError(null);
    try {

      const payload: {
        name: any;
        description: any;
        encodingType: any;
        metadata?: any;
      } = {
        name: newSensor.name,
        description: newSensor.description,
        encodingType: newSensor.encodingType,
        metadata: newSensor.metadata,
      };

      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
      // Auto-expand the newly created sensor
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchSensorWithExpand(newId);
      }
    } catch (err) {
      setCreateError(err.message || "Error creating sensor");
    } finally {
      setCreateLoading(false);
    }
  };
  const handleEdit = (entity) => {
    setEditSensor(entity);
  };
  const handleSaveEdit = async (updatedSensor, originalSensor) => {
    setEditLoading(true);
    setEditError(null);
    try {

      const payload = {
        name: updatedSensor.name,
        description: updatedSensor.description,
        encodingType: updatedSensor.encodingType,
        metadata: updatedSensor.metadata,

      };

      await updateData(`${item.root}(${originalSensor["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
      setExpanded(String(originalSensor["@iot.id"]));
      setEditSensor(null);
      await fetchSensorWithExpand(originalSensor["@iot.id"]);
    } catch (err) {
      setEditError(err.message || "Error updating sensor");
    } finally {
      setEditLoading(false);
    }
  };
  const handleDelete = async (id) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
    } catch (err) {
      console.error("Error deleting sensor:", err);
    }
  };
  // Fetch sensors with expanded nested entities
  const fetchSensorWithExpand = async (sensorId) => {
    const nested = siteConfig.items.find(i => i.label === "Sensors").nested;
    const nestedData = {};
    await Promise.all(
      nested.map(async (nestedKey) => {
        const url = `${item.root}(${sensorId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) {
          nestedData[nestedKey] = data[nestedKey];
        }
      })
    );
    setNestedEntitiesMap(prev => ({
      ...prev,
      [sensorId]: nestedData
    }));
  };
  // Example call on mount
  React.useEffect(() => {
    if (sensors.length > 0) {
      sensors.forEach(s => {
        fetchSensorWithExpand(s["@iot.id"]);
      });
    }
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entitiesLoading, entitiesError, token, sensors]);
  // Render loading and error states
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  // Render components
  const entityListComponent = (
    <EntityList
      items={filtered}
      fields={sensorFields}
      expandedId={expanded}
      onItemSelect={setExpanded}
      entityType="sensors"
      onEdit={handleEdit}
      onSaveEdit={handleSaveEdit}
      onDelete={handleDelete}
      onCreate={handleCreate}
      handleCancelCreate={handleCancelCreate}
      handleCancelEdit={handleCancelEdit}
      showCreateForm={showCreate}
      isCreating={createLoading}
      createError={createError}
      editEntity={editSensor}
      isEditing={editLoading}
      editError={editError}
      token={token}
      nestedEntities={nestedEntitiesMap}
      sortOrder=""
      setSortOrder={() => {}}
    />
  );

  // Main render
  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="Sensors"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded("new-entity");
        }}

        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
      />
      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={null}
        showRightPanel={null} //null to hide map
        initialSplit={split}
      />
    </div>
  );
}
