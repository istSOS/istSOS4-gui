"use client";
import * as React from "react";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import deleteData from "../../server/deleteData";
import updateData from "../../server/updateData";
import { useAuth } from "../../context/AuthContext";
import { useEntities } from "../../context/EntitiesContext";
import { Accordion, AccordionItem, Button, Input, Divider } from "@heroui/react";
import DeleteButton from "../../components/customButtons/deleteButton";
import createData from "../../server/createData";
import EntityCreator from "../../components/EntityCreator";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";
import EntityAccordion from "../../components/EntityAccordion";

// Define main and secondary colors from site config
export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

// Retrieve specific items from site configuration
const item = siteConfig.items.find(i => i.label === "Locations");

export default function Locations() {
  const { t } = useTranslation();

  // Define fields for the EntityCreator specific to Locations
  const locationFields = [
    { name: "name", label: t("locations.name"), required: true },
    { name: "description", label: t("locations.description") },
    { name: "latitude", label: t("locations.latitude"), type: "number", required: true },
    { name: "longitude", label: t("locations.longitude"), type: "number", required: true },
    { name: "encodingType", label: t("locations.encoding_type"), required: true, default: "application/vnd.geo+json" },
  ];

  // Optional: label mapping for displaying fields
  const getLabel = (key) => {
    const map = {
      name: t("datastreams.name"),
      description: t("datastreams.description"),
      latitude: t("locations.latitude"),
      longitude: t("locations.longitude"),
      encodingType: t("locations.encoding_type"),
    };
    return map[key] || key;
  };

  // Authentication and entities context
  const { token, loading: authLoading } = useAuth();
  const [locations, setLocations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [showMap, setShowMap] = React.useState(true);
  const [expanded, setExpanded] = React.useState(null);
  const [split, setSplit] = React.useState(0.5);
  const [isSplitting, setIsSplitting] = React.useState(false);

  // State for creation form
  const [showCreate, setShowCreate] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState(null);

  // State for editing
  const [editLocation, setEditLocation] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState(null);

  // Fetch entities from context
  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();

  // Update locations when entities change
  React.useEffect(() => {
    setLocations(entities.locations || []);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  // Refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  // Handle map splitter mouse events
  const splitRef = React.useRef(null);
  React.useEffect(() => {
    function onMouseMove(e) {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newSplit = Math.min(Math.max(x / rect.width, 0.15), 0.85); // min 15%, max 85%
      setSplit(newSplit);
    }
    function onMouseUp() {
      setIsSplitting(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    if (isSplitting) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isSplitting]);

  // Filter locations based on search input
  const filteredLocations = locations.filter((loc) =>
    JSON.stringify(loc).toLowerCase().includes(search.toLowerCase())
  );

  // Cancel creation handler
  const handleCancelCreate = () => setShowCreate(false);

  // Cancel edit handler
  const handleCancelEdit = () => setEditLocation(null);

  // Handle creation of a new location
  const handleCreate = async (newLocation) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        name: newLocation.name,
        description: newLocation.description,
        location: {
          type: "Point",
          coordinates: [
            parseFloat(newLocation.longitude),
            parseFloat(newLocation.latitude)
          ]
        },
        encodingType: newLocation.encodingType
      };
      const res = await createData(item.root, token, payload);
      if (!res) throw new Error("Creation failed");
      setShowCreate(false);
      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);
      // Auto-expand the newly created location
      if (data?.value && data.value.length > 0) {
        setExpanded(String(data.value[data.value.length - 1]["@iot.id"]));
      }
    } catch (err) {
      setCreateError(err.message || "Error creating location");
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle edit button click: set the location to be edited and expand its accordion
  const handleEdit = (entity) => {
    setEditLocation(entity);
    setExpanded(String(entity["@iot.id"]));
  };

  // Handle saving the edited location
  const handleSaveEdit = async (updatedLocation, originalLocation) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        name: updatedLocation.name,
        description: updatedLocation.description,
        location: {
          type: "Point",
          coordinates: [
            parseFloat(updatedLocation.longitude),
            parseFloat(updatedLocation.latitude)
          ]
        },
        encodingType: updatedLocation.encodingType
      };
      await updateData(`${item.root}(${originalLocation["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);
      setExpanded(String(originalLocation["@iot.id"]));
      setEditLocation(null);
    } catch (err) {
      setEditError(err.message || "Error updating location");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle deletion of a location
  const handleDelete = async (id) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);
    } catch (err) {
      console.error("Error deleting location:", err);
    }
  };

  // Functions for MapWrapper
  const getCoordinates = (loc) =>
    Array.isArray(loc.location?.coordinates) ? loc.location.coordinates : null;

  const getId = (loc) => String(loc["@iot.id"]);

  const getLabelMap = (loc) => loc.name ?? "-";

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="min-h-screen p-4">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between mb-2">
        <SecNavbar title="Locations" />
      </div>
      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0" }}
      />
      {/* Search and controls */}
      <div className="flex mb-4">
        {/* Search filter input */}
        <Input
          size="sm"
          placeholder={t("general.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Button
          color="primary"
          size="sm"
          onPress={() => {
            setShowCreate(true);
            setExpanded("new-entity");
          }}
          style={{ fontSize: 24, padding: "0 12px", minWidth: 0 }}
          aria-label="Add Location"
        >
          +
        </Button>
        {/* Button to toggle map visibility */}
        <Button
          size="sm"
          variant="flat"
          className="ml-auto"
          onPress={() => setShowMap((prev) => !prev)}
          style={{ backgroundColor: secondaryColor, color: "white" }}
        >
          {showMap ? t("locations.hide_map") : t("locations.show_map")}
        </Button>
      </div>
      {/* Main content: Accordion and Map */}
      <div
        ref={splitRef}
        className="flex flex-row gap-0"
        style={{ height: `calc(100vh - 180px)`, position: "relative", userSelect: isSplitting ? "none" : undefined }}
      >
        {/* Left: Accordion */}
        <div
          className="h-full overflow-y-auto pr-2"
          style={{
            flexBasis: showMap ? `${split * 100}%` : "100%",
            minWidth: 150,
            maxWidth: "100%",
            transition: isSplitting ? "none" : "flex-basis 0.2s",
          }}
        >
          <EntityAccordion
            items={filteredLocations}
            fields={locationFields}
            expandedId={expanded}
            onItemSelect={setExpanded}
            entityType="locations"
            onCreate={handleCreate}
            showCreateForm={showCreate}
            isCreating={createLoading}
            createError={createError}
            onDelete={handleDelete}
            token={token}
            // Edit props
            onEdit={handleEdit}
            editEntity={editLocation}
            isEditing={editLoading}
            editError={editError}
            handleCancelCreate={handleCancelCreate}
            handleCancelEdit={handleCancelEdit} onSaveEdit={undefined}
            sortOrder={""}
            setSortOrder={undefined}
            />
        </div>
        {/* SPLITTER */}
        {showMap && (
          <>
            <div
              style={{
                width: 4,
                cursor: "col-resize",
                background: "#eee",
                zIndex: 20,
                userSelect: "none",
              }}
              onMouseDown={() => setIsSplitting(true)}
            />
            <div style={{ width: 16 }} />
          </>
        )}
        {/* Right: Map */}
        {showMap && (
          <MapWrapper
            items={filteredLocations}
            getCoordinates={getCoordinates}
            getId={getId}
            getLabel={getLabelMap}
            getGeoJSON={loc => null}
            expandedId={expanded}
            onMarkerClick={id => setExpanded(id)}
            showMap={showMap}
            split={split}
            setSplit={setSplit}
          />
        )}
      </div>
    </div>
  );
}