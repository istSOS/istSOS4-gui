"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import fetchData from "../server/fetchData";
import { useAuth } from "./AuthContext";
import { siteConfig } from "../config/site";

type Entities = {
  locations: any[];
  things: any[];
  sensors: any[];
  datastreams: any[];
  observations: any[];
  featuresOfInterest: any[];
  observedProperties: any[];
  historicalLocations: any[];
  network: any[];
};

type EntitiesContextType = {
  entities: Entities;
  setEntities: React.Dispatch<React.SetStateAction<Entities>>;
  loading: boolean;
  error: string | null;
  refetchAll: () => Promise<void>;
};

const EntitiesContext = createContext<EntitiesContextType>({
  entities: {
    locations: [],
    things: [],
    sensors: [],
    datastreams: [],
    observations: [],
    featuresOfInterest: [],
    observedProperties: [],
    historicalLocations: [],
    network: [],
  },
  setEntities: () => { },
  loading: true,
  error: null,
  refetchAll: async () => { },
});

export function EntitiesProvider({ children }: { children: React.ReactNode }) {
  const { token, loading: authLoading } = useAuth();
  const [entities, setEntities] = useState<Entities>({
    locations: [],
    things: [],
    sensors: [],
    datastreams: [],
    observations: [],
    featuresOfInterest: [],
    observedProperties: [],
    historicalLocations: [],
    network: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchAll = async () => {
    if (!token || authLoading) return;
    setLoading(true);
    setError(null);
    try {
      const [
        locations,
        things,
        sensors,
        datastreams,
        observations,
        featuresOfInterest,
        observedProperties,
        historicalLocations,
        network
      ] = await Promise.all([
        fetchData(siteConfig.items.find(i => i.label === "Locations")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "Things")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "Sensors")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "Datastreams")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "Observations")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "FeaturesOfInterest")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "ObservedProperties")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "HistoricalLocations")?.root, token).then(d => d?.value || []),
        fetchData(siteConfig.items.find(i => i.label === "Networks")?.root, token).then(d => d?.value || []),
      ]);
      setEntities({ locations, things, sensors, datastreams, observations, featuresOfInterest, observedProperties, historicalLocations, network });
    } catch (err: any) {
      setError("Error during data loading: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetchAll();
    // eslint-disable-next-line
  }, [token, authLoading]);

  return (
    <EntitiesContext.Provider value={{ entities, setEntities, loading, error, refetchAll }}>
      {children}
    </EntitiesContext.Provider>
  );
}

export function useEntities() {
  return useContext(EntitiesContext);
}