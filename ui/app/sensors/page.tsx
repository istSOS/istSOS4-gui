"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { useTranslation } from "react-i18next";
import createData from "../../server/createData";
import updateData from "../../server/updateData";
import fetchData from "../../server/fetchData";
import deleteData from "../../server/deleteData";
import { EntityActions } from "../../components/entity/EntityActions";
import { SplitPanel } from "../../components/layout/SplitPanel";
import { EntityList } from "../../components/entity/EntityList";
import { LoadingScreen } from "../../components/LoadingScreen";
import { buildSensorFields } from "./utils";
import SensorCreator from "./SensorCreator";

const item = siteConfig.items.find(i => i.label === "Sensors");

export default function Sensors() {
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState<Record<string, any>>({});
  const [sensors, setSensors] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editSensor, setEditSensor] = React.useState<any | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);


  React.useEffect(() => {
    setSensors(entities.sensors || []);
    setLoading(entitiesLoading || authLoading);
    setError(entitiesError || null);
  }, [entities, entitiesLoading, entitiesError, authLoading]);

  const sensorFields = React.useMemo(() => buildSensorFields(t), [t]);

  const filtered = sensors.filter(sensor =>
    JSON.stringify(sensor).toLowerCase().includes(search.toLowerCase())
  );

  const handleCancelCreate = () => {
    setShowCreate(false);
    setCreateError(null);
  };

  const handleCancelEdit = () => {
    setEditSensor(null);
    setEditError(null);
  };

  const handleCreate = async (newSensor: Record<string, any>) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        name: newSensor.name,
        description: newSensor.description,
        encodingType: newSensor.encodingType,
        metadata: newSensor.metadata
      };
      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchSensorWithExpand(newId);
      }
    } catch (err: any) {
      setCreateError(err?.message || "Error creating sensor");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = (entity: any) => {
    setEditSensor(entity);
  };

  const handleSaveEdit = async (updatedSensor: any, originalSensor: any) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        name: updatedSensor.name,
        description: updatedSensor.description,
        encodingType: updatedSensor.encodingType,
        metadata: updatedSensor.metadata
      };
      await updateData(`${item.root}(${originalSensor["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
      setExpanded(String(originalSensor["@iot.id"]));
      setEditSensor(null);
      await fetchSensorWithExpand(originalSensor["@iot.id"]);
    } catch (err: any) {
      setEditError(err?.message || "Error updating sensor");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setSensors(data?.value || []);
    } catch (err) {
      console.error("Error deleting sensor:", err);
    }
  };

  const fetchSensorWithExpand = async (sensorId: string | number) => {
    const nested = siteConfig.items.find(i => i.label === "Sensors").nested;
    const nestedData: Record<string, any> = {};
    await Promise.all(
      nested.map(async (nestedKey: string) => {
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

  React.useEffect(() => {
    if (sensors.length > 0) {
      sensors.forEach(s => {
        fetchSensorWithExpand(s["@iot.id"]);
      });
    }
  }, [sensors, token]);

  if (loading) return <LoadingScreen />;
  if (error) return <p>{error}</p>;

  const listSection = (
    <div className="flex flex-col gap-4">
      {showCreate && (
        <SensorCreator
          onCreate={handleCreate}
          onCancel={handleCancelCreate}
            isLoading={createLoading}
          error={createError}
        />
      )}
      <EntityList
        items={filtered}
        fields={sensorFields}
        expandedId={expanded}
        onItemSelect={setExpanded}
        entityType="sensors"
        onEdit={handleEdit}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onCreate={() => {}}
        handleCancelCreate={handleCancelCreate}
        handleCancelEdit={handleCancelEdit}
        showCreateForm={false}
        isCreating={false}
        createError={null}
        editEntity={editSensor}
        isEditing={editLoading}
        editError={editError}
        token={token}
        nestedEntities={nestedEntitiesMap}
        sortOrder=""
        setSortOrder={() => {}}
      />
    </div>
  );

  return (
    <div className="min-h-screen p-4">
      <EntityActions
        title="Sensors"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded(null);
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
      />
      <SplitPanel
        leftPanel={listSection}
        rightPanel={null}
        showRightPanel={null}
        initialSplit={split}
      />
    </div>
  );
}