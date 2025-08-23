import { useState } from 'react';
import { fetchData, createData, updateData, deleteData } from '../../server/api';


const useDataFetching = (item, token, refetchAll) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (formPayload) => {
    setLoading(true);
    setError(null);
    try {
      if (!formPayload?.name || !formPayload?.observationType) {
        setError("Missing required datastream fields");
        setLoading(false);
        return;
      }

      const uom = formPayload.unitOfMeasurement;
      if (!uom || !uom.name || !uom.definition) {
        setError("Invalid Unit Of Measurement");
        setLoading(false);
        return;
      }

      const hasThing = formPayload.Thing && (formPayload.Thing["@iot.id"] || (formPayload.Thing.name && formPayload.Thing.name !== ""));
      const hasSensor = formPayload.Sensor && (formPayload.Sensor["@iot.id"] || (formPayload.Sensor.name && formPayload.Sensor.name !== ""));
      const hasObservedProperty = formPayload.ObservedProperty && (formPayload.ObservedProperty["@iot.id"] || (formPayload.ObservedProperty.name && formPayload.ObservedProperty.name !== ""));

      if (!hasThing || !hasSensor || !hasObservedProperty) {
        setError("Thing, Sensor and ObservedProperty are required (reference or deep insert)");
        setLoading(false);
        return;
      }

      if (!formPayload.properties) formPayload.properties = {};
      if (!formPayload.network) formPayload.network = "acsot";

      await createData(item.root, token, formPayload);
      await refetchAll();

      const data = await fetchData(item.root, token);
      if (data?.value && data.value.length > 0) {
        return data.value[data.value.length - 1]["@iot.id"];
      }
    } catch (err) {
      setError(err.message || "Error creating datastream");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, payload) => {
    setLoading(true);
    setError(null);
    try {
      await updateData(`${item.root}(${id})`, token, payload);
      await refetchAll();
    } catch (err) {
      setError(err.message || "Error updating datastream");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setLoading(true);
    setError(null);
    try {
      await deleteData(`${item.root}(${Number(id)})`, token);
      await refetchAll();
    } catch (err) {
      setError(err.message || "Error deleting datastream");
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    handleCreate,
    handleUpdate,
    handleDelete
  };
};

export default useDataFetching;
