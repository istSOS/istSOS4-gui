"use client";

const item = siteConfig.items.find(i => i.label === "Things");

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Divider, Input } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";
import DeleteButton from "../../components/customButtons/deleteButton";
import { useEntities } from "../../context/EntitiesContext";

export const mainColor = siteConfig.main_color;

export default function Things() {

  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [things, setThings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const { entities, loading: entitiesLoading, error: entitiesError, refetchAll } = useEntities();

  //refetch all entities on mount
  React.useEffect(() => {
    refetchAll();
  }, []);

  React.useEffect(() => {
    setThings(entities.things);
    setLoading(entitiesLoading);
    setError(entitiesError);
  }, [entities, entitiesLoading, entitiesError]);

  const filtered = things.filter(thing =>
    JSON.stringify(thing).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">

      <SecNavbar
        title="Things"
      />

      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0", }}
      ></Divider>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search things..."
      />

      {filtered.length === 0 ? (
        <p>No available things.</p>
      ) : (

        <Accordion variant="splitted">
          {filtered.map((tgs, idx) => (
            <AccordionItem
              key={tgs["@iot.id"] ?? idx}
              title={
                <div className="flex items-baseline gap-3">
                  <span className="font-bold text-lg text-gray-800">{tgs.name ?? "-"}</span>
                  <span className="text-xs text-gray-500">{tgs.description ?? "-"}</span>
                </div>
              }
            >
              <div className="mt-2 flex flex-row gap-8">

                {/* SX col with self attributes */}
                <div className="flex-1 flex flex-col gap-2">
                  {Object.entries(tgs).map(([key, value]) =>
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
                  {Object.entries(tgs).map(([key, value]) =>
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

                  {/* EDIT AND DELETE BUTTONS */}
                  <div className="flex justify-end mt-4 gap-2 relative">

                    <Button color="warning" variant="bordered">
                      Edit
                    </Button>

                    <DeleteButton
                      endpoint={`${item.root}(${tgs["@iot.id"]})`}
                      token={token}
                      onDeleted={() =>
                        setThings(prev => prev.filter(o => o["@iot.id"]
                          !== tgs["@iot.id"]))}
                    />
                  </div>

                </div>

              </div>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}