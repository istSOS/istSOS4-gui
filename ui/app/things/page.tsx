"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import fetchLogin from "../../server/fetchLogin";

export const mainColor = siteConfig.main_color;

export default function Things() {
  const router = useRouter();
  const [things, setThings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    async function getData() {
      try {
        const login = await fetchLogin("http://api:5000/istsos4/v1.1/Login");
        const thingData = await fetchData(
          "http://api:5000/istsos4/v1.1/Things",
          login.access_token
        );
        setThings(thingData?.value || []);
      } catch (err) {
        console.error(err);
        setError("Error during data loading.");
      } finally {
        setLoading(false);
      }
    }

    getData();
  }, []);

  const columns = React.useMemo(
    () => (things.length > 0 ? Object.keys(things[0]) : []),
    [things]
  );

  const filteredThings = things.filter(thing =>
    JSON.stringify(thing).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search things..."
      />
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Things
      </h1>
      {things.length === 0 ? (
        <p>No available things.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-max table-auto border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2 border">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredThings.map((obs, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 border">
                      {typeof obs[col] === "object"
                        ? JSON.stringify(obs[col])
                        : obs[col]?.toString() ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

}




