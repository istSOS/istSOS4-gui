/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";
import * as React from "react";
import { createData, updateData, fetchData, deleteData } from "../../server/api";

interface LocationCRUDHandlerProps {
  item: any;
  token: string;
  setShowCreate: (v: boolean) => void;
  setExpanded: (v: string | null) => void;
  setEditLocation: (v: any) => void;
  setCreateLoading: (v: boolean) => void;
  setCreateError: (v: string | null) => void;
  setEditLoading: (v: boolean) => void;
  setEditError: (v: string | null) => void;
  setLocations: (v: any[]) => void;
  refetchAll: () => Promise<void>;
}

export const useLocationCRUDHandler = ({
  item,
  token,
  setShowCreate,
  setExpanded,
  setEditLocation,
  setCreateLoading,
  setCreateError,
  setEditLoading,
  setEditError,
  setLocations,
  refetchAll
}: LocationCRUDHandlerProps) => {

  // Annulla creazione
  const handleCancelCreate = () => setShowCreate(false);
  // Annulla edit
  const handleCancelEdit = () => setEditLocation(null);

  // Validazione minima
  const minimalCreateValidation = (loc: any) => {
    if (!loc.name) return "Missing Location name";
    if (!loc.encodingType) return "Missing encodingType";
    const lat = parseFloat(loc.latitude);
    const lon = parseFloat(loc.longitude);
    if (isNaN(lat) || isNaN(lon)) return "Invalid latitude/longitude";
    if (lat < -90 || lat > 90) return "Latitude out of range";
    if (lon < -180 || lon > 180) return "Longitude out of range";
    return null;
  };

  // Crea
  const handleCreate = async (newLocation: any) => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const validationError = minimalCreateValidation(newLocation);
      if (validationError) {
        setCreateError(validationError);
        setCreateLoading(false);
        return;
      }

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

      await createData(item.root, token, payload);

      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);

      if (data?.value && data.value.length > 0) {
        const newId = data.value[data.value.length - 1]["@iot.id"];
        setExpanded(String(newId));
      }

      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message || "Error creating Location");
    } finally {
      setCreateLoading(false);
    }
    refetchAll();
  };

  // Entra in modalità edit
  const handleEdit = (entity: any) => {
    setEditLocation(entity);
    setExpanded(String(entity["@iot.id"]));
  };

  // Salva modifiche
  const handleSaveEdit = async (updatedLocation: any, originalLocation: any) => {
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
    } catch (err: any) {
      setEditError(err.message || "Error updating Location");
    } finally {
      setEditLoading(false);
    }
  };

  // Elimina
  const handleDelete = async (id: string | number) => {
    try {
      await deleteData(`${item.root}(${id})`, token);
      const data = await fetchData(item.root, token);
      setLocations(data?.value || []);
    } catch (err) {
      console.error("Error deleting Location:", err);
    }
    refetchAll();
  };

  return {
    handleCancelCreate,
    handleCancelEdit,
    handleCreate,
    handleEdit,
    handleSaveEdit,
    handleDelete
  };
};