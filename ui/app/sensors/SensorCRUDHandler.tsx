"use client";
import * as React from "react";
import { siteConfig } from "../../config/site";
import { createData, updateData, fetchData, deleteData } from "../../server/api";

interface SensorCRUDHandlerProps {
    item: any; // item.root endpoint base (es: /FROST-Server/v1.1/Sensors)
    token: string;
    setShowCreate: (v: boolean) => void;
    setExpanded: (v: string | null) => void;
    setEditSensor: (v: any) => void;
    setCreateLoading: (v: boolean) => void;
    setCreateError: (v: string | null) => void;
    setEditLoading: (v: boolean) => void;
    setEditError: (v: string | null) => void;
    refetchAll: () => Promise<void>;
    setSensors: (v: any[]) => void;
}

/**
 * Hook to manage CRUD operations for Sensors, with optional deep insert of Datastreams.
 * Mirrors the structure used for Things.
 */
export const useSensorCRUDHandler = ({
    item,
    token,
    setShowCreate,
    setExpanded,
    setEditSensor,
    setCreateLoading,
    setCreateError,
    setEditLoading,
    setEditError,
    refetchAll,
    setSensors
}: SensorCRUDHandlerProps) => {

    const handleCancelCreate = () => setShowCreate(false);
    const handleCancelEdit = () => setEditSensor(null);

    // Build payload for Sensor create (supports optional deep insert Datastreams)
    const buildCreatePayload = (raw: any) => {
        const payload: any = {
            name: raw.name,
            description: raw.description,
            encodingType: raw.encodingType,
            metadata: raw.metadata,
            properties:
                raw.properties && Object.keys(raw.properties).length > 0
                    ? raw.properties
                    : {}
        };

        // ---- Datastreams (optional deep insert) ----
        if (Array.isArray(raw.Datastreams) && raw.Datastreams.length > 0) {
            payload.Datastreams = raw.Datastreams.map((ds: any) => {
                if (ds && ds["@iot.id"] && Object.keys(ds).length === 1) {
                    return { "@iot.id": Number(ds["@iot.id"]) };
                }
                if (ds && ds["@iot.id"] && !ds.name) {
                    return { "@iot.id": Number(ds["@iot.id"]) };
                }
                return {
                    name: ds.name,
                    description: ds.description,
                    unitOfMeasurement: ds.unitOfMeasurement,
                    observationType: ds.observationType,
                    properties: ds.properties || {},
                    Thing: ds.Thing,               // { "@iot.id": N } or deep insert (if backend allows)
                    ObservedProperty: ds.ObservedProperty,
                    Network: ds.Network            // custom extension if present
                };
            });
        }

        return payload;
    };

    const minimalCreateValidation = (payload: any) => {
        if (!payload.name) return "Missing Sensor name";
        if (!payload.encodingType) return "Missing encodingType";
        if (payload.Datastreams) {
            for (const d of payload.Datastreams) {
                if (!d["@iot.id"]) {
                    if (!d.name || !d.unitOfMeasurement || !d.observationType) {
                        return "Incomplete new Datastream (name / unitOfMeasurement / observationType)";
                    }
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

    const handleCreate = async (newSensor: any) => {
        setCreateLoading(true);
        setCreateError(null);
        try {
            const sensorPayload = buildCreatePayload(newSensor);
            const validationError = minimalCreateValidation(sensorPayload);
            if (validationError) {
                setCreateError(validationError);
                setCreateLoading(false);
                return;
            }

            await createData(item.root, token, sensorPayload);

            const data = await fetchData(item.root, token);
            setSensors(data?.value || []);

            if (data?.value && data.value.length > 0) {
                const newId = data.value[data.value.length - 1]["@iot.id"];
                setExpanded(String(newId));
            }

            setShowCreate(false);
        } catch (err: any) {
            setCreateError(err?.message || "Error creating Sensor");
        } finally {
            setCreateLoading(false);
        }
        refetchAll();
    };

    const handleEdit = (entity: any) => setEditSensor(entity);

    // Simple update (no deep edit of existing nested Datastreams)
    const handleSaveEdit = async (updatedSensor: any, originalSensor: any) => {
        setEditLoading(true);
        setEditError(null);
        try {
            const payload: any = {
                name: updatedSensor.name,
                description: updatedSensor.description,
                encodingType: updatedSensor.encodingType,
                metadata: updatedSensor.metadata,
                properties:
                    Array.isArray(updatedSensor.properties) && updatedSensor.properties.length > 0
                        ? Object.fromEntries(
                            updatedSensor.properties
                                .filter((p: any) => p.key)
                                .map((p: any) => [p.key, p.value])
                        )
                        : {}
            };

            await updateData(`${item.root}(${originalSensor["@iot.id"]})`, token, payload);

            const data = await fetchData(item.root, token);
            setSensors(data?.value || []);
            setExpanded(String(originalSensor["@iot.id"]));
            setEditSensor(null);
            
        } catch (err: any) {
            setEditError(err?.message || "Error updating Sensor");
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        try {
            await deleteData(`${item.root}(${id})`, token);
            await refetchAll();
        } catch (err) {
            console.error("Error deleting Sensor:", err);
        }
    };


    return {
        handleCancelCreate,
        handleCancelEdit,
        handleCreate,
        handleEdit,
        handleSaveEdit,
        handleDelete,
    };
};