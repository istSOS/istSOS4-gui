"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import { useAuth } from "../../context/AuthContext";

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
        const datastreamsData = await fetchData(
          "http://api:5000/istsos4/v1.1/Datastreams",
          token
        );
        setDatastreams(datastreamsData?.value || []);
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
    () => (datastreams.length > 0 ? Object.keys(datastreams[0]) : []),
    [datastreams]
  );

  const filteredObservations = datastreams.filter(obs =>
    JSON.stringify(obs).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search datastrams..."
      />
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Observations
      </h1>
      {datastreams.length === 0 ? (
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