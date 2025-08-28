"use client";
import * as React from "react";
import { siteConfig } from "../../config/site";
import { createData, updateData, fetchData, deleteData } from "../../server/api";
import { unitOfMeasurementOptions } from "./utils";

interface DatastreamCRUDHandlerProps {
  item: any;
  token: string;
  setShowCreate: (value: boolean) => void;
  setExpanded: (value: string | null) => void;
  setEditDatastream: (value: any) => void;
  setCreateLoading: (value: boolean) => void;
  setCreateError: (value: string | null) => void;
  setEditLoading: (value: boolean) => void;
  setEditError: (value: string | null) => void;
  refetchAll: () => Promise<void>;
  setNestedEntitiesMap: (value: any) => void;
}

export const useDatastreamCRUDHandler = ({
  item,
  token,
  setShowCreate,
  setExpanded,
  setEditDatastream,
  setCreateLoading,
  setCreateError,
  setEditLoading,
  setEditError,
  refetchAll,
  setNestedEntitiesMap,
}: DatastreamCRUDHandlerProps) => {

  const handleCancelCreate = () => setShowCreate(false);
  const handleCancelEdit = () => setEditDatastream(null);

  const handleCreate = async (formPayload: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {

      if (!formPayload?.name || !formPayload?.observationType) {
        setCreateError("Missing required datastream fields");
        setCreateLoading(false);
        return;
      }
      const uom = formPayload.unitOfMeasurement;
      if (!uom || !uom.name || !uom.definition) {
        setCreateError("Invalid Unit Of Measurement");
        setCreateLoading(false);
        return;
      }

      const hasThing =
        formPayload.Thing &&
        (formPayload.Thing["@iot.id"] ||
          (formPayload.Thing.name && formPayload.Thing.name !== ""));
      const hasSensor =
        formPayload.Sensor &&
        (formPayload.Sensor["@iot.id"] ||
          (formPayload.Sensor.name && formPayload.Sensor.name !== ""));
      const hasObservedProperty =
        formPayload.ObservedProperty &&
        (formPayload.ObservedProperty["@iot.id"] ||
          (formPayload.ObservedProperty.name && formPayload.ObservedProperty.name !== ""));
      if (!hasThing || !hasSensor || !hasObservedProperty) {
        setCreateError("Thing, Sensor and ObservedProperty are required (reference or deep insert)");
        setCreateLoading(false);
        return;
      }

      if (!formPayload.properties) formPayload.properties = {};
      if (!formPayload.network) formPayload.network = "acsot";
      await createData(item.root, token, formPayload);
      setShowCreate(false);
      setExpanded(null);
      await refetchAll();

      const data = await fetchData(item.root, token);
      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
        fetchDatastreamWithExpand(newId);
      }
    } catch (err: any) {
      setCreateError(err.message || "Error creating datastream");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = (entity: any) => {
    setEditDatastream(entity);
  };

  const handleSaveEdit = async (updatedDatastream: any, originalDatastream: any) => {
    setEditLoading(true);
    setEditError(null);
    try {
      // Validate unit of measurement
      const uomOption = unitOfMeasurementOptions.find(o => o.name === updatedDatastream.unitOfMeasurement);
      if (!uomOption) {
        setEditError("Invalid Unit Of Measurement");
        setEditLoading(false);
        return;
      }

      // Validate observation type
      const obsType = updatedDatastream.observationType;
      if (!obsType) {
        setEditError("Invalid Observation Type");
        setEditLoading(false);
        return;
      }

      // Create payload
      const payload: any = {
        name: updatedDatastream.name,
        description: updatedDatastream.description,
        unitOfMeasurement: {
          name: uomOption.name,
          symbol: uomOption.symbol,
          definition: uomOption.definition,
        },
        observationType: obsType,
        network: "acsot",
        properties: {},
      };

      // Add related entities if they exist
      if (updatedDatastream.thingId) {
        payload.Thing = { "@iot.id": Number(updatedDatastream.thingId) };
      }
      if (updatedDatastream.sensorId) {
        payload.Sensor = { "@iot.id": Number(updatedDatastream.sensorId) };
      }
      if (updatedDatastream.observedPropertyId) {
        payload.ObservedProperty = { "@iot.id": Number(updatedDatastream.observedPropertyId) };
      }

      // Add properties if they exist
      if (Array.isArray(updatedDatastream.properties) && updatedDatastream.properties.length > 0) {
        const props = Object.fromEntries(
          updatedDatastream.properties
            .filter((p: any) => p.key)
            .map((p: any) => [p.key, p.value])
        );
        if (Object.keys(props).length > 0) {
          payload.properties = props;
        }
      }

      await updateData(`${item.root}(${originalDatastream["@iot.id"]})`, token, payload);
      await refetchAll();
      setExpanded(String(originalDatastream["@iot.id"]));
      setEditDatastream(null);
      await fetchDatastreamWithExpand(originalDatastream["@iot.id"]);
    } catch (err: any) {
      setEditError(err.message || "Error updating datastream");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteData(`${item.root}(${Number(id)})`, token);
      await refetchAll();
    } catch (err) {
      console.error("Error deleting datastream:", err);
    }
  };

  const fetchDatastreamWithExpand = async (datastreamId: number) => {
    const nested = siteConfig.items.find(i => i.label === "Datastreams").nested;
    const nestedData: any = {};
    await Promise.all(
      nested.map(async (nestedKey: string) => {
        const url = `${item.root}(${datastreamId})?$expand=${nestedKey}`;
        const data = await fetchData(url, token);
        if (data && data[nestedKey]) {
          nestedData[nestedKey] = data[nestedKey];
        }
      })
    );
    setNestedEntitiesMap(prev => ({
      ...prev,
      [datastreamId]: nestedData
    }));
  };

  return {
    handleCancelCreate,
    handleCancelEdit,
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete,
    fetchDatastreamWithExpand,
  };
};


