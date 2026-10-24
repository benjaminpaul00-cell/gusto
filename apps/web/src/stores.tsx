// Logos des bannières (public/epiceries/, source : Wikimedia). Marques de commerce de leurs
// propriétaires, utilisées seulement pour identifier les épiceries dont les prix sont affichés.
import { Image, View, type ViewStyle } from "react-native";
import type { StoreId } from "../../../shared/options";

export const STORE_LOGO: Record<StoreId, { src: string; ratio: number }> = {
  maxi: { src: "/epiceries/maxi.svg", ratio: 117 / 60 },
  superc: { src: "/epiceries/superc.png", ratio: 523 / 190 },
  iga: { src: "/epiceries/iga.svg", ratio: 277 / 122 },
  metro: { src: "/epiceries/metro.svg", ratio: 189 / 48 },
  provigo: { src: "/epiceries/provigo.svg", ratio: 247 / 60 },
  walmart: { src: "/epiceries/walmart.svg", ratio: 1000 / 190 },
};

/** Logo d'une bannière, ajusté dans une boîte (largeur et hauteur maximales). */
export function StoreLogo({ id, maxW = 120, maxH = 44, style, label }: { id: StoreId; maxW?: number; maxH?: number; style?: ViewStyle; label: string }) {
  const { src, ratio } = STORE_LOGO[id];
  const w = Math.min(maxW, maxH * ratio);
  return (
    <View style={[{ width: w, height: w / ratio }, style]}>
      <Image source={{ uri: src }} accessibilityLabel={label} resizeMode="contain" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
