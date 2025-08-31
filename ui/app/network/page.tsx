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
import { useRouter, useSearchParams } from "next/navigation";
import { siteConfig } from "../../config/site";
import { useAuth } from "../../context/AuthContext";
import { Card, Switch } from "@heroui/react";
import { useEntities } from "../../context/EntitiesContext";
import { SecNavbar } from "../../components/bars/secNavbar";
import { useEnrichedDatastreams } from "../../components/hooks/useEnrichedDatastreams";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";

// Convert label into the entity key used in EntitiesContext
function labelToEntityKey(label: string) {
  return label.replace(/[\s\-]/g, "").replace(/^([A-Z])/, m => m.toLowerCase());
}

const secondaryColor = siteConfig.secondary_color;

// Momentarily disabled: pages for these entities are not ready yet
const disabledLabelsNormalized = new Set([
  "historicallocations",
  "observedproperties",
  "featuresofinterest",
  "networks"
]);

function normalizeLabel(label: string) {
  return label.replace(/\s+/g, "").toLowerCase();
}

export default function NetworkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { token, loading: authLoading } = useAuth();
  const { entities, loading: entitiesLoading } = useEntities();

  // Current network identification (by id / name query params)
  const networkId = searchParams.get("id");
  const networkName = searchParams.get("name");
  const network = entities?.network?.find(
    (n: any) => String(n["@iot.id"]) === String(networkId)
  );

  // UI state
  const [showAll, setShowAll] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);

  // Items to show (if showAll show every item; else weight < 3)
  const filteredItems = showAll
    ? siteConfig.items
    : siteConfig.items.filter(item => item.weight < 3);

  // Raw collections
  const rawDatastreams = entities?.datastreams || [];
  const locations = entities?.locations || [];

  // Filter datastreams for the current network (if enforced via params)
  const rawDatastreamsForNetwork = React.useMemo(() => {
    if (!networkId && !networkName) return rawDatastreams;
    return rawDatastreams.filter(ds => {
      const net = ds.Network || ds.network;
      if (!net) return false;
      const idMatch =
        networkId && String(net["@iot.id"] || net.id) === String(networkId);
      const nameMatch =
        networkName &&
        (net.name || net.label) &&
        String(net.name || net.label) === String(networkName);
      return idMatch || nameMatch;
    });
  }, [rawDatastreams, networkId, networkName]);

  // Enriched datastreams (last values, etc.)
  const enrichedDatastreams = useEnrichedDatastreams(
    rawDatastreamsForNetwork,
    token
  );

  // Counts per entity type (Datastreams restricted by network; others global)
  const countsMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    siteConfig.items.forEach(item => {
      if (item.label === "Datastreams") {
        map[item.label] = rawDatastreamsForNetwork.length;
      } else {
        const key = labelToEntityKey(item.label);
        const arr = (entities as any)[key];
        map[item.label] = Array.isArray(arr) ? arr.length : 0;
      }
    });
    return map;
  }, [entities, rawDatastreamsForNetwork]);

  const loading = authLoading || entitiesLoading;

  // Map helpers for Datastreams
  const getDatastreamCoordinates = (ds: any) => {
    const area = ds.observedArea;
    if (!area) return null;
    if (area.type === "Point" && Array.isArray(area.coordinates)) {
      return area.coordinates;
    }
    if (area.type === "Polygon" && area.coordinates?.[0]?.[0]) {
      // Use first vertex as marker position
      return area.coordinates[0][0];
    }
    return null;
  };
  const getDatastreamId = (ds: any) =>
    ds["@iot.id"] ? String(ds["@iot.id"]) : JSON.stringify(ds.observedArea?.coordinates);
  const getDatastreamLabel = (ds: any) => ds.name ?? "-";
  const getDatastreamGeoJSON = (ds: any) => ds.observedArea;

  // Map helpers for Locations (unused currently in items array, left for potential future merge)
  const getLocationCoordinates = (loc: any) =>
    Array.isArray(loc.location?.coordinates) ? loc.location.coordinates : null;
  const getLocationId = (loc: any) => String(loc["@iot.id"]);
  const getLocationLabel = (loc: any) => loc.name ?? "-";
  const getLocationGeoJSON = (_: any) => null;

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-2">
        <SecNavbar title={networkName || "Network"} />
        <div className="flex items-center gap-2 px-4">
          <span className="text-sm font-medium text-white">
            {t("general.show_all")}
          </span>
          <Switch checked={showAll} onChange={e => setShowAll(e.target.checked)} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
        {filteredItems.map(item => {
          const isDisabled = disabledLabelsNormalized.has(
            normalizeLabel(item.label)
          );
            const cardBaseClasses =
              " !p-0 cursor-pointer transition-all duration-300 transform rounded-2xl shadow-lg flex flex-col";
          const interactiveClasses = isDisabled
            ? "opacity-50 cursor-not-allowed pointer-events-none"
            : "hover:scale-[1.02]";
          return (
            <Card
              key={item.href}
              isPressable={!isDisabled}
              isHoverable={!isDisabled}
              onPress={() => {
                if (isDisabled) return;
                const qs: string[] = [];
                if (networkName)
                  qs.push(`network=${encodeURIComponent(networkName)}`);
                if (networkId) qs.push(`id=${encodeURIComponent(networkId)}`);
                const suffix = qs.length ? `?${qs.join("&")}` : "";
                router.push(`${item.href}${suffix}`);
              }}
              onMouseEnter={() => !isDisabled && setHovered(item.label)}
              onMouseLeave={() => !isDisabled && setHovered(null)}
              aria-disabled={isDisabled}
              className={`${cardBaseClasses} ${interactiveClasses} ${layoutMap[item.weight]} text-white`}
              style={{
                backgroundColor: secondaryColor,
                color: "white"
              }}
            >
              <div className="flex flex-col items-start p-3 overflow-hidden">
                <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
                  {item.label}
                </h3>
                <div className="text-4xl font-bold mb-1">
                  {loading
                    ? "Loading..."
                    : countsMap[item.label] !== undefined
                    ? countsMap[item.label]
                    : "0"}
                </div>
                <div
                  className={`text-sm mt-1 transition-all duration-300 ease-in-out overflow-hidden ${
                    hovered === item.label && !isDisabled
                      ? "opacity-100 max-h-40"
                      : "opacity-0 max-h-0"
                  }`}
                >
                  {t(`general.${item.label.toLowerCase()}_info`)}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="max-w-7xl mx-auto mt-8">
        <MapWrapper
          items={[...enrichedDatastreams]}
          getCoordinates={item =>
            item.observedArea
              ? getDatastreamCoordinates(item)
              : getLocationCoordinates(item)
          }
          getId={item =>
            item.observedArea ? getDatastreamId(item) : getLocationId(item)
          }
          getLabel={item =>
            item.observedArea ? getDatastreamLabel(item) : getLocationLabel(item)
          }
          getGeoJSON={item =>
            item.observedArea
              ? getDatastreamGeoJSON(item)
              : getLocationGeoJSON(item)
          }
          expandedId={null}
          onMarkerClick={id => {
            const isDatastream = !!enrichedDatastreams.find(
              ds => String(ds["@iot.id"]) === id
            );
            if (isDatastream) {
              const qs: string[] = [];
              if (networkName)
                qs.push(`network=${encodeURIComponent(networkName)}`);
              if (networkId) qs.push(`id=${encodeURIComponent(networkId)}`);
              qs.push(`expanded=${id}`);
              const suffix = qs.length ? `?${qs.join("&")}` : "";
              router.push(`/datastreams${suffix}`);
            }
          }}
          showMap={true}
          split={0.5}
          setSplit={() => {}}
          showMarkers={false}
          chipColorStrategy={item => {
            if (!item.lastMeasurement) return "default";
            const ageMin =
              (Date.now() - new Date(item.lastMeasurement).getTime()) / 60000;
            if (ageMin < 5) return "success";
            if (ageMin < 30) return "warning";
            return "danger";
          }}
        />
      </div>
    </div>
  );
}

// Layout mapping (responsive spans)
const layoutMap: Record<number, string> = {
  1: "col-span-1 md:col-span-2",
  2: "col-span-1",
  3: "col-span-1",
  4: "col-span-1"
};