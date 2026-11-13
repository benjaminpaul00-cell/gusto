// Mise en page des pages de contenu : bandeau titre, colonne de lecture, appel à créer un menu.
import { Link } from "expo-router";
import Head from "expo-router/head";
import { ArrowLeft, ArrowRight, Lightbulb, Sparkles } from "lucide-react-native";
import type { ComponentType, ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import type { Block } from "../content/types";
import { useConsent } from "../consent";
import { font, r, radius, space, useTheme } from "../theme";
import { AdSlot } from "./AdSlot";
import { Screen } from "./Screen";
import { Burst, Dots } from "./Shapes";
import { Button, Eyebrow, IconBadge } from "./ui";

const NAVY = "#0E1030";
const TONES = ["#2B44FF", "#FF5FA2", "#FFE14D"];

export function PageHead({ title, description }: { title: string; description: string }) {
  return (
    <Head>
      <title>{`${title} · Gusto`}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="article" />
      <meta property="og:locale" content="fr_CA" />
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  );
}

export function Page({ title, description, eyebrow, back, wide, children }: {
  title: string; description: string; eyebrow?: string; back?: { href: string; label: string }; wide?: boolean; children: ReactNode;
}) {
  const t = useTheme();
  const max = wide ? 1200 : 780;
  return (
    <Screen>
      <PageHead title={title} description={description} />
      <View style={{ backgroundColor: t.surfaceAlt, borderBottomWidth: 2.5, borderBottomColor: NAVY, overflow: "hidden" }}>
        <View {...r("spin", "hide-sm")} style={{ position: "absolute", right: 60, top: 40 }}><Burst size={90} color="#FF5FA2" /></View>
        <View {...r("float-slow", "hide-sm")} style={{ position: "absolute", right: 180, bottom: 20 }}><Dots cols={6} rows={3} /></View>
        <View {...r("gutter")} style={{ width: "100%", maxWidth: max, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(14), paddingBottom: space(14) }}>
          {back ? (
            <Link href={back.href as any} asChild>
              <Pressable {...r("dim")} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: space(2), alignSelf: "flex-start", marginBottom: space(8) }}>
                <ArrowLeft size={17} color={t.ink} strokeWidth={2.5} />
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>{back.label}</Text>
              </Pressable>
            </Link>
          ) : null}
          {eyebrow ? <View {...r("reveal")}><Eyebrow tone="lemon">{eyebrow}</Eyebrow></View> : null}
          <Text role="heading" aria-level={1} {...r("title", "reveal", "d1")} style={{ fontFamily: font.display, fontSize: 60, lineHeight: 64, letterSpacing: -2.4, color: t.ink, marginTop: space(5), maxWidth: 900 }}>{title}</Text>
          <Text {...r("reveal", "d2")} style={{ fontFamily: font.medium, fontSize: 20, lineHeight: 31, color: t.muted, marginTop: space(5), maxWidth: 660 }}>{description}</Text>
        </View>
      </View>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: max, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(8), paddingBottom: space(24) }}>
        {children}
      </View>
    </Screen>
  );
}

