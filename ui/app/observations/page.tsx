"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";

export const mainColor = siteConfig.main_color;

export default function Observations() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [observations, setObservations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!token || authLoading) return;
    async function getData() {
      try {
        const observationData = await fetchData(
          "http://api:5000/istsos4/v1.1/Observations",
          token
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
  }, [token, authLoading]);

  const columns = React.useMemo(
    () => (observations.length > 0 ? Object.keys(observations[0]) : []),
    [observations]
  );

  const filteredObservations = observations.filter(obs =>
    JSON.stringify(obs).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search observations..."
      />
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Observations
      </h1>
      {observations.length === 0 ? (
        <p>No available observations.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-max table-auto border border-gray-300 bg-white">
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
              {filteredObservations.map((obs, index) => (
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