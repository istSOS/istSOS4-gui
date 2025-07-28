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

export const mainColor = siteConfig.main_color;

//Find the item in siteConfig with labels matching "Observations" and "FeaturesOfInterest"
const item = siteConfig.items.find(i => i.label === "Observations");
const foiItem = siteConfig.items.find(i => i.label === "FeaturesOfInterest");

export default function Observations() {
  //Initialize hooks for translation, routing, authentication, and entity management
  const { t } = useTranslation();
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  //State management for observations, UI states, and form inputs
  const [nestedEntitiesMap, setNestedEntitiesMap] = React.useState({});
  const [observations, setObservations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);
  const [editObservation, setEditObservation] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const [showMap, setShowMap] = React.useState(true);
  const [split, setSplit] = React.useState(0.5);
  //State for managing modal visibility and pending FeatureOfInterest
  const [foiModalOpen, setFoiModalOpen] = React.useState(false);
  const [pendingFoi, setPendingFoi] = React.useState<any>(null);

  //Default values for form fields
  const defaultValues = {
    phenomenonTime: "2023-01-01T00:00:00Z",
    resultTime: "2023-01-01T00:00:00Z",
    result: 0,
    resultQuality: "",
    Datastream: null,
    FeatureOfInterest: null
  };

  //Fetch all entities on component mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  //Effect to update observations and loading/error states when entities change
  React.useEffect(() => {
    setObservations(entities.observations || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  //FILTERS state for nested entity filtering
  const [filters, setFilters] = React.useState({
    datastream: "",
    featureOfInterest: ""
  });

  //Handler function to update filters
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  //Filter observations based on search input and filters
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

  //Generate dropdown options for datastreams and features of interest
  const datastreamOptions = (entities?.datastreams || []).map(ds => ({
    label: ds.name || `Datastream ${ds["@iot.id"]}`,
    value: ds["@iot.id"]
  }));

  const featureOfInterestOptions = (entities?.featuresOfInterest || []).map(foi => ({
    label: foi.name || `Feature of Interest ${foi["@iot.id"]}`,
    value: foi["@iot.id"]
  }));

  //Configuration for observation fields in the form
  const observationFields = [
    { name: "phenomenonTime", label: t("observations.phenomenon_time"), required: true, defaultValue: defaultValues.phenomenonTime, type: "datetime-local" },
    { name: "resultTime", label: t("observations.result_time"), required: false, defaultValue: defaultValues.resultTime, type: "datetime-local" },
    { name: "result", label: t("observations.result"), required: true, defaultValue: defaultValues.result, type: "number" },
    { name: "resultQuality", label: t("observations.result_quality"), required: false, defaultValue: defaultValues.resultQuality, type: "text" },
    {
      name: "Datastream",
      label: t("observations.datastream"),
      required: true,
      defaultValue: defaultValues.Datastream,
      type: "select",
      options: datastreamOptions
    },
    {
      name: "FeatureOfInterest",
      label: t("observations.feature_of_interest"),
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
            <option value="">Select FeatureOfInterest</option>
            {featureOfInterestOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
            onClick={() => setFoiModalOpen(true)}
          >
            + Create new FeatureOfInterest
          </button>
          {pendingFoi && (
            <span className="text-green-700 text-xs">
              New FeatureOfInterest ready to be created!
            </span>
          )}
        </div>
      )
    }
  ];

  //Handlers for CRUD operations
  const handleCancelCreate = () => {
    setShowCreate(false);
    setPendingFoi(null);
  };

  const handleCancelEdit = () => setEditObservation(null);

  //Function to handle the creation of a new Observation
  const handleCreate = async (newObservation) => {
    setCreateLoading(true);
    setCreateError(null);

    try {
      let foiId = newObservation.FeatureOfInterest;

      //If a new FeatureOfInterest is pending, create it first
      if (pendingFoi) {
        const foiRes = await createData(foiItem.root, token, pendingFoi);
        foiId = foiRes["@iot.id"];
        setPendingFoi(null);
      }

      const payload = {
        phenomenonTime: newObservation.phenomenonTime,
        resultTime: newObservation.resultTime,
        result: newObservation.result,
        resultQuality: newObservation.resultQuality,
        Datastream: { "@iot.id": Number(newObservation.Datastream) },
        FeatureOfInterest: foiId ? { "@iot.id": Number(foiId) } : null
      };

      await createData(item.root, token, payload);
      setShowCreate(false);
      setExpanded(null);

      //Fetch updated list of observations and set the newly created one as expanded
      const data = await fetchData(item.root, token);
      setObservations(data?.value || []);
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchObservationWithExpand(newId);
      }
    } catch (err) {
      setCreateError(err.message || "Error creating observation");
    } finally {
      setCreateLoading(false);
    }
  };

  //Function to edit an observation
  const handleEdit = (entity) => {
    setEditObservation(entity);
  };

  //Function to handle saving of an edited observation
  const handleSaveEdit = async (updatedObservation, originalObservation) => {
    setEditLoading(true);
    setEditError(null);

    try {
      const payload = {
        phenomenonTime: updatedObservation.phenomenonTime,
        resultTime: updatedObservation.resultTime,
        result: updatedObservation.result,
        resultQuality: updatedObservation.resultQuality != null ? String(updatedObservation.resultQuality) : "",
        ...(updatedObservation.Datastream && { Datastream: { "@iot.id": Number(updatedObservation.Datastream) } }),
        ...(updatedObservation.FeatureOfInterest && { FeatureOfInterest: { "@iot.id": Number(updatedObservation.FeatureOfInterest) } }),
      };

      await updateData(`${item.root}(${originalObservation["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setObservations(data?.value || []);
      setExpanded(String(originalObservation["@iot.id"]));
      setEditObservation(null);
      await fetchObservationWithExpand(originalObservation["@iot.id"]);
    } catch (err) {
      setEditError(err.message || "Error updating observation");
    } finally {
      setEditLoading(false);
    }
  };

  //Function to handle deletion of an observation
  const handleDelete = async (id) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setObservations(data?.value || []);
    } catch (err) {
      console.error("Error deleting observation:", err);
    }
  };

  //Function to fetch additional data for a specific observation
  const fetchObservationWithExpand = async (observationId) => {
    const nested = siteConfig.items.find(i => i.label === "Observations").nested;
    const nestedData = {};

    await Promise.all(
      nested.map(async (nestedKey) => {
        const url = `${item.root}(${observationId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) {
          nestedData[nestedKey] = data[nestedKey];
        }
      })
    );

    setNestedEntitiesMap(prev => ({
      ...prev,
      [observationId]: nestedData
    }));
  };

  //Fetch nested entities data on observations update
  React.useEffect(() => {
    if (observations.length > 0) {
      observations.forEach(o => {
        fetchObservationWithExpand(o["@iot.id"]);
      });
    }
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entitiesLoading, entitiesError, token, observations]);

  //Render loading and error states
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  //Component for rendering the list of entities
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
    />
  );

  return (
    <div className="min-h-screen p-4">
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
          datastream: { label: t("observations.datastream"), options: datastreamOptions, value: filters.datastream },
          featureOfInterest: { label: t("observations.feature_of_interest"), options: featureOfInterestOptions, value: filters.featureOfInterest }
        }}
        onFilterChange={handleFilterChange}
      />
      <SplitPanel
        leftPanel={entityListComponent}
        rightPanel={null}
        showRightPanel={null}
        initialSplit={split}
      />
      {/* Modal for creating new FeatureOfInterest */}
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
