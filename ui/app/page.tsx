"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../config/site";
import { useTranslation } from "react-i18next";
import { useEntities } from "../context/EntitiesContext";

const mainColor = siteConfig.main_color;


export default function Page() {
  const router = useRouter();
  const { t } = useTranslation();
  const networks = useEntities().entities.network;
  //console.log("NETWORKS: ", networks);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">

      <h1 className="text-4xl font-bold mb-8" style={{ color: "white" }}>
        {t("general.select_network")}
      </h1>

      <div className="max-w-7xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">

        {networks.map((network) => (
          <div
            key={network.name}
            onClick={() =>
              router.push(
                `/network?id=${encodeURIComponent(network["@iot.id"])}&name=${encodeURIComponent(network.name)}`
              )
            }
            className="cursor-pointer bg-teal-700 hover:bg-teal-600 transition-colors duration-200 text-white rounded-2xl shadow-lg p-9 flex flex-col items-center justify-center"
          >
            <h3 className="text-xl font-semibold">{network.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}