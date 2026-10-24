// Logo « mon gusto » : image (assets/logo.png), avec une version claire pour les fonds sombres
// (assets/logo-clair.png : le marine de « mon » et de la toque passe au blanc).
// Images produites à partir du logo original ; voir aussi public/logo*.png, favicon.png, icon-512.png et og.png.
import { Image, useColorScheme, View } from "react-native";

const DARK_TEXT = require("../../assets/logo.png");
const LIGHT_TEXT = require("../../assets/logo-clair.png");
export const LOGO_RATIO = 600 / 387; // largeur / hauteur

/**
 * Logo complet. `size` : hauteur de référence (le logo fait 1,4 × cette hauteur).
 * `inverse` : version pour fonds cobalt ou marine. Sans `inverse`, suit le mode clair ou sombre de l'appareil.
 * `width` : largeur imposée (le logo s'adapte), pour les très grands formats.
 */
export function Logo({ size = 40, inverse, width }: { size?: number; inverse?: boolean; width?: number | `${number}%` }) {
  const dark = useColorScheme() === "dark";
  const light = inverse ?? dark;
  const h = size * 1.4;
  return (
    <View accessibilityLabel="mon gusto" accessibilityRole="image" style={width ? { width, aspectRatio: LOGO_RATIO } : { width: h * LOGO_RATIO, height: h }}>
      <Image source={light ? LIGHT_TEXT : DARK_TEXT} style={{ width: "100%", height: "100%" }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}
