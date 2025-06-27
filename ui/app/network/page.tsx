"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Card, Button, Spinner, Divider } from "@heroui/react";

export const mainColor = siteConfig.main_color;
export const secondaryColor = siteConfig.secondary_color;

export default function Page() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [countsMap, setCountsMap] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token || authLoading) return;
    async function getCounts() {
      setLoading(true);
      try {
        const entries = await Promise.all(
          siteConfig.items.map(async (item) => {
            try {
              const data = await fetchData(item.fetch, token);
              const count = Array.isArray(data?.value) ? data.value.length : 0;
              return [item.label, count] as [string, number];
            } catch {
              return [item.label, 0] as [string, number];
            }
          })
        );
        setCountsMap(Object.fromEntries(entries));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    getCounts();
  }, [token, authLoading]);
  

  return (
    
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">

        {siteConfig.items.map((item) => (
          <div
            key={item.href}
            onClick={() => router.push(item.href)}
            
            className="cursor-pointer bg-teal-700 hover:bg-teal-600 transition-colors duration-200 text-white rounded-2xl shadow-lg p-9 flex flex-col"
          >
            <h3 className="text-lg font-medium text-white mb-2">{item.label}</h3>
            <div className="text-4xl font-bold text-white mb-4">
              {loading
                ? "Loading..."
                : countsMap[item.label] !== undefined
                ? countsMap[item.label]
                : "0"}
            </div>
            <div className="mt-auto text-sm text-white hover:text-blue-200 self-end">
              See more...
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}