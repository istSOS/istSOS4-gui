"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import fetchLogin from "../../server/fetchLogin";

export const mainColor = siteConfig.main_color;

export default function Locations() {
  const router = useRouter();
  const [locations, setLocations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function getData() {
      try {
        const login = await fetchLogin("http://api:5000/istsos4/v1.1/Login");
        const locationData = await fetchData(
          "http://api:5000/istsos4/v1.1/Locations",
          login.access_token
        );
        setLocations(locationData?.value || []);
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
    () => (locations.length > 0 ? Object.keys(locations[0]) : []),
    [locations]
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Locations
      </h1>
      {locations.length === 0 ? (
        <p>No available locations.</p>
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
              {locations.map((obs, index) => (
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




