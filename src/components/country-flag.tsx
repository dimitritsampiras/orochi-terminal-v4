import React from "react";

interface CountryFlagProps {
  countryName?: string | null;
  countryCode: string;
}

export function CountryFlag({ countryName, countryCode }: CountryFlagProps) {
  const flagClass = `fi fi-${countryCode.toLowerCase()}`;

  if (countryName) {
    return (
      <div className="flex items-center gap-2 font-medium">
        <div className={flagClass} />
        <div>{countryName}</div>
      </div>
    );
  }

  return <div className={flagClass} />;
}
