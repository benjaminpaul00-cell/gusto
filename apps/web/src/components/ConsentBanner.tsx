// Bandeau de consentement aux témoins (Loi 25). Refuser est aussi simple qu'accepter.
import { Link } from "expo-router";
import { Cookie } from "lucide-react-native";
import { Text, View } from "react-native";
import { font, r, radius, space, useTheme } from "../theme";
import type { Consent } from "../storage";
import { Button } from "./ui";

export function ConsentBanner({ onChoose }: { onChoose: (c: Consent) => void }) {
  const t = useTheme();
  return (
    <View
      role="dialog"
      aria-label="Témoins publicitaires"
      {...r("pop-in")}
      style={{
        position: "absolute", left: space(4), right: space(4), bottom: space(4), maxWidth: 440,
        padding: space(5), borderRadius: radius.lg, backgroundColor: t.surface, borderWidth: 2, borderColor: t.edge,
        gap: space(4), boxShadow: t.shadowLg, zIndex: 50,
      } as any}
    >
      <View style={{ flexDirection: "row", gap: space(3) }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.tag, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
          <Cookie size={20} color="#0E1030" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1, gap: space(1) }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: t.ink }}>Gusto est gratuit grâce à la pub</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: t.muted }}>
            Google utilise des témoins pour afficher des annonces. Tes choix de menu restent sur ton appareil.{" "}
            <Link href="/confidentialite" style={{ color: t.primary, textDecorationLine: "underline" }}>En savoir plus</Link>
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space(3), justifyContent: "flex-end", flexWrap: "wrap" }}>
        <Button label="Refuser" variant="secondary" size="sm" onPress={() => onChoose("essential")} a11y="Refuser les témoins publicitaires" />
        <Button label="Accepter" size="sm" onPress={() => onChoose("all")} a11y="Accepter les témoins publicitaires" />
      </View>
    </View>
  );
}
