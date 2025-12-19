export const colorNameToHex = (colorName: string): string => {
  const normalizedColor = colorName.toLowerCase().trim();

  const colorMap: Record<string, string> = {
    // --- Standard & Provided Colors (Preserved) ---
    lavender: "#E6E6FA",
    brown: "#8B4513",
    "light pink": "#FFB6C1",
    black: "#000000",
    "soft pink": "#FDB0C0",
    charcoal: "#36454F",
    natural: "#F5F5DC",
    "light yellow": "#FFFFE0",
    "vintage denim": "#798FA8",
    "heather gray": "#9AA297",
    "grey heather": "#9AA297",
    army: "#4B5320",
    burgundy: "#800020",
    "athletic heather": "#BEBEBE",
    "military green": "#556B2F",
    "blue aqua": "#00FFFF",
    dust: "#d4cdbc",
    white: "#FFFFFF",
    "classic navy": "#000080",
    "dark maroon": "#3F0000",
    sand: "#C2B280",
    forest: "#228B22",
    "sport dark navy": "#0A0A2A",
    "cloudy blue": "#ACC2D9",
    ivory: "#FFFFF0",
    sandstone: "#786D5F",
    maroon: "#800000",
    "sport dark green": "#013220",
    bone: "#E3DAC9",
    seafoam: "#9FE2BF",
    "light blue": "#ADD8E6",
    cream: "#FFFDD0",
    "sport grey": "#808080",
    banana: "#FFE135",
    "sport scarlet red": "#FF2400",
    "dark grey": "#A9A9A9",
    "dark gray": "#A9A9A9",
    red: "#FF0000",
    chambray: "#7D8E9E",
    "blue magic": "#5D79BA",
    terracotta: "#E2725B",
    bay: "#7A977D",
    navy: "#000080",
    wine: "#722F37",
    shiitake: "#7D7066",

    // --- Base & Expanded Fallback Colors ---

    // Blues
    blue: "#0000FF",
    royal: "#4169E1",
    indigo: "#4B0082",
    denim: "#1560BD",
    cyan: "#00FFFF",
    sky: "#87CEEB",
    midnight: "#191970",
    cobalt: "#0047AB",
    periwinkle: "#CCCCFF",
    slate: "#708090",

    // Greens
    green: "#008000",
    teal: "#008080",
    olive: "#808000",
    sage: "#BCB88A",
    lime: "#00FF00",
    mint: "#3EB489",
    emerald: "#50C878",
    kelly: "#4CBB17",
    jade: "#00A86B",
    moss: "#8A9A5B",
    hunter: "#355E3B",

    // Reds / Pinks / Purples
    pink: "#FFC0CB",
    purple: "#800080",
    rose: "#FF007F",
    coral: "#FF7F50",
    berry: "#990F4B",
    blush: "#DE5D83",
    mauve: "#E0B0FF",
    lilac: "#C8A2C8",
    crimson: "#DC143C",
    brick: "#CB4154",
    cardinal: "#C41E3A",
    fuchsia: "#FF00FF",
    magenta: "#FF00FF",
    plum: "#8E4585",
    garnet: "#733635",

    // Yellows / Oranges
    yellow: "#FFFF00",
    orange: "#FFA500",
    gold: "#FFD700",
    mustard: "#FFDB58",
    peach: "#FFE5B4",
    amber: "#FFBF00",
    "safety orange": "#FF5F15",
    "safety yellow": "#EED202",

    // Browns / Earth Tones
    tan: "#D2B48C",
    beige: "#F5F5DC",
    khaki: "#C3B091",
    taupe: "#483C32",
    mocha: "#967969",
    chocolate: "#7B3F00",
    rust: "#B7410E",
    copper: "#B87333",
    bronze: "#CD7F32",
    clay: "#CC7A00",
    camel: "#C19A6B",
    stone: "#888C8D",

    // Grays / Neutrals
    gray: "#808080",
    grey: "#808080",
    silver: "#C0C0C0",
    heather: "#9AA297", // Common catch-all for heathers
    ash: "#B2BEB5",
    oxford: "#CCCFE0", // Oxford grey/blue
    graphite: "#3A3A3A",
    cement: "#8E918F",
    smoke: "#738276",
    platinum: "#E5E4E2",
    steel: "#4682B4",
  };

  // 1. Exact match (after normalization)
  if (colorMap[normalizedColor]) {
    return colorMap[normalizedColor];
  }

  // 2. Fallback: Check for base colors in the string
  // Order priority: Specific shades first (e.g., "royal" before "blue")
  const baseColors = [
    // Complex/Specific Shades
    "midnight",
    "royal",
    "navy",
    "sky",
    "cyan",
    "indigo",
    "cobalt",
    "periwinkle",
    "slate",
    "steel",
    "emerald",
    "lime",
    "mint",
    "olive",
    "sage",
    "kelly",
    "jade",
    "moss",
    "hunter",
    "teal",
    "rose",
    "coral",
    "fuchsia",
    "magenta",
    "mauve",
    "lilac",
    "crimson",
    "brick",
    "cardinal",
    "berry",
    "blush",
    "plum",
    "garnet",
    "mustard",
    "peach",
    "amber",
    "gold",
    "khaki",
    "taupe",
    "mocha",
    "chocolate",
    "rust",
    "copper",
    "bronze",
    "clay",
    "camel",
    "stone",
    "silver",
    "platinum",
    "ash",
    "oxford",
    "graphite",
    "cement",
    "smoke",
    "charcoal",

    // Common Base Colors
    "maroon",
    "burgundy",
    "wine",
    "blue",
    "green",
    "pink",
    "yellow",
    "purple",
    "orange",
    "red",
    "white",
    "black",
    "brown",
    "cream",
    "sand",
    "ivory",
    "bone",
    "gray",
    "grey",
    "heather",
    "denim",
    "tan",
    "beige",
    "lavender",
  ];

  for (const base of baseColors) {
    if (normalizedColor.includes(base)) {
      if (colorMap[base]) {
        return colorMap[base];
      }
    }
  }

  // 3. Absolute fallback
  return "#000000";
};
