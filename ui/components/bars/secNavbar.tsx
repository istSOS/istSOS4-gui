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
    <div className="flex items-center gap-4">
      {showBack && (
        <Button
          radius="sm"
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