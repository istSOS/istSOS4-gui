"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import fetchData from "../../server/fetchData";
import fetchLogin from "../../server/fetchLogin";
import { t } from "framer-motion/dist/types.d-CtuPurYT";

export const mainColor = siteConfig.main_color;

export default function Sensors() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sensors, setSensors] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    async function getData() {
      try {
        
        const sensorData = await fetchData(
          "http://api:5000/istsos4/v1.1/Sensors",
          token
        );
        setSensors(sensorData?.value || []);
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
    () => (sensors.length > 0 ? Object.keys(sensors[0]) : []),
    [sensors]
  );

  const filteredSensors = sensors.filter(sensor =>
    JSON.stringify(sensor).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search sensors..."
      />
      <h1 className="text-2xl font-bold mb-4" style={{ color: mainColor }}>
        Sensors
      </h1>
      {sensors.length === 0 ? (
        <p>No available sensors.</p>
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
              {filteredSensors.map((obs, index) => (
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




