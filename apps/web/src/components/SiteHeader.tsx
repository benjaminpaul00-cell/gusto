// En-tête du site : logo, navigation, bouton principal.
import { Link } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { View } from "react-native";
import { font, r, space, useTheme, WIDE } from "../theme";
import { Logo } from "./Logo";
import { Button } from "./ui";
import { RECIPES_URL } from "../recipesUrl";

const NAV = [
  { href: RECIPES_URL, label: "Recettes" },
  { href: "/#comment", label: "Comment ça marche" },
  { href: "/guides", label: "Guides" },
  { href: "/cuisines", label: "Cuisines" },
];

export function SiteHeader({ onCta }: { onCta?: () => void }) {
  const t = useTheme();
  return (
    <View role="banner" style={{ backgroundColor: t.bg, borderBottomWidth: 2, borderBottomColor: t.edge, zIndex: 10 }}>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: WIDE, alignSelf: "center", paddingHorizontal: space(8), height: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" accessibilityLabel="Gusto, accueil" {...r("wiggle")}>
          <Logo size={40} />
        </Link>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(8) }}>
          <View role="navigation" {...r("hide-md")} style={{ flexDirection: "row", gap: space(7) }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href as any} {...r("dim")} style={{ fontFamily: font.semibold, fontSize: 15.5, color: t.ink }}>{n.label}</Link>
            ))}
          </View>
          {onCta
            ? <Button label="Créer mon menu" size="sm" icon={ArrowRight} onPress={onCta} />
            : <Button label="Créer mon menu" size="sm" icon={ArrowRight} href="/#planificateur" />}
        </View>
      </View>
    </View>
  );
}
