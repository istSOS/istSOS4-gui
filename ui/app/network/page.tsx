"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Card, Switch, Spinner, Divider } from "@heroui/react";
import { useEntities } from "../../context/EntitiesContext";
import { SecNavbar } from "../../components/bars/secNavbar";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";

export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

function labelToEntityKey(label: string) {
  // Remove spaces and hyphens and convert first letter to lowercase
  // Example: "FeaturesOfInterest" or "Features Of Interest" → "featuresOfInterest"
  return label
    .replace(/[\s\-]/g, "")
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

export default function Page() {
  const [showAll, setShowAll] = React.useState(false);

  const filteredItems = showAll
    ? siteConfig.items
    : siteConfig.items.filter(item => item.weight < 3);


  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const { entities, loading: entitiesLoading, refetchAll } = useEntities();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const selectedNetwork = searchParams.get("label") || "Network";
  const { t } = useTranslation();

  // Refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  const countsMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    siteConfig.items.forEach(item => {
      const key = labelToEntityKey(item.label);
      const arr = (entities as any)[key];
      map[item.label] = Array.isArray(arr) ? arr.length : 0;
    });
    return map;
  }, [entities]);

  const loading = authLoading || entitiesLoading;

  // Get datastreams and locations from entities
  const datastreams = entities?.datastreams || [];
  const locations = entities?.locations || [];

  //MapWrapper functions for datastreams and locations
  //If observedArea is a Polygon, return null for coordinates (no points to show, just area)
  const getDatastreamCoordinates = (ds: any) =>
    ds.observedArea?.type === "Polygon" ? null : (
      ds.observedArea?.coordinates?.[0]?.[0] || null
    );

  const getDatastreamId = (ds: any) =>
    ds["@iot.id"] ? String(ds["@iot.id"]) : JSON.stringify(ds.observedArea?.coordinates);
  const getDatastreamLabel = (ds: any) => ds.name ?? "-";
  const getDatastreamGeoJSON = (ds: any) => ds.observedArea;

  const getLocationCoordinates = (loc: any) =>
    Array.isArray(loc.location?.coordinates) ? loc.location.coordinates : null;
  const getLocationId = (loc: any) => String(loc["@iot.id"]);
  const getLocationLabel = (loc: any) => loc.name ?? "-";
  const getLocationGeoJSON = (_: any) => null;

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-2">
        <SecNavbar title={selectedNetwork} />

        <div className="flex items-center gap-2"
          style={{
            padding: "15px"
          }}
        >

          <span className="text-sm font-medium text-white">{t("general.show_all")}</span>

          <Switch
            checked={showAll}
            onChange={e => setShowAll(e.target.checked)}
          >
          </Switch>

        </div>
      </div>

      <div className="max-w-7xl mx-auto grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
        {(showAll ? siteConfig.items : siteConfig.items.filter(item => item.weight < 3)).map((item) => (
          <Card
            key={item.href}
            isPressable
            isHoverable
            onPress={() => router.push(item.href)}
            onMouseEnter={() => setHovered(item.label)}
            onMouseLeave={() => setHovered(null)}
            className={`!p-0 !items-stretch !items-start cursor-pointer transition-all duration-300 transform hover:scale-[1.02] text-white rounded-2xl shadow-lg flex flex-col ${layoutMap[item.weight]}`}
            style={{
              backgroundColor: secondaryColor,
              color: "white",
            }}
          >
            <div className="flex flex-col items-start p-3 overflow-hidden">
              <h3 className="text-lg font-medium mb-1">{item.label}</h3>
              <div className="text-4xl font-bold mb-1">
                {loading
                  ? "Loading..."
                  : countsMap[item.label] !== undefined
                    ? countsMap[item.label]
                    : "0"}
              </div>
              <div
                className={`text-sm mt-1 transition-all duration-300 ease-in-out overflow-hidden ${hovered === item.label
                  ? "opacity-100 max-h-40"
                  : "opacity-0 max-h-0"
                  }`}
              >
                {t(`general.${item.label.toLowerCase()}_info`)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Map render */}
      <div className="max-w-7xl mx-auto mt-8">
        <MapWrapper
          items={[...datastreams, ...locations]}
          getCoordinates={item =>
            item.observedArea
              ? getDatastreamCoordinates(item)
              : getLocationCoordinates(item)
          }
          getId={item =>
            item.observedArea
              ? getDatastreamId(item)
              : getLocationId(item)
          }
          getLabel={item =>
            item.observedArea
              ? getDatastreamLabel(item)
              : getLocationLabel(item)
          }
          getGeoJSON={item =>
            item.observedArea
              ? getDatastreamGeoJSON(item)
              : getLocationGeoJSON(item)
          }
          expandedId={null}
          onMarkerClick={id => {
            const isDatastream = !!datastreams.find(ds => String(ds["@iot.id"]) === id);
            if (isDatastream) {
              router.push(`/datastreams?expanded=${id}`);
            }
          }}
          showMap={true}
          split={0.5}
          setSplit={() => { }}
          showMarkers={true}
        />
      </div>
    </div>
  );


}

const layoutMap = {
  1: "col-span-1 md:col-span-2",
  2: "col-span-1",
  3: "col-span-1",
  4: "col-span-1",
};