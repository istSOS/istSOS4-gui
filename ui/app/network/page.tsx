"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Card, Spinner, Divider } from "@heroui/react";
import { useEntities } from "../../context/EntitiesContext";
import { SecNavbar } from "../../components/bars/secNavbar";
import { useSearchParams } from "next/navigation";

export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

function labelToEntityKey(label: string) {
  //remove spaces and hyphens and convert first letter to lowercase
  //Example: "FeaturesOfInterest" or "Features Of Interest" → "featuresOfInterest"
  return label
    .replace(/[\s\-]/g, "") //remove spaces and hyphens
    .replace(/^([A-Z])/, (m) => m.toLowerCase()); //first letter to lowercase
}

export default function Page() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const { entities, loading: entitiesLoading, refetchAll } = useEntities();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const selectedNetwork = searchParams.get("label") || "Network";

  //refetch all entities on mount
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

  return (
    <div className="min-h-screen p-4">

      <div className="flex items-center justify-between mb-2">
        <SecNavbar 
        title={selectedNetwork} 
        />
      </div>

      <div className="max-w-7xl mx-auto grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">

        {siteConfig.items.map((item) => (
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
                {item.description}
              </div>
            </div>
          </Card>
        ))}
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

