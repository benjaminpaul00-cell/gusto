import { useColorScheme } from "react-native";

// Identité « Pop québécois » : cobalt, rose vif, citron, marine. Bordures franches et ombres décalées.
const light = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4FF", // teinte cobalt très pâle
  ink: "#0E1030", // marine
  muted: "#585D82",
  line: "#E2E4F4",
  edge: "#0E1030", // bordures et ombres « pop »
  primary: "#2B44FF", // cobalt
  primarySoft: "#E9ECFF",
  onPrimary: "#FFFFFF",
  pink: "#FF5FA2",
  pinkSoft: "#FFE4F0",
  tag: "#FFE14D", // citron : étiquette de prix
  tagSoft: "#FFF7CC",
  onTag: "#0E1030",
  brand: "#2B44FF", // grands aplats de couleur
  onBrand: "#FFFFFF",
  onBrandMuted: "#C9D0FF",
  sale: "#E0287A",
  danger: "#D42A4F",
  shadow: "4px 4px 0 #0E1030",
  shadowLg: "8px 8px 0 #0E1030",
  soft: "0 20px 50px -20px rgba(14,16,48,0.25)",
};

const dark: typeof light = {
  bg: "#0B0D26",
  surface: "#14173A",
  surfaceAlt: "#1A1E4A",
  ink: "#F4F5FF",
  muted: "#A6ABD6",
  line: "#2A2F66",
  edge: "#03041A",
  primary: "#5B6EFF",
  primarySoft: "#20265C",
  onPrimary: "#FFFFFF",
  pink: "#FF6FAC",
  pinkSoft: "#3A1D3A",
  tag: "#FFE14D",
  tagSoft: "#3A3518",
  onTag: "#0E1030",
  brand: "#2B44FF",
  onBrand: "#FFFFFF",
  onBrandMuted: "#C9D0FF",
  sale: "#FF7FB4",
  danger: "#FF8A9E",
  shadow: "4px 4px 0 #03041A",
  shadowLg: "8px 8px 0 #03041A",
  soft: "0 20px 50px -20px rgba(0,0,0,0.6)",
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);

// Une famille par graisse : sur le web, chaque graisse est une police distincte.
export const font = {
  display: "PlusJakartaSans_800ExtraBold",
  displayMedium: "PlusJakartaSans_700Bold",
  displayItalic: "InstrumentSerif_400Regular_Italic", // mots mis en valeur dans les titres
  serif: "InstrumentSerif_400Regular_Italic",
  body: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
};

export const space = (n: number) => n * 4;
export const radius = { sm: 10, md: 16, lg: 22, xl: 30 };
export const MAX_WIDTH = 720; // colonne de lecture
export const WIDE = 1200; // sections de l'accueil

/**
 * Règles CSS (responsive et animations) définies dans app/+html.tsx, présentes dès le HTML statique.
 * Exemple : <View {...r("reveal", "stack-md")}>.
 */
export const r = (...names: string[]) => ({ dataSet: { r: names.join(" ") } }) as any;

export const money = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });
