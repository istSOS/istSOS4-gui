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

// Converts a label to the entity key used in EntitiesContext
function labelToEntityKey(label: string) {
    return label
        .replace(/[\s\-]/g, "")
        .replace(/^([A-Z])/, m => m.toLowerCase());
}

const secondaryColor = siteConfig.secondary_color;

export default function NetworkPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useTranslation();
    const { token, loading: authLoading } = useAuth();
    const { entities, loading: entitiesLoading } = useEntities();

    // Current network identification (by id param)
    const networkId = searchParams.get("id");
    const networkName = searchParams.get("name");
    const network = entities?.network?.find(
        (n: any) => String(n["@iot.id"]) === String(networkId)
    );

    // UI state
    const [showAll, setShowAll] = React.useState(false);
    const [hovered, setHovered] = React.useState<string | null>(null);

    // Items to show (if showAll show everything, else only weight < 3)
    const filteredItems = showAll
        ? siteConfig.items
        : siteConfig.items.filter(item => item.weight < 3);

    // Raw entities
    const rawDatastreams = entities?.datastreams || [];
    const locations = entities?.locations || [];

    // Filter datastreams only for the current network (if network filter present)
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

    // Enriched datastreams only for current network
    const enrichedDatastreams = useEnrichedDatastreams(
        rawDatastreamsForNetwork,
        token
    );

    // Counts map: Datastreams count restricted to current network; others unchanged
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

    // Map helper functions
    const getDatastreamCoordinates = (ds: any) => {
        const area = ds.observedArea;
        if (!area) return null;
        if (area.type === "Point" && Array.isArray(area.coordinates)) {
            return area.coordinates;
        }
        if (area.type === "Polygon" && area.coordinates?.[0]?.[0]) {
            // We choose the first vertex as marker (or return null if you prefer no marker)
            return area.coordinates[0][0];
        }
        return null;
    };

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
                <SecNavbar title={networkName || "Network"} />
                <div
                    className="flex items-center gap-2"
                    style={{ padding: "15px" }}
                >
                    <span className="text-sm font-medium text-white">
                        {t("general.show_all")}
                    </span>
                    <Switch
                        checked={showAll}
                        onChange={e => setShowAll(e.target.checked)}
                    />
                </div>
            </div>
            <div className="max-w-7xl mx-auto grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
                {filteredItems.map(item => (
                    <Card
                        key={item.href}
                        isPressable
                        isHoverable
                        onPress={() => {
                            // Always preserve current network context when navigating
                            const qs: string[] = [];
                            if (networkName) qs.push(`network=${encodeURIComponent(networkName)}`);
                            if (networkId) qs.push(`id=${encodeURIComponent(networkId)}`);
                            const suffix = qs.length ? `?${qs.join("&")}` : "";
                            router.push(`${item.href}${suffix}`);
                        }}
                        onMouseEnter={() => setHovered(item.label)}
                        onMouseLeave={() => setHovered(null)}
                        className={`!p-0 !items-stretch !items-start cursor-pointer transition-all duration-300 transform hover:scale-[1.02] text-white rounded-2xl shadow-lg flex flex-col ${layoutMap[item.weight]}`}
                        style={{
                            backgroundColor: secondaryColor,
                            color: "white"
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
            <div className="max-w-7xl mx-auto mt-8">
                <MapWrapper
                    // Only datastreams for the selected network + all locations (optional: filter locations too)
                    //items={[...enrichedDatastreams, ...locations]} //w locations
                    items={[...enrichedDatastreams]}
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
                        const isDatastream = !!enrichedDatastreams.find(
                            ds => String(ds["@iot.id"]) === id
                        );
                        if (isDatastream) {
                            const qs: string[] = [];
                            if (networkName) qs.push(`network=${encodeURIComponent(networkName)}`);
                            if (networkId) qs.push(`id=${encodeURIComponent(networkId)}`);
                            qs.push(`expanded=${id}`);
                            const suffix = qs.length ? `?${qs.join("&")}` : "";
                            router.push(`/datastreams${suffix}`);
                        }
                    }}
                    showMap={true}
                    split={0.5}
                    setSplit={() => { }}
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

// Layout mapping
const layoutMap = {
    1: "col-span-1 md:col-span-2",
    2: "col-span-1",
    3: "col-span-1",
    4: "col-span-1"
};
