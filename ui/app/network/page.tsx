"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Card, Switch, Spinner, Divider } from "@heroui/react";
import { useEntities } from "../../context/EntitiesContext";
import { SecNavbar } from "../../components/bars/secNavbar";
import { useEnrichedDatastreams } from "../../components/hooks/useEnrichedDatastreams";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import MapWrapper from "../../components/MapWrapper";

// Define main and secondary colors from site configuration
export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

/**
 * Converts a label string to a camelCase entity key.
 * Example: "Features Of Interest" becomes "featuresOfInterest"
 */
function labelToEntityKey(label: string) {
  // Remove spaces and hyphens and convert the first letter to lowercase
  return label
    .replace(/[\s\-]/g, "") // Removes all spaces and hyphens
    .replace(/^([A-Z])/, (m) => m.toLowerCase()); // Converts first letter to lowercase
}

export default function Page() {
  // State for toggling visibility of all items
  const [showAll, setShowAll] = React.useState(false);
  // State for tracking hovered card for displaying additional info
  const [hovered, setHovered] = React.useState<string | null>(null);

  // Filter items based on showAll state
  const filteredItems = showAll
    ? siteConfig.items
    : siteConfig.items.filter(item => item.weight < 3);

  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const { entities, loading: entitiesLoading, refetchAll } = useEntities();
  const searchParams = useSearchParams();
  const selectedNetwork = searchParams.get("label") || "Network";
  const { t } = useTranslation();

  // Refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  // Memoize the calculation of counts for each item label in siteConfig
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

  // Extract datastreams and locations from entities
  const { token } = useAuth();
  const rawDatastreams = entities?.datastreams || [];
  const enrichedDatastreams = useEnrichedDatastreams(rawDatastreams, token);
  const locations = entities?.locations || [];

  // Helper functions for MapWrapper to get coordinates, IDs, labels, and GeoJSON data.
  // Each function checks the type of item (datastream or location) and returns appropriate data.

  //Get coordinates from a datastream item. If observedArea is a Polygon, return null.
  const getDatastreamCoordinates = (ds: any) =>
    ds.observedArea?.type === "Polygon" ? null : (
      ds.observedArea?.coordinates?.[0]?.[0] || null
    );

  //Get ID from a datastream item.
  const getDatastreamId = (ds: any) =>
    ds["@iot.id"] ? String(ds["@iot.id"]) : JSON.stringify(ds.observedArea?.coordinates);

  //Get label from a datastream item.
  const getDatastreamLabel = (ds: any) => ds.name ?? "-";

  //Get GeoJSON from a datastream item.
  const getDatastreamGeoJSON = (ds: any) => ds.observedArea;

  //Get coordinates from a location item.
  const getLocationCoordinates = (loc: any) =>
    Array.isArray(loc.location?.coordinates) ? loc.location.coordinates : null;

  //Get ID from a location item.
  const getLocationId = (loc: any) => String(loc["@iot.id"]);


  //Get label from a location item.  
  const getLocationLabel = (loc: any) => loc.name ?? "-";


  //Return null for GeoJSON for location items as they are not rendered as areas. 
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
          items={[...enrichedDatastreams, ...locations]}
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
            const isDatastream = !!enrichedDatastreams.find(ds => String(ds["@iot.id"]) === id);
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

/**
 * CSS class mapping for card layout based on item weight.
 * Determines the column span for different screen sizes.
 */
const layoutMap = {
  1: "col-span-1 md:col-span-2", // Span across 1 column on small screens, 2 on medium
  2: "col-span-1", // Span across 1 column
  3: "col-span-1", // Span across 1 column
  4: "col-span-1", // Span across 1 column
};
