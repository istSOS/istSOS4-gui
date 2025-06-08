"use client";

import React from "react";
import { useRouter } from "next/navigation";

export function SecNavbar({
  searchValue,
  onSearchChange,
  placeholder = "Search...",
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between bg-white shadow px-4 py-2 mb-4 rounded">
      <button
        onClick={() => router.push("/")}
        className="text-teal-700 hover:text-teal-900 font-semibold flex items-center"
      >
        ← Back
      </button>
      <input
        type="text"
        value={searchValue}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="border rounded px-3 py-1 w-64"
      />
    </div>
  );
}