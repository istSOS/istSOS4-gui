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
import MapWrapper from "../../components/MapWrapper";
import FeatureOfInterestCreator from "./FeatureOfInterestCreator";

//export const mainColor = siteConfig.main_color;

// Find config items
const item = siteConfig.items.find(i => i.label === "Observations");
const foiItem = siteConfig.items.find(i => i.label === "FeaturesOfInterest");

export default function Observations() {
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data & UI state
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState<Record<string, any>>({});
  const [observations, setObservations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editObservation, setEditObservation] = React.useState<any>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);

  // FeatureOfInterest modal
  const [foiModalOpen, setFoiModalOpen] = React.useState(false);
  const [pendingFoi, setPendingFoi] = React.useState<any>(null);

  // Grafana embed
  const [showGrafana, setShowGrafana] = React.useState(false);
  const grafanaBase = process.env.NEXT_PUBLIC_GRAFANA_BASE_URL;
  const grafanaDashboardUid = process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_UID;
  const grafanaPanelId = process.env.NEXT_PUBLIC_GRAFANA_PANEL_ID;
  const grafanaUrl = React.useMemo(() => {
    if (!grafanaBase || !grafanaDashboardUid || !grafanaPanelId) return null;
    
    return `${grafanaBase}/d-solo/${grafanaDashboardUid}/?panelId=${grafanaPanelId}&theme=light&var-entity=observations`;
  }, [grafanaBase, grafanaDashboardUid, grafanaPanelId]);

  // Default form values
  const defaultValues = {
    phenomenonTime: "2023-01-01T00:00:00Z",
    resultTime: "2023-01-01T00:00:00Z",
    result: 0,
    resultQuality: "",
    Datastream: null,
    FeatureOfInterest: null
  };

  React.useEffect(() => {
    refetchAll();
  }, []);

  React.useEffect(() => {
    setObservations(entities.observations || []);
    setLoading(entitiesLoading);
    setError(entitiesError as any);
  }, [entities, entitiesLoading, entitiesError]);

  // Filters
  const [filters, setFilters] = React.useState({
    datastream: "",
    featureOfInterest: ""
  });
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Filtered observations
  const filtered = observations.filter(o => {
    const id = o["@iot.id"];
    const nested = nestedEntitiesMap[id] || {};
    const datastream = nested.Datastream || o.Datastream;
    const featureOfInterest = nested.FeatureOfInterest || o.FeatureOfInterest;

    const datastreamId = datastream && datastream["@iot.id"] ? String(datastream["@iot.id"]) : "";
    const featureOfInterestId = featureOfInterest && featureOfInterest["@iot.id"] ? String(featureOfInterest["@iot.id"]) : "";

    const matchesSearch = JSON.stringify(o).toLowerCase().includes(search.toLowerCase());
    const matchesDatastream = !filters.datastream || datastreamId === String(filters.datastream);
    const matchesFeatureOfInterest = !filters.featureOfInterest || featureOfInterestId === String(filters.featureOfInterest);

    return matchesSearch && matchesDatastream && matchesFeatureOfInterest;
  });

  // Options
  const datastreamOptions = (entities?.datastreams || []).map((ds: any) => ({
    label: ds.name || `Datastream ${ds["@iot.id"]}`,
    value: ds["@iot.id"]
  }));
  const featureOfInterestOptions = (entities?.featuresOfInterest || []).map((foi: any) => ({
    label: foi.name || `Feature of Interest ${foi["@iot.id"]}`,
    value: foi["@iot.id"]
  }));

  // Form fields
  const observationFields = [
    { name: "phenomenonTime", label: "Phenomenon Time", required: true, defaultValue: defaultValues.phenomenonTime, type: "datetime-local" },
    { name: "resultTime", label: "Result Time", required: false, defaultValue: defaultValues.resultTime, type: "datetime-local" },
    { name: "result", label: "Result", required: true, defaultValue: defaultValues.result, type: "number" },
    { name: "resultQuality", label: "Result Quality", required: false, defaultValue: defaultValues.resultQuality, type: "text" },
    {
      name: "Datastream",
      label: "Datastream",
      required: true,
      defaultValue: defaultValues.Datastream,
      type: "select",
      options: datastreamOptions
    },
    {
      name: "FeatureOfInterest",
      label: "Feature Of Interest",
      required: false,
      defaultValue: defaultValues.FeatureOfInterest,
      type: "select",
      options: featureOfInterestOptions,
      render: ({ value, onChange }) => (
        <div className="flex flex-col gap-2">
          <select
            value={value || ""}
            onChange={e => onChange(e.target.value)}
          >
            <option value="">Select Feature Of Interest</option>
            {featureOfInterestOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
            onClick={() => setFoiModalOpen(true)}
          >
            + Create new Feature Of Interest
          </button>
          {pendingFoi && (
            <span className="text-green-700 text-xs">
              New Feature Of Interest will be created on save
            </span>
          )}
        </div>
      )
    }
  ];

  // Cancel create
  const handleCancelCreate = () => {
    setShowCreate(false);
    setPendingFoi(null);
  };
  const handleCancelEdit = () => setEditObservation(null);

  // Create
  const handleCreate = async (newObservation: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      let foiId = newObservation.FeatureOfInterest;
      if (pendingFoi) {
        const foiRes = await createData(foiItem!.root, token, pendingFoi);
        foiId = foiRes["@iot.id"];
        setPendingFoi(null);
      }
      const payload: any = {
        phenomenonTime: newObservation.phenomenonTime,
        resultTime: newObservation.resultTime,
        result: newObservation.result,
        resultQuality: newObservation.resultQuality,
        Datastream: { "@iot.id": Number(newObservation.Datastream) },
        FeatureOfInterest: foiId ? { "@iot.id": Number(foiId) } : null
      };
      await createData(item!.root, token, payload);
      setShowCreate(false);
      setExpanded(null);
      const data = await fetchData(item!.root, token);
      setObservations(data?.value || []);
      if (data?.value?.length) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchObservationWithExpand(newId);
      }
    } catch (err: any) {
      setCreateError(err?.message || "Error creating observation");
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit
  const handleEdit = (entity: any) => setEditObservation(entity);

  const handleSaveEdit = async (updatedObservation: any, originalObservation: any) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const payload: any = {
        phenomenonTime: updatedObservation.phenomenonTime,
        resultTime: updatedObservation.resultTime,
        result: updatedObservation.result,
        resultQuality: updatedObservation.resultQuality != null ? String(updatedObservation.resultQuality) : ""
      };
      if (updatedObservation.Datastream) {
        payload.Datastream = { "@iot.id": Number(updatedObservation.Datastream) };
      }
      if (updatedObservation.FeatureOfInterest) {
        payload.FeatureOfInterest = { "@iot.id": Number(updatedObservation.FeatureOfInterest) };
      }
      await updateData(`${item!.root}(${originalObservation["@iot.id"]})`, token, payload);
      const data = await fetchData(item!.root, token);
      setObservations(data?.value || []);
      setExpanded(String(originalObservation["@iot.id"]));
      setEditObservation(null);
      await fetchObservationWithExpand(originalObservation["@iot.id"]);
    } catch (err: any) {
      setEditError(err?.message || "Error updating observation");
    } finally {
      setEditLoading(false);
    }
  };

  // Delete
  const handleDelete = (id: string) => {
    // Convert id to number and call async delete logic
    (async () => {
      try {
        await deleteData(`${item!.root}(${Number(id)})`, token);
        const data = await fetchData(item!.root, token);
        setObservations(data?.value || []);
      } catch (err) {
        console.error("Error deleting observation:", err);
      }
    })();
  };

  // Expand nested
  const fetchObservationWithExpand = async (observationId: number) => {
    const nested = siteConfig.items.find(i => i.label === "Observations")!.nested;
    const nestedData: Record<string, any> = {};
    await Promise.all(
      nested.map(async (nestedKey: string) => {
        const url = `${item!.root}(${observationId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) {
          nestedData[nestedKey] = data[nestedKey];
        }
      })
    );
    setNestedEntitiesMap(prev => ({ ...prev, [observationId]: nestedData }));
  };

  React.useEffect(() => {
    if (observations.length > 0) {
      observations.forEach(o => {
        fetchObservationWithExpand(o["@iot.id"]);
      });
    }
    setLoading(entitiesLoading);
    setError(entitiesError as any);
  }, [entitiesLoading, entitiesError, token, observations]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  const entityListComponent = (
    <EntityList
      items={filtered}
      fields={observationFields}
      expandedId={expanded}
      onItemSelect={setExpanded}
      entityType="observations"
      onEdit={handleEdit}
      onSaveEdit={handleSaveEdit}
      onDelete={handleDelete}
      onCreate={handleCreate}
      handleCancelCreate={handleCancelCreate}
      handleCancelEdit={handleCancelEdit}
      showCreateForm={showCreate}
      isCreating={createLoading}
      createError={createError}
      editEntity={editObservation}
      isEditing={editLoading}
      editError={editError}
      token={token}
      nestedEntities={nestedEntitiesMap}
      sortOrder=""
      setSortOrder={() => {}}
    />
  );

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4">
      <EntityActions
        title="Observations"
        search={search}
        onSearchChange={setSearch}
        onCreatePress={() => {
          setShowCreate(true);
          setExpanded("new-entity");
        }}
        showMap={showMap}
        onToggleMap={() => setShowMap(prev => !prev)}
        filters={{
          datastream: { label: "Datastream", options: datastreamOptions, value: filters.datastream },
            featureOfInterest: { label: "Feature Of Interest", options: featureOfInterestOptions, value: filters.featureOfInterest }
        }}
        onFilterChange={handleFilterChange}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowGrafana(s => !s)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
        >
          {showGrafana ? "Hide Grafana panel" : "Show Grafana panel"}
        </button>
        {showGrafana && !grafanaUrl && (
          <span className="text-xs text-red-600">
            Missing Grafana env vars (NEXT_PUBLIC_GRAFANA_BASE_URL, UID, PANEL_ID).
          </span>
        )}
      </div>

      <SplitPanel
        leftPanel={
          <div className="flex flex-col gap-4">
            {entityListComponent}
            {showGrafana && grafanaUrl && (
              <div className="border rounded h-[480px] overflow-hidden">
                <iframe
                  src={grafanaUrl}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  loading="lazy"
                  allow="fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Grafana Panel"
                />
              </div>
            )}
          </div>
        }
        rightPanel={null}
        showRightPanel={null}
        initialSplit={split}
      />

      {foiModalOpen && (
        <FeatureOfInterestCreator
          onCreate={foi => {
            setPendingFoi(foi);
            setFoiModalOpen(false);
          }}
          onCancel={() => setFoiModalOpen(false)}
        />
      )}
    </div>
  );
}