// L'élément signature de Gusto : l'étiquette citron des circulaires.
import { StyleSheet, Text, View } from "react-native";
import { font, money, useTheme } from "../theme";
import { CountUp } from "./CountUp";

export function PriceTag({ amount, caption, size = "lg", tilt = true, animate }: { amount: number; caption?: string; size?: "lg" | "sm"; tilt?: boolean; animate?: boolean }) {
  const t = useTheme();
  const big = size === "lg";
  return (
    <View style={[styles.tag, { backgroundColor: t.tag, borderColor: t.edge, transform: [{ rotate: tilt && big ? "-4deg" : "0deg" }], boxShadow: big ? `5px 5px 0 ${t.edge}` : undefined } as any, big ? styles.lg : styles.sm]}>
      <View style={[styles.hole, { backgroundColor: t.pink, borderColor: t.edge }, !big && { width: 7, height: 7, borderWidth: 1.5 }]} />
      <View>
        {animate
          ? <CountUp to={amount} format={money} style={[styles.amount, { color: t.onTag, fontSize: big ? 38 : 17, lineHeight: big ? 44 : 22 }]} />
          : <Text style={[styles.amount, { color: t.onTag, fontSize: big ? 38 : 17, lineHeight: big ? 44 : 22 }]}>{money(amount)}</Text>}
        {caption ? <Text style={[styles.caption, { color: t.onTag }]}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: 12, borderWidth: 2 },
  lg: { paddingVertical: 10, paddingRight: 22, paddingLeft: 16, gap: 14 },
  sm: { paddingVertical: 3, paddingRight: 10, paddingLeft: 8, gap: 8, borderRadius: 8 },
  hole: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  amount: { fontFamily: font.display, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  caption: { fontSize: 12.5, fontFamily: font.semibold, marginTop: 0, opacity: 0.85 },
});
