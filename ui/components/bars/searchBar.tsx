import * as React from "react";
import { Input, Button } from "@heroui/react";
import { t } from "i18next";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = t("general.search"),
  className = "w-64",
}: SearchBarProps) {
  return (
    <div className="flex">
      <Input
        radius = "sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </div>
  );
}