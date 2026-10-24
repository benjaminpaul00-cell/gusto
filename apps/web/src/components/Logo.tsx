// Logo Gusto : une étiquette de prix inclinée portant un « g ». Tracés vectoriels (logoPaths.ts),
// donc identiques partout et affichés sans attendre le chargement des polices.
import Svg, { Circle, G as Group, Path } from "react-native-svg";
import { View } from "react-native";
import { G, TAG, WORD, WORD_BOX } from "./logoPaths";

type Variant = "cobalt" | "lemon" | "white";
const COLORS: Record<Variant, { tag: string; g: string; dot: string; shadow: string | null }> = {
  cobalt: { tag: "#2B44FF", g: "#FFFFFF", dot: "#FF5FA2", shadow: "#0E1030" },
  lemon: { tag: "#FFE14D", g: "#0E1030", dot: "#FF5FA2", shadow: "#0E1030" },
  white: { tag: "#FFFFFF", g: "#2B44FF", dot: "#FF5FA2", shadow: "#0E1030" },
};

export function LogoMark({ size = 40, variant = "cobalt", shadow = true }: { size?: number; variant?: Variant; shadow?: boolean }) {
  const c = COLORS[variant];
  return (
    <Svg width={size} height={size} viewBox="0 0 66 66" accessibilityElementsHidden importantForAccessibility="no">
      <Group transform="rotate(-10 32 32)">
        {shadow && c.shadow ? <Path d={TAG} fill={c.shadow} transform="translate(2.5 3)" /> : null}
        <Path d={TAG} fill={c.tag} />
        <Circle cx={16.5} cy={32} r={4} fill={c.dot} />
        <Path d={G} fill={c.g} />
      </Group>
    </Svg>
  );
}

/** `fill` : occupe toute la boîte parente (pour les très grands formats). */
export function Wordmark({ height = 28, color = "#0E1030", fill }: { height?: number; color?: string; fill?: boolean }) {
  const h = WORD_BOX.bottom - WORD_BOX.top;
  return (
    <Svg width={fill ? "100%" : (height * WORD_BOX.width) / h} height={fill ? "100%" : height} viewBox={`0 ${WORD_BOX.top} ${WORD_BOX.width} ${h}`}>
      <Path d={WORD} fill={color} />
    </Svg>
  );
}

/** Symbole + nom. `inverse` : version pour fonds cobalt ou marine. */
export function Logo({ size = 40, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.2 }} accessibilityLabel="Gusto" accessibilityRole="image">
      <LogoMark size={size} variant={inverse ? "lemon" : "cobalt"} />
      <Wordmark height={size * 0.62} color={inverse ? "#FFFFFF" : "#0E1030"} />
    </View>
  );
}
