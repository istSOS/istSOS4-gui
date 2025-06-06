"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../config/site";

import fetchData from "../server/fetchData";
import fetchLogin from "../server/fetchLogin";

export const mainColor = siteConfig.main_color;

export default function Page() {
  const router = useRouter();

  React.useEffect(() => {
    async function getData() {
      const login = await fetchLogin("http://api:5000/istsos4/v1.1/Login");
      const locationData = await fetchData(
        "http://api:5000/istsos4/v1.1/Locations",
        login.access_token
      );
      console.log(locationData);
      console.log("AAAAAAAAAAA");
    }

    getData();
  }, []);

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {siteConfig.items.map((item) => (
          <div
            key={item.href}
            onClick={() => router.push(item.href)}
            className="cursor-pointer bg-teal-700 hover:bg-teal-600 transition-colors duration-200 text-white rounded-2xl shadow-lg p-9 flex flex-col items-center justify-center"
          >
            <h3 className="text-xl font-semibold">{item.label}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
