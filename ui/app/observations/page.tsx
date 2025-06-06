"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import fetchData from "../../server/fetchData";
import fetchLogin from "../../server/fetchLogin";

export const mainColor = siteConfig.main_color;

export default function Observations() {
  const router = useRouter();
  const [observations, setObservations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function getData() {
      try {
        const login = await fetchLogin("http://api:5000/istsos4/v1.1/Login");
        const observationData = await fetchData(
          "http://api:5000/istsos4/v1.1/Observations",
          login.access_token
        );
        setObservations(observationData?.value || []);
      } catch (err) {
        console.error(err);
        setError("Error during data loading.");
      } finally {
        setLoading(false);
      }
    }

    getData();
  }, []);

  // Colonne dinamiche in base ai dati ricevuti
  const columns = React.useMemo(
    () => (observations.length > 0 ? Object.keys(observations[0]) : []),
    [observations]
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Observations
      </h1>
      {observations.length === 0 ? (
        <p>No available observations.</p>
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
              {observations.map((obs, index) => (
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




