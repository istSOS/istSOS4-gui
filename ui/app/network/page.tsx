"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Card, Spinner, Divider } from "@heroui/react";
import { useEntities } from "../../context/EntitiesContext";

export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

export default function Page() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const { entities, loading: entitiesLoading, refetchAll } = useEntities();
  const [hovered, setHovered] = React.useState<string | null>(null);

    //refetch all entities on mount
    React.useEffect(() => {
      refetchAll();
    }, []);

  const countsMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    siteConfig.items.forEach(item => {
      // Assumendo che la chiave sia il label in minuscolo (es: "things")
      const key = item.label.toLowerCase();
      map[item.label] = Array.isArray((entities as any)[key]) ? (entities as any)[key].length : 0;
    });
    return map;
  }, [entities]);

  const loading = authLoading || entitiesLoading;

  return (
    <div className="min-h-screen py-4 px-8 sm:px-6 lg:px-8">
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
                className={`text-sm mt-1 transition-all duration-300 ease-in-out overflow-hidden ${
                  hovered === item.label
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

