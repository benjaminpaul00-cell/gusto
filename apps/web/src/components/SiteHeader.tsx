// En-tête du site : logo, navigation, bouton principal.
// Sur téléphone, la navigation devient une rangée de boutons défilable sous l'en-tête, toujours visible.
import { Link, usePathname } from "expo-router";
import { ArrowRight, BookOpen, Compass, HelpCircle, Lightbulb, Tag } from "lucide-react-native";
import { useRef } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { font, r, space, useTheme, WIDE } from "../theme";
import { Logo, LOGO_RATIO } from "./Logo";
import { Button } from "./ui";

// Fleurdelisé hissé sur un mât (scripts/drapeau-mat.mjs) : le pied du mât passe derrière la toque du chef
const FLAG = require("../../assets/drapeau-mat.png");
const LOGO_SIZE = 46;
const LOGO_H = LOGO_SIZE * 1.4;
const LOGO_W = LOGO_H * LOGO_RATIO;
const FLAG_W = 60;
const FLAG_H = FLAG_W * (410 / 520); // proportions de assets/drapeau-mat.png

const NAV = [
  { href: "/recettes", label: "Recettes", icon: BookOpen },
  { href: "/prix", label: "Prix", icon: Tag },
  { href: "/#comment", label: "Comment ça marche", icon: HelpCircle },
  { href: "/guides", label: "Guides", icon: Lightbulb },
  { href: "/cuisines", label: "Cuisines", icon: Compass },
];
// Ordre sur téléphone : les pages les plus utiles d'abord
const MOBILE = ["/recettes", "/prix", "/cuisines", "/guides", "/#comment"].map((h) => NAV.find((n) => n.href === h)!);

export function SiteHeader({ onCta }: { onCta?: () => void }) {
  const t = useTheme();
  const path = usePathname();
  const row = useRef<ScrollView>(null);
  const active = (href: string) => !href.includes("#") && (path === href || path.startsWith(`${href}/`) || (href === "/recettes" && path === "/recette"));
  return (
    <View role="banner" style={{ backgroundColor: t.bg, borderBottomWidth: 2, borderBottomColor: t.edge, zIndex: 10 }}>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: WIDE, alignSelf: "center", paddingHorizontal: space(8), height: 96, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo et drapeau du Québec : le mât est planté derrière la toque, le drapeau flotte au-dessus, à droite */}
        <View style={{ width: LOGO_W + 28, height: LOGO_H, marginTop: 18 }}>
          <Image {...r("flag")} source={FLAG} accessibilityLabel="Drapeau du Québec" resizeMode="contain" accessibilityIgnoresInvertColors
            style={{ position: "absolute", left: LOGO_W * 0.65, top: LOGO_H * 0.43 - FLAG_H, width: FLAG_W, height: FLAG_H }} />
          <Link href="/" accessibilityLabel="Gusto, accueil" {...r("wiggle")} style={{ position: "relative", zIndex: 1 }}>
            <Logo size={LOGO_SIZE} />
          </Link>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(8) }}>
          <View role="navigation" {...r("hide-md")} style={{ flexDirection: "row", gap: space(7) }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href as any} {...r("dim")} style={{ fontFamily: font.semibold, fontSize: 15.5, color: active(n.href) ? t.primary : t.ink }}>{n.label}</Link>
            ))}
          </View>
          {onCta
            ? <Button label="Créer mon menu" size="sm" icon={ArrowRight} onPress={onCta} />
            : <Button label="Créer mon menu" size="sm" icon={ArrowRight} href="/#planificateur" />}
        </View>
      </View>

      {/* Téléphone et tablette : rangée de boutons, toujours visible sous le logo */}
      <View {...r("only-md")} role="navigation" aria-label="Navigation" style={{ borderTopWidth: 1, borderTopColor: t.line }}>
        <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(4), paddingVertical: space(2.5), gap: space(2) }}>
          {MOBILE.map((n) => {
            const on = active(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href as any} asChild>
                <View {...r("press")} onLayout={on ? (e) => row.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 16), animated: false }) : undefined} accessibilityRole="link" accessibilityLabel={n.label} aria-current={on ? "page" : undefined}
                  style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), height: 40, paddingHorizontal: space(3.5), borderRadius: 999, borderWidth: 2, borderColor: t.edge, backgroundColor: on ? t.primary : t.surface }}>
                  <Icon size={16} color={on ? "#FFFFFF" : t.ink} strokeWidth={2.5} />
                  <Text style={{ fontFamily: font.bold, fontSize: 14.5, color: on ? "#FFFFFF" : t.ink }}>{n.label}</Text>
                </View>
              </Link>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
