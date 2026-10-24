// Pied de page : de vrais liens <a> (utiles aux visiteurs et à Google) et un grand logo final.
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { font, r, space, WIDE } from "../theme";
import { LogoMark, Wordmark } from "./Logo";

const NAVY = "#0E1030";
const COLUMNS = [
  { title: "Gusto", links: [
    { href: "/#planificateur", label: "Créer un menu" },
    { href: "/#comment", label: "Comment ça marche" },
    { href: "/a-propos", label: "À propos" },
  ] },
  { title: "Ressources", links: [
    { href: "/guides", label: "Guides" },
    { href: "/cuisines", label: "Cuisines" },
    { href: "/guides/epicerie-petit-budget", label: "Épicerie à petit budget" },
  ] },
  { title: "Légal", links: [
    { href: "/confidentialite", label: "Confidentialité et témoins" },
  ] },
];

export function SiteFooter() {
  return (
    <View role="contentinfo" style={{ backgroundColor: NAVY, overflow: "hidden" }}>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: WIDE, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(20) }}>
        <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(16), justifyContent: "space-between" }}>
          <View style={{ maxWidth: 360, gap: space(5) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
              <LogoMark size={44} variant="lemon" />
              <Wordmark height={27} color="#FFFFFF" />
            </View>
            <Text style={{ fontFamily: font.medium, fontSize: 15.5, lineHeight: 25, color: "#B9BEE6" }}>
              Des menus et des listes d’épicerie au prix de ton épicerie, sans jamais dépasser ton budget. Gratuit, sans compte, fait au Québec.
            </Text>
          </View>
          <View {...r("stack-sm")} style={{ flexDirection: "row", gap: space(16) }}>
            {COLUMNS.map((c) => (
              <View key={c.title} role="navigation" style={{ gap: space(3), minWidth: 150 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase", color: "#FFE14D" }}>{c.title}</Text>
                {c.links.map((l) => (
                  <Link key={l.href} href={l.href as any} {...r("dim")} style={{ fontFamily: font.medium, fontSize: 15.5, color: "#FFFFFF" }}>{l.label}</Link>
                ))}
              </View>
            ))}
          </View>
        </View>
        <View {...r("stack-sm")} style={{ marginTop: space(16), paddingTop: space(6), borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)", flexDirection: "row", justifyContent: "space-between", gap: space(3) }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: "#9097C8" }}>© {new Date().getFullYear()} Gusto · Fait au Québec</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: "#9097C8", maxWidth: 600 }}>
            Prix fournis par épiceries.ca, à titre indicatif. Logos des épiceries : marques de leurs propriétaires. Recettes et images générées par intelligence artificielle.
          </Text>
        </View>
      </View>
      {/* Grand logo qui déborde en bas de page */}
      <View aria-hidden style={{ alignItems: "center", marginTop: space(10), marginBottom: -40, opacity: 0.95 }}>
        <View style={{ width: "92%", maxWidth: WIDE, aspectRatio: 172 / 58 }}>
          <Wordmark fill color="#2B44FF" />
        </View>
      </View>
    </View>
  );
}
