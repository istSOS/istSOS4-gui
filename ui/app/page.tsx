"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "../config/site";

export const mainColor = siteConfig.main_color;

export default function Page() {
  const router = useRouter();

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {siteConfig.networks.map((network) => (
          <div
            key={network.href}
            onClick={() => router.push(network.href)}
            className="cursor-pointer bg-teal-700 hover:bg-teal-600 transition-colors duration-200 text-white rounded-2xl shadow-lg p-9 flex flex-col items-center justify-center"
          >
            <h3 className="text-xl font-semibold">{network.label}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}