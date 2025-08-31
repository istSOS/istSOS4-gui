/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { siteConfig } from "../../config/site";
import { SecNavbar } from "../../components/bars/secNavbar";
import { fetchData } from "../../server/api";

//export const mainColor = siteConfig.main_color;

export default function Users() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!token || authLoading) return;
    async function getData() {
      try {
        //search for item in siteConfig
        const item = siteConfig.items.find(i => i.label === "Users");
        if (!item) throw new Error("Not found");
        const data = await fetchData(item.root, token);
        setUsers(data?.value || []);
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
    () => (users.length > 0 ? Object.keys(users[0]) : []),
    [users]
  );

  const filteredUsers = users.filter(sensor =>
    JSON.stringify(sensor).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <SecNavbar />
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users..."
          className="border rounded px-3 py-2 w-full"
        />
      </div>
      <h1 className="text-2xl font-bold mb-4" style={{ color: siteConfig.main_color }}>
        Sensors
      </h1>
      {users.length === 0 ? (
        <p>No available users.</p>
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
              {filteredUsers.map((obs, index) => (
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