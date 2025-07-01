"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";
import { Accordion, AccordionItem, Button, Divider, Input } from "@heroui/react";
import { SearchBar } from "../../components/bars/searchBar";

export const mainColor = siteConfig.main_color;



export default function Observations() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [observations, setObservations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showConfirm, setShowConfirm] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDeleteObservation(id: number) {
    setDeleting(true);
    try {
      //header with token
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };

      const res = await fetch(`${siteConfig.api_root}Observations(${id})`, {
        method: "DELETE",
        headers,
      });

      //handling https error
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Delete failed");
      }

      //update status and ui
      setObservations(prev => prev.filter(obs => obs["@iot.id"] !== id));
      setShowConfirm(null);
    } catch (err: any) {
      //error message
      alert(`Error deleting observation: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }


  React.useEffect(() => {
    if (!token || authLoading) return;
    async function getData() {
      try {
        const item = siteConfig.items.find(i => i.label === "Observations");
        if (!item) throw new Error("Not found");
        const data = await fetchData(item.fetch, token);
        setObservations(data?.value || []);
      } catch (err) {
        console.error(err);
        setError("Error during data loading.");
      } finally {
        setLoading(false);
      }
    }
    getData();
  }, [token, authLoading]);

  const filtered = observations.filter(obs =>
    JSON.stringify(obs).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">

      <SecNavbar
        title="Observations"
      />
      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0", }}
      ></Divider>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search observations..."
      />

      {filtered.length === 0 ? (
        <p>No available observations.</p>
      ) : (
        <Accordion variant="splitted">
          {filtered.map((obs, idx) => (
            <AccordionItem
              key={obs["@iot.id"] ?? idx}
              title={
                <div className="flex items-baseline gap-3">
                  <span className="font-bold text-lg text-gray-800">{obs.name ?? "-"}</span>
                  <span className="text-xs text-gray-500">{obs.description ?? "-"}</span>
                </div>
              }
            >
              <div className="mt-2 flex flex-row gap-8">
                <div className="flex-1 flex flex-col gap-2">
                  {Object.entries(obs).map(([key, value]) =>
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
                <div className="w-px bg-gray-300 mx-4" />
                <div className="flex-1 flex flex-col gap-2">
                  {Object.entries(obs).map(([key, value]) =>
                    (value == null || key == "@iot.id" || key == "@iot.selfLink" || !/^[A-Z]/.test(key)) ? null : (
                      <div key={key} className="flex items-center gap-2">
                        <label className="w-40 text-sm text-gray-700">
                          {key.includes("@iot") ? key.split("@")[0] : key}
                        </label>

                        {/* Entity links */}
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

                  {/* EDIT AND DELETE BUTTONS WITH CONFIRMATION */}
                  <div className="flex justify-end mt-4 gap-2 relative">
                    {showConfirm === idx && (
                      <div className="absolute right-0 -top-24 bg-white border rounded shadow-lg p-4 z-10 flex flex-col items-center">
                        <p className="mb-2 text-sm">Are you sure?</p>
                        <div className="flex gap-2">
                          <Button
                            color="danger"
                            size="sm"
                            onPress={() => 
                              handleDeleteObservation(obs["@iot.id"])
                            }
                            isLoading={deleting && showConfirm === obs["@iot.id"]}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="bordered"
                            onPress={() => {
                              setShowConfirm(null);
                            }}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    )}
                    <Button color="warning" variant="bordered">
                      Edit
                    </Button>
                    <Button
                      color="danger"

                      onPress={() => setShowConfirm(idx)}
                    >
                      Delete
                    </Button>
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