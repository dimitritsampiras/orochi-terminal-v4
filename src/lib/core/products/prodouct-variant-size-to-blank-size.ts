import { garmentSize } from "@drizzle/schema";

type GarmentSize = (typeof garmentSize.enumValues)[number];

// used to be named productVariantTitleToBlankSize
export const prodouctVariantSizeToBlankSize = (title: string) => {
  const SIZES: Record<GarmentSize, string[]> = {
    os: ["os", "onesize"],
    xs: ["xs", "extra small", "xsmall"],
    sm: ["s", "small", "sm"],
    md: ["m", "medium", "med", "md"],
    lg: ["l", "large"],
    xl: ["xl", "extra large", "xlarge"],
    "2xl": ["2xl", "xxl", "2xlarge"],
    "3xl": ["3xl", "xxxl", "3xlarge"],
    "4xl": ["4xl", "xxxxl", "4xlarge"],
    "5xl": ["5xl", "xxxxxl", "5xlarge"],
  };

  for (const [size, aliases] of Object.entries(SIZES)) {
    if (aliases.includes(title.toLowerCase())) {
      return size;
    }
  }
};