export function Blocks({ blocks, cta = true, ads = true }: { blocks: Block[]; cta?: boolean; ads?: boolean }) {
  const t = useTheme();
  const { consent } = useConsent();
  const p = { fontFamily: font.body, color: t.ink, fontSize: 18.5, lineHeight: 32, marginTop: space(5) };
  // Une annonce au milieu du texte, seulement pour les articles assez longs.
  const adPositions = ads && blocks.length >= 8 ? new Set([Math.floor(blocks.length / 3), Math.floor((blocks.length * 2) / 3)]) : new Set<number>();
  return (
    <View>
      {blocks.map((b, i) => (
        <View key={i}>
          {adPositions.has(i) ? <AdSlot consent={consent} kind="vertical" /> : null}
          {"h" in b ? (
            <Text role="heading" aria-level={2} {...r("reveal")} style={{ fontFamily: font.display, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: t.ink, marginTop: space(14) }}>{b.h}</Text>
          ) : "p" in b ? (
            <Text style={p}>{b.p}</Text>
          ) : "ul" in b ? (
            <View role="list" style={{ marginTop: space(5), gap: space(3) }}>
              {b.ul.map((li, j) => (
                <View key={j} role="listitem" {...r("reveal-left", `d${Math.min(6, j + 1)}`)} style={{ flexDirection: "row", gap: space(4) }}>
                  <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: TONES[j % 3], borderWidth: 2, borderColor: NAVY, marginTop: 10, transform: [{ rotate: "45deg" }] }} />
                  <Text style={{ flex: 1, fontFamily: font.body, color: t.ink, fontSize: 18.5, lineHeight: 32 }}>{li}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View {...r("reveal-scale")} style={{ marginTop: space(10), padding: space(6), borderRadius: radius.lg, backgroundColor: t.tag, borderWidth: 2.5, borderColor: NAVY, boxShadow: `5px 5px 0 ${NAVY}`, flexDirection: "row", gap: space(4), transform: [{ rotate: "-0.6deg" }] } as ViewStyle}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: NAVY, alignItems: "center", justifyContent: "center" }}>
                <Lightbulb size={20} color={NAVY} strokeWidth={2.5} />
              </View>
              <Text style={{ flex: 1, fontFamily: font.medium, color: NAVY, fontSize: 17, lineHeight: 27 }}>
                <Text style={{ fontFamily: font.display }}>Astuce. </Text>
                {b.tip}
              </Text>
            </View>
          )}
        </View>
      ))}
      {ads && blocks.length >= 8 ? <AdSlot consent={consent} kind="native" /> : null}
      {cta ? <CallToAction /> : null}
    </View>
  );
}

function CallToAction() {
  return (
    <View {...r("card-pad", "reveal-scale")} style={{ marginTop: space(16), padding: space(10), borderRadius: 32, backgroundColor: "#2B44FF", borderWidth: 2.5, borderColor: NAVY, boxShadow: `8px 8px 0 ${NAVY}`, gap: space(4), overflow: "hidden" } as ViewStyle}>
      <View {...r("spin", "hide-sm")} style={{ position: "absolute", right: -30, bottom: -40 }}><Burst size={150} color="#FFE14D" /></View>
      <Text style={{ fontFamily: font.display, fontSize: 34, lineHeight: 40, letterSpacing: -1.2, color: "#FFFFFF", maxWidth: 480 }}>
        Essaie Gusto, <Text style={{ fontFamily: font.serif, fontSize: 40, color: "#FFE14D" }}>c’est gratuit.</Text>
      </Text>
      <Text style={{ fontFamily: font.medium, fontSize: 16.5, lineHeight: 26, color: "#DDE2FF", maxWidth: 480 }}>
        Choisis ton épicerie, tes repas et ton budget : Gusto prépare ton menu et ta liste d’épicerie avec les prix de la semaine. Sans compte.
      </Text>
      <View style={{ marginTop: space(2) }}>
        <Button label="Créer mon menu" variant="accent" icon={Sparkles} href="/#planificateur" />
      </View>
    </View>
  );
}

/** Grille de cartes-liens (guides, cuisines). */
export function LinkList({ items, icon }: { items: { href: string; title: string; description: string }[]; icon?: ComponentType<any> }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: space(8), flexDirection: "row", flexWrap: "wrap", gap: space(6) }}>
      {items.map((x, k) => (
        <View key={x.href} {...r("reveal", `d${(k % 3) + 1}`)} style={{ flexGrow: 1, flexBasis: 320 }}>
          <Link href={x.href as any} asChild>
            <Pressable {...r("press")} accessibilityRole="link" style={{ height: "100%", padding: space(7), borderRadius: radius.xl, borderWidth: 2.5, borderColor: NAVY, backgroundColor: t.surface, boxShadow: `5px 5px 0 ${NAVY}`, gap: space(3) } as ViewStyle}>
              {icon ? <IconBadge icon={icon} tone={(["cobalt", "pink", "lemon"] as const)[k % 3]} size={48} /> : null}
              <Text style={{ fontFamily: font.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.6, color: t.ink, marginTop: space(1) }}>{x.title}</Text>
              <Text style={{ fontFamily: font.medium, color: t.muted, fontSize: 15, lineHeight: 23 }}>{x.description}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), marginTop: "auto" as any, paddingTop: space(2) }}>
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.primary }}>Lire</Text>
                <ArrowRight size={16} color={t.primary} strokeWidth={2.5} />
              </View>
            </Pressable>
          </Link>
        </View>
      ))}
    </View>
  );
}
