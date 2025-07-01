"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Input, Divider } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";

export const mainColor = siteConfig.main_color;

export default function Datastreams() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [datastreams, setDatastreams] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!token || authLoading) return;
    async function getData() {
      try {
        //search for item in siteConfig
        const item = siteConfig.items.find(i => i.label === "Datastreams");
        if (!item) throw new Error("Not found");
        const data = await fetchData(item.fetch, token);
        setDatastreams(data?.value || []);
      } catch (err) {
        console.error(err);
        setError("Error during data loading.");
      } finally {
        setLoading(false);
      }
    }
    getData();
  }, [token, authLoading]);

  const filtered = datastreams.filter(ds =>
    JSON.stringify(ds).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">

      <SecNavbar
        title="Datastreams"
      />
      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0", }}
      ></Divider>
      
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search datastreams..."
      />

      {filtered.length === 0 ? (
        <p>No available datastreams.</p>
      ) : (

        <Accordion variant="splitted">
          {filtered.map((ds, idx) => (
            <AccordionItem
              key={ds["@iot.id"] ?? idx}
              title={
                <div className="flex items-baseline gap-3">
                  <span className="font-bold text-lg text-gray-800">{ds.name ?? "-"}</span>
                  <span className="text-xs text-gray-500">{ds.description ?? "-"}</span>
                </div>
              }
            >
              <div className="mt-2 flex flex-row gap-8">

                {/* SX col with self attributes */}
                <div className="flex-1 flex flex-col gap-2">
                  {Object.entries(ds).map(([key, value]) =>
                    (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[a-z]/.test(key)) ? null : (
                      <div key={key} className="flex items-center gap-2">
                        <label className="w-40 text-sm text-gray-700">
                          {key.includes("@iot") ? key.split("@")[0] : key}
                        </label>
                        <Input
                          size="sm"
                          readOnly
                          value={
                            typeof value === "object"
                              ? JSON.stringify(value)
                              : value?.toString() ?? "-"
                          }
                          className="flex-1"
                        />
                      </div>
                    )
                  )}
                </div>

                {/* vertical divider */}
                <div className="w-px bg-gray-300 mx-4" />

                {/* DX col with linked attributes */}
                <div className="flex-1 flex flex-col gap-2">
                  {Object.entries(ds).map(([key, value]) =>
                    (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[A-Z]/.test(key)) ? null : (
                      <div key={key} className="flex items-center gap-2">
                        <label className="w-40 text-sm text-gray-700">
                          {key.includes("@iot") ? key.split("@")[0] : key}
                        </label>
                        <Button
                          size="sm"
                          variant="solid"
                          onPress={() => {
                            alert(`Go to ${value}`);
                          }}
                        >
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value).split("/").pop() || String(value)}
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}