import * as React from "react";
import { Input, Button } from "@heroui/react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "w-64",
}: SearchBarProps) {
  return (
    <div className="flex mb-4">
      <Input
        size="sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </div>
  );
}