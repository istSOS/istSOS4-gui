"use client";
import { Spinner } from "@heroui/react";
import * as React from "react";

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" variant="simple" color="default" />
    </div>
  );
}