import { cn } from "@/lib/utils";
import React from "react";

interface CountryFlagProps {
  countryName?: string | null;
  countryCode: string;
  className?: string;
}

export function CountryFlag({ countryName, countryCode, className }: CountryFlagProps) {
  const flagClass = `fi fi-${countryCode.toLowerCase()}`;

  if (countryName) {
    return (
      <div className={cn("flex items-center gap-2 font-medium", className)}>
        <div className={flagClass} />
        <div>{countryName}</div>
      </div>
    );
  }

  return <div className={flagClass} />;
}
