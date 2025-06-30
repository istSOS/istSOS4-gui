"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";

export function SecNavbar({
  title = "",
  showBack = true,
  onBack,
}: {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex mb-4 items-center gap-4">
      {showBack && (
        <Button
          isIconOnly
          onPress={onBack ? onBack : () => window.history.back()}
        >
          ←
        </Button>
      )}
      <h1 className="text-4xl font-bold" style={{ color: "white" }}>
        {title}
      </h1>
    </div>
  );
}