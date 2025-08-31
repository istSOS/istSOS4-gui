"use client";
import * as React from "react";
import { siteConfig } from "../../config/site";
import { createData, updateData, fetchData, deleteData } from "../../server/api";

interface ThingCRUDHandlerProps {
  item: any;
  token: string;
  setShowCreate: (value: boolean) => void;
  setExpanded: (value: string | null) => void;
  setEditThing: (value: any) => void;
  setCreateLoading: (value: boolean) => void;
  setCreateError: (value: string | null) => void;
  setEditLoading: (value: boolean) => void;
  setEditError: (value: string | null) => void;
  refetchAll: () => Promise<void>;
  setNestedEntitiesMap: (value: any) => void;
  setThings: (value: any[]) => void;
}

export const useThingCRUDHandler = ({
  item,
  token,
  setShowCreate,
  setExpanded,
  setEditThing,
  setCreateLoading,
  setCreateError,
  setEditLoading,
  setEditError,
  refetchAll,
  setNestedEntitiesMap,
  setThings,
}: ThingCRUDHandlerProps) => {

  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditThing(null);

  // Build payload supporting:
  // - Existing & new Locations (Locations array with @iot.id refs and/or objects)
  // - Existing & new Datastreams (Datastreams array with @iot.id refs and/or objects)
  // Backward compatibility with older single-location props (Location / newLocation)
  const buildCreatePayload = (raw: any) => {
    const payload: any = {
      name: raw.name,
      description: raw.description,
      properties:
        raw.properties && Object.keys(raw.properties).length > 0
          ? raw.properties
          : {}
    };

    // ---- Locations ----
    if (Array.isArray(raw.Locations) && raw.Locations.length > 0) {
      // If already in deep-insert form (objects) keep them; if primitive ids convert.
      payload.Locations = raw.Locations.map((loc: any) => {
        if (loc && typeof loc === "object") {
          if (loc["@iot.id"]) return { "@iot.id": Number(loc["@iot.id"]) };
          return {
            name: loc.name,
            description: loc.description,
            encodingType: loc.encodingType,
            location: loc.location
          };
        }
        // string/number id fallback
        return { "@iot.id": Number(loc) };
      });
    } else if (raw.newLocations && Array.isArray(raw.newLocations) && raw.newLocations.length > 0) {
      payload.Locations = raw.newLocations.map((loc: any) => ({
        name: loc.name,
        description: loc.description,
        encodingType: loc.encodingType,
        location: loc.location
      }));
    } else if (raw.newLocation) {
      payload.Locations = [
        {
          name: raw.newLocation.name,
            description: raw.newLocation.description,
            encodingType: raw.newLocation.encodingType,
            location: raw.newLocation.location
        }
      ];
    } else if (raw.Location) {
      payload.Locations = [{ "@iot.id": Number(raw.Location) }];
    }

    // ---- Datastreams ----
    if (Array.isArray(raw.Datastreams) && raw.Datastreams.length > 0) {
      payload.Datastreams = raw.Datastreams.map((ds: any) => {
        // Existing reference only
        if (ds && ds["@iot.id"] && Object.keys(ds).length === 1) {
          return { "@iot.id": Number(ds["@iot.id"]) };
        }
        if (ds && ds["@iot.id"] && !ds.name) {
          return { "@iot.id": Number(ds["@iot.id"]) };
        }
        // New deep insert object: keep only allowed fields
        return {
          name: ds.name,
          description: ds.description,
          unitOfMeasurement: ds.unitOfMeasurement,
          observationType: ds.observationType,
          properties: ds.properties || {},
          Sensor: ds.Sensor,             // can be { "@iot.id": N } or new object
          ObservedProperty: ds.ObservedProperty,
          Network: ds.Network
        };
      });
    }

    return payload;
  };

  const minimalCreateValidation = (payload: any) => {
    if (!payload.name) return "Missing Thing name";
    if (payload.Datastreams) {
      for (const d of payload.Datastreams) {
        // Only validate new ones (those without @iot.id)
        if (!d["@iot.id"]) {
          if (!d.name || !d.unitOfMeasurement || !d.observationType) {
            return "Incomplete new Datastream (name / unitOfMeasurement / observationType)";
          }
          if (!d.Sensor) return "New Datastream missing Sensor";
          if (!d.ObservedProperty) return "New Datastream missing ObservedProperty";
          const uom = d.unitOfMeasurement;
          if (!uom?.name || !uom?.symbol || !uom?.definition) {
            return "Invalid Datastream unitOfMeasurement";
          }
        }
      }
    }
    return null;
  };

  const handleCreate = async (newThing: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const thingPayload = buildCreatePayload(newThing);
      const validationError = minimalCreateValidation(thingPayload);
      if (validationError) {
        setCreateError(validationError);
        setCreateLoading(false);
        return;
      }

      // POST deep insert
      await createData(item.root, token, thingPayload);

      // Refetch full list
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);

      // Expand last created (heuristic: last element)
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        await fetchThingWithExpand(newId);
      }

      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err?.message || "Error creating Thing");
    } finally {
      setCreateLoading(false);
    }
    refetchAll()
  };

  const handleEdit = (entity: any) => setEditThing(entity);

  // NOTE: Editing keeps previous simpler logic (no deep edit of nested entities)
  const handleSaveEdit = async (updatedThing: any, originalThing: any) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const originalLocId = originalThing?.Locations?.[0]?.["@iot.id"];
      const newLocId = updatedThing.Location || null;

      const payload: any = {
        name: updatedThing.name,
        description: updatedThing.description,
        properties:
          Array.isArray(updatedThing.properties) && updatedThing.properties.length > 0
            ? Object.fromEntries(
                updatedThing.properties
                  .filter((p: any) => p.key)
                  .map((p: any) => [p.key, p.value])
              )
            : {}
      };

      if (Number(newLocId) !== Number(originalLocId)) {
        if (newLocId) payload.Locations = [{ "@iot.id": Number(newLocId) }];
        else payload.Locations = [];
      }

      await updateData(`${item.root}(${originalThing["@iot.id"]})`, token, payload);
      const data = await fetchData(item.root, token);
      setThings(data?.value || []);
      setExpanded(String(originalThing["@iot.id"]));
      setEditThing(null);
      await fetchThingWithExpand(originalThing["@iot.id"]);
    } catch (err: any) {
      setEditError(err?.message || "Error updating Thing");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      await refetchAll();
    } catch (err) {
      console.error("Error deleting Thing:", err);
    }
  };

  const fetchThingWithExpand = async (thingId: string | number) => {
    const nested = siteConfig.items.find(i => i.label === "Things")?.nested || [];
    const nestedData: Record<string, any> = {};
    await Promise.all(
      nested.map(async (nestedKey: string) => {
        const url = `${item.root}(${thingId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) nestedData[nestedKey] = data[nestedKey];
      })
    );
    setNestedEntitiesMap(prev => ({ ...prev, [thingId]: nestedData }));
  };

  return {
    handleCancelCreate,
    handleCancelEdit,
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete,
    fetchThingWithExpand,
  };
};