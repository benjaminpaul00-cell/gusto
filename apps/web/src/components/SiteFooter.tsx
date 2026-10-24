// Pied de page : de vrais liens <a> (utiles aux visiteurs et à Google) et un grand logo final.
import { Link } from "expo-router";
import { RECIPES_URL } from "../recipesUrl";
import { Mail, Megaphone } from "lucide-react-native";
import { Linking, Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import { font, r, space, WIDE } from "../theme";
import { Logo } from "./Logo";

const NAVY = "#0E1030";
export const CONTACT_EMAIL = "info@mongusto.ca";
const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/** Carte de contact : un vrai lien « mailto: » (ouvre le logiciel de courriel du visiteur). */
function ContactCard({ icon: IconC, tone, title, text, subject }: { icon: typeof Mail; tone: string; title: string; text: string; subject: string }) {
  return (
    <Pressable {...({ href: mailto(subject) } as any)} {...r("press")} accessibilityRole="link"
      onPress={Platform.OS === "web" ? undefined : () => Linking.openURL(mailto(subject))}
      style={{ flexGrow: 1, flexBasis: 300, padding: space(6), borderRadius: 22, backgroundColor: tone, borderWidth: 2.5, borderColor: NAVY, boxShadow: `5px 5px 0 ${NAVY}` } as any}>
      <View style={{ gap: space(3) } as ViewStyle}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: NAVY, alignItems: "center", justifyContent: "center" }}>
          <IconC size={22} color={NAVY} strokeWidth={2.25} />
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 22, letterSpacing: -0.6, color: NAVY }}>{title}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: NAVY }}>{text}</Text>
        <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: NAVY, textDecorationLine: "underline" }}>{CONTACT_EMAIL}</Text>
      </View>
    </Pressable>
  );
}
const COLUMNS = [
  { title: "Gusto", links: [
    { href: "/#planificateur", label: "Créer un menu" },
    { href: "/#comment", label: "Comment ça marche" },
    { href: "/a-propos", label: "À propos" },
  ] },
  { title: "Ressources", links: [
    { href: RECIPES_URL, label: "Recettes" },
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
      {/* Nous joindre */}
      <View nativeID="contact" {...r("gutter")} style={{ width: "100%", maxWidth: WIDE, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(20) }}>
        <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 40, lineHeight: 46, letterSpacing: -1.5, color: "#FFFFFF" }}>
          Nous joindre<Text style={{ color: "#FFE14D" }}>.</Text>
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(6), marginTop: space(8) }}>
          <ContactCard icon={Mail} tone="#FFE14D" title={"Une question, un commentaire ?"} text={"Une idée pour améliorer Gusto, un problème avec ton menu ? Écris-nous, on lit tout."} subject="Question au sujet de Gusto" />
          <ContactCard icon={Megaphone} tone="#FF5FA2" title="Annoncer sur Gusto" text={"Vous êtes une entreprise et souhaitez présenter vos produits aux familles qui planifient leur épicerie ? Parlons-en."} subject="Publicité sur Gusto" />
        </View>
      </View>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: WIDE, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(16) }}>
        <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(16), justifyContent: "space-between" }}>
          <View style={{ maxWidth: 360, gap: space(5) }}>
            <Logo size={46} inverse />
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
      {/* Grand logo en bas de page */}
      <View aria-hidden style={{ alignItems: "center", marginTop: space(12), marginBottom: space(10), opacity: 0.95 }}>
        <View style={{ width: "70%", maxWidth: 420 }}>
          <Logo width="100%" inverse />
        </View>
      </View>
    </View>
  );
}
