import { Link } from "expo-router";
import {
  ArrowRight, Beef, BookOpen, Calculator, Check, ChevronDown, Drumstick, Pizza, ShoppingBasket, Soup, Sparkles, Store, Tag, Utensils,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";
import { CUISINES, STORES, type StoreId } from "../../../shared/options";
import { PageHead } from "../src/components/ArticleView";
import { CountUp } from "../src/components/CountUp";
import { PriceTag } from "../src/components/PriceTag";
import { Screen } from "../src/components/Screen";
import { Burst, Dots, HalfMoon, Squiggle } from "../src/components/Shapes";
import { Button, Eyebrow, H2, IconBadge, Lead, Section } from "../src/components/ui";
import { Wizard } from "../src/components/Wizard";
import { CUISINE_PAGES } from "../src/content/cuisines";
import { GUIDES } from "../src/content/guides";
import { StoreLogo } from "../src/stores";
import { font, money, r, radius, space, useTheme, WIDE, type Theme } from "../src/theme";

const NAVY = "#0E1030";
const TONES = ["#2B44FF", "#FF5FA2", "#FFE14D"];
const onTone = (k: number) => (k % 3 === 0 ? "#FFFFFF" : NAVY);

export default function Home() {
  const t = useTheme();
  const scroll = useRef<ScrollView>(null);
  const anchors = useRef<Record<string, number>>({});
  const go = (id: string) => scroll.current?.scrollTo({ y: Math.max(0, (anchors.current[id] ?? 0) - 8), animated: true });
  const anchor = (id: string) => ({ onLayout: (e: any) => { anchors.current[id] = e.nativeEvent.layout.y; } });

  // Arrivée depuis une autre page avec /#planificateur ou /#comment
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => go(id), 400);
  }, []);

  return (
    <Screen ref={scroll} onCta={() => go("planificateur")}>
      <PageHead title="Menus et listes d’épicerie selon ton budget" description="Planificateur de menus gratuit pour le Québec : un menu et une liste d’épicerie au prix de Maxi, Super C, IGA, Metro, Provigo ou Walmart, sans jamais dépasser ton budget." />
      <Hero onStart={() => go("planificateur")} onHow={() => go("comment")} t={t} />
      <LogoMarquee t={t} />
      <Stats t={t} />
      <View {...anchor("planificateur")}><PlannerSection t={t} /></View>
      <View {...anchor("comment")}><HowItWorks t={t} /></View>
      <BudgetPromise t={t} />
      <CuisinesGrid t={t} />
      <GuidesTeaser t={t} />
      <Faq t={t} />
      <FinalCta onStart={() => go("planificateur")} t={t} />
    </Screen>
  );
}

// ─── Ouverture ──────────────────────────────────────────────────────────────

const WORDS = [["savoureux", "#FFE14D", NAVY], ["variés", "#FF5FA2", NAVY], ["abordables", "#2B44FF", "#FFFFFF"], ["faits maison", "#FFE14D", NAVY]] as const;

function RotatingWord() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setK((x) => (x + 1) % WORDS.length), 2300);
    return () => clearInterval(id);
  }, []);
  const [w, bg, fg] = WORDS[k];
  return (
    <View style={{ flexDirection: "row" }}>
      <View key={w} {...r("word-in")} style={{ backgroundColor: bg, borderWidth: 3, borderColor: NAVY, borderRadius: 22, paddingHorizontal: 18, paddingBottom: 6, boxShadow: `6px 6px 0 ${NAVY}`, transform: [{ rotate: "-2deg" }] } as ViewStyle}>
        <Text {...r("hero-title")} style={{ fontFamily: font.display, fontSize: 84, lineHeight: 92, letterSpacing: -3, color: fg }}>{w}</Text>
      </View>
    </View>
  );
}

function Hero({ onStart, onHow, t }: { onStart: () => void; onHow: () => void; t: Theme }) {
  const big = { fontFamily: font.display, fontSize: 84, lineHeight: 92, letterSpacing: -3, color: t.ink };
  return (
    <View style={{ overflow: "hidden", backgroundColor: t.bg }}>
      {/* Décor */}
      <View {...r("blob", "hide-sm")} style={{ position: "absolute", width: 520, height: 520, right: -160, top: -180, backgroundColor: t.pink, opacity: 0.9, borderRadius: 260 }} />
      <View {...r("floatx", "hide-md")} style={{ position: "absolute", left: "44%", top: 70 }}><Burst size={70} /></View>
      <View {...r("float-slow", "hide-md")} style={{ position: "absolute", left: 30, bottom: 30 }}><Dots cols={7} rows={4} /></View>

      <View {...r("gutter")} style={{ width: "100%", maxWidth: WIDE, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(16), paddingBottom: space(24) }}>
        <View {...r("stack-md")} style={{ flexDirection: "row", alignItems: "center", gap: space(12) }}>
          <View style={{ flex: 1.15, minWidth: 0 }}>
            <View {...r("rise")}><Eyebrow tone="lemon">100 % gratuit · Sans compte · Fait au Québec</Eyebrow></View>
            <View role="heading" aria-level={1} style={{ marginTop: space(6), gap: space(1) }}>
              <Text {...r("hero-title", "rise", "d1")} style={big}>Des repas</Text>
              <View {...r("rise", "d2")} style={{ paddingVertical: space(1.5) }}><RotatingWord /></View>
              <Text {...r("hero-title", "rise", "d3")} style={big}>sans dépasser</Text>
              <View {...r("rise", "d4")}>
                <Text {...r("hero-title")} style={[big, { fontFamily: font.serif, fontSize: 96, letterSpacing: -1, color: t.primary }]}>ton budget.</Text>
                <View style={{ marginTop: -6, marginLeft: 4 }}><Squiggle width={300} /></View>
              </View>
            </View>
            <Text {...r("rise", "d5")} style={{ fontFamily: font.medium, fontSize: 19.5, lineHeight: 31, color: t.muted, marginTop: space(7), maxWidth: 540 }}>
              Gusto crée ton menu de la semaine et ta liste d’épicerie avec les vrais prix de ta bannière. Tu fixes le montant, on s’occupe du reste.
            </Text>
            <View {...r("rise", "d6")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space(4), marginTop: space(9) }}>
              <Button label="Créer mon menu" size="lg" variant="pink" icon={ArrowRight} onPress={onStart} />
              <Button label="Comment ça marche" size="lg" variant="secondary" onPress={onHow} />
            </View>
          </View>
          <View {...r("full-md")} style={{ flex: 1, minWidth: 0, maxWidth: 520, width: "100%", alignSelf: "center" }}>
            <Collage t={t} />
          </View>
        </View>
      </View>
    </View>
  );
}

const PREVIEW = [
  { day: "Lun", name: "Pâté chinois", cuisine: "Québécoise", cost: 2.84, icon: Beef, tone: 2 },
  { day: "Mar", name: "Poulet au beurre", cuisine: "Indienne", cost: 3.12, icon: Drumstick, tone: 1 },
  { day: "Mer", name: "Soupe tonkinoise", cuisine: "Vietnamienne", cost: 2.65, icon: Soup, tone: 0 },
  { day: "Jeu", name: "Tacos au porc", cuisine: "Mexicaine", cost: 3.05, icon: Utensils, tone: 2 },
  { day: "Ven", name: "Pizza maison", cuisine: "Italienne", cost: 2.4, icon: Pizza, tone: 1 },
];

/** Collage animé illustrant le produit (exemple, pas un vrai menu). */
function Collage({ t }: { t: Theme }) {
  return (
    <View style={{ paddingTop: space(10), paddingBottom: space(16), paddingHorizontal: space(2) }} aria-label="Exemple de menu créé par Gusto">
      {/* Carte principale */}
      <View {...r("rise", "d2")}>
        <View {...r("float")}>
          <View style={{ backgroundColor: t.surface, borderRadius: radius.xl, borderWidth: 2.5, borderColor: NAVY, padding: space(6), boxShadow: `10px 10px 0 ${NAVY}`, transform: [{ rotate: "-2.5deg" }] } as ViewStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: t.muted }}>Exemple</Text>
                <Text style={{ fontFamily: font.display, fontSize: 26, color: t.ink, letterSpacing: -0.8 }}>Ta semaine</Text>
              </View>
              <View {...r("hide-sm")} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 2, borderColor: NAVY, paddingHorizontal: space(3), paddingVertical: space(2) }}>
                <StoreLogo id="maxi" label="Maxi" maxW={56} maxH={26} />
              </View>
            </View>
            <View style={{ marginTop: space(4), gap: space(1) }}>
              {PREVIEW.map((m, k) => (
                <View key={m.day} {...r("rise", `d${k + 2}`)} style={{ flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(2), borderTopWidth: k ? 1.5 : 0, borderTopColor: t.line }}>
                  <Text style={{ width: 30, fontFamily: font.bold, fontSize: 12.5, color: t.muted }}>{m.day}</Text>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: TONES[m.tone], borderWidth: 2, borderColor: NAVY, alignItems: "center", justifyContent: "center" }}>
                    <m.icon size={19} color={onTone(m.tone)} strokeWidth={2.25} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>{m.name}</Text>
                    <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: t.muted }}>{m.cuisine}</Text>
                  </View>
                  <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: t.ink, fontVariant: ["tabular-nums"] }}>{money(m.cost)}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: space(4), paddingTop: space(4), borderTopWidth: 2, borderTopColor: NAVY }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: t.muted }}>Budget utilisé</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: t.ink }}>95 %</Text>
              </View>
              <View style={{ height: 14, borderRadius: 7, borderWidth: 2, borderColor: NAVY, backgroundColor: t.surfaceAlt, marginTop: space(2), overflow: "hidden" }}>
                <View {...r("bar")} style={{ width: "95%", height: "100%", backgroundColor: t.primary }} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Étiquette de prix */}
      <View {...r("pop-in", "d4")} style={{ position: "absolute", top: 0, right: -8 }}>
        <View {...r("float-slow")}><PriceTag amount={142.37} caption="sur un budget de 150 $" animate /></View>
      </View>

      {/* Mini-liste d'épicerie */}
      <View {...r("pop-in", "d6", "hide-sm")} style={{ position: "absolute", bottom: 0, left: -36, width: 230 }}>
        <View {...r("float")} style={{ animationDelay: "1.5s" } as any}>
          <View style={{ backgroundColor: t.tag, borderRadius: radius.lg, borderWidth: 2.5, borderColor: NAVY, padding: space(4), gap: space(2), boxShadow: `6px 6px 0 ${NAVY}`, transform: [{ rotate: "4deg" }] } as ViewStyle}>
            <Text style={{ fontFamily: font.display, fontSize: 15, color: NAVY }}>Liste d’épicerie</Text>
            {["Oignons jaunes", "Bœuf haché", "Riz basmati"].map((x, k) => (
              <View key={x} style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: NAVY, backgroundColor: k < 2 ? NAVY : "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                  {k < 2 ? <View {...r("pop-in", `d${k + 5}`)}><Check size={12} color="#FFE14D" strokeWidth={4} /></View> : null}
                </View>
                <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: NAVY, textDecorationLine: k < 2 ? "line-through" : "none" }}>{x}</Text>
                {k === 1 ? <View style={{ marginLeft: "auto", backgroundColor: "#FF5FA2", borderRadius: 999, borderWidth: 1.5, borderColor: NAVY, paddingHorizontal: 6 }}><Text style={{ fontFamily: font.bold, fontSize: 10.5, color: NAVY }}>RABAIS</Text></View> : null}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Pastille */}
      <View {...r("pop-in", "d5", "hide-sm")} style={{ position: "absolute", bottom: 40, right: -20 }}>
        <View {...r("spin")}><Burst size={96} color="#2B44FF" /></View>
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" } as any}>
          <Text style={{ fontFamily: font.display, fontSize: 14, lineHeight: 15, color: "#FFFFFF", textAlign: "center" }}>{"0 $\nà payer"}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Logos des épiceries ────────────────────────────────────────────────────

function LogoMarquee({ t }: { t: Theme }) {
  const row = [...STORES, ...STORES, ...STORES, ...STORES];
  return (
    <View style={{ backgroundColor: t.tag, borderTopWidth: 2.5, borderBottomWidth: 2.5, borderColor: NAVY, paddingVertical: space(7), overflow: "hidden" }}>
      <Text style={{ fontFamily: font.display, fontSize: 15, letterSpacing: 0.3, color: NAVY, textAlign: "center", marginBottom: space(5) }}>Les prix de la semaine de tes épiceries préférées</Text>
      <View {...r("marquee-wrap")} style={{ overflow: "hidden" }}>
        <View {...r("marquee")} style={{ flexDirection: "row", gap: space(5), width: "max-content" as any }}>
          {row.map((s, k) => (
            <View key={k} {...r("lift")} style={{ width: 190, height: 88, borderRadius: radius.lg, backgroundColor: "#FFFFFF", borderWidth: 2.5, borderColor: NAVY, boxShadow: `4px 4px 0 ${NAVY}`, alignItems: "center", justifyContent: "center" } as ViewStyle}>
              <StoreLogo id={s.id as StoreId} label={s.label} maxW={124} maxH={46} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Chiffres ───────────────────────────────────────────────────────────────

function Stats({ t }: { t: Theme }) {
  const items = [
    { n: 6, suffix: "", label: "épiceries comparées", tone: 0 },
    { n: 12, suffix: "", label: "cuisines du monde", tone: 1 },
    { n: 95, suffix: " %", label: "du budget visé, jamais plus", tone: 2 },
    { n: 0, suffix: " $", label: "pour l’utiliser, toujours", tone: 0 },
  ];
  return (
    <Section tight>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(5) }}>
        {items.map((x, k) => (
          <View key={x.label} {...r("reveal", `d${k + 1}`)} style={{ flexGrow: 1, flexBasis: 220, paddingVertical: space(4), paddingLeft: space(5), borderLeftWidth: 5, borderLeftColor: TONES[x.tone] }}>
            <CountUp to={x.n} format={(v) => `${Math.round(v)}${x.suffix}`} style={{ fontFamily: font.display, fontSize: 64, lineHeight: 68, letterSpacing: -2.5, color: t.ink }} />
            <Text style={{ fontFamily: font.semibold, fontSize: 16, color: t.muted, marginTop: space(1) }}>{x.label}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ─── Planificateur ──────────────────────────────────────────────────────────

function PlannerSection({ t }: { t: Theme }) {
  return (
    <View style={{ backgroundColor: t.brand, borderTopWidth: 2.5, borderBottomWidth: 2.5, borderColor: NAVY, overflow: "hidden" }}>
      <View {...r("spin", "hide-sm")} style={{ position: "absolute", right: 60, top: 70 }}><Burst size={110} color="#FF5FA2" /></View>
      <View {...r("float-slow", "hide-sm")} style={{ position: "absolute", left: 40, top: 120 }}><Dots cols={6} rows={6} color="#FFFFFF" opacity={0.35} /></View>
      <View {...r("float", "hide-md")} style={{ position: "absolute", left: -20, bottom: 120 }}><HalfMoon size={140} color="#FFE14D" /></View>
      <Section>
        <View style={{ alignItems: "center" }}>
          <View {...r("reveal")}><Eyebrow tone="lemon">Le planificateur</Eyebrow></View>
          <View {...r("reveal", "d1")}><H2 center color="#FFFFFF" accentColor="#FFE14D" accent="en deux minutes.">Ton menu, </H2></View>
          <View {...r("reveal", "d2")}><Lead center color="#DDE2FF">Huit petites questions. Gusto s’occupe des recettes, des quantités et du total de ta facture.</Lead></View>
        </View>
        <View {...r("reveal-scale", "d3")} style={{ marginTop: space(14) }}>
          <Wizard />
        </View>
      </Section>
    </View>
  );
}

// ─── Comment ça marche ──────────────────────────────────────────────────────

function HowItWorks({ t }: { t: Theme }) {
  const steps = [
    { icon: Store, title: "Tu choisis", text: "Ton épicerie, tes repas, le nombre de personnes, tes cuisines préférées et ton budget." },
    { icon: Calculator, title: "Gusto calcule", text: "Il pioche dans sa banque de recettes et compte chaque emballage au prix de ta bannière." },
    { icon: ShoppingBasket, title: "Tu fais l’épicerie", text: "Ta liste est classée par rayon, à cocher en magasin, ou en PDF et dans ton calendrier." },
  ];
  return (
    <Section>
      <View {...r("reveal")}><Eyebrow tone="pink">Comment ça marche</Eyebrow></View>
      <View {...r("reveal", "d1")}><H2 accent="en trois temps.">Ton épicerie, </H2></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(7), marginTop: space(14) }}>
        {steps.map((s, k) => (
          <View key={s.title} {...r("reveal", `d${k + 2}`)} style={{ flexGrow: 1, flexBasis: 300 }}>
            <View {...r("lift")} style={{ padding: space(8), minHeight: 300, borderRadius: radius.xl, backgroundColor: TONES[k], borderWidth: 2.5, borderColor: NAVY, boxShadow: `8px 8px 0 ${NAVY}`, gap: space(4), transform: [{ rotate: k === 1 ? "1.5deg" : "-1deg" }] } as ViewStyle}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <IconBadge icon={s.icon} tone={k === 0 ? "lemon" : "white"} size={56} />
                <Text style={{ fontFamily: font.display, fontSize: 96, lineHeight: 96, letterSpacing: -4, color: onTone(k), opacity: 0.9 }}>{k + 1}</Text>
              </View>
              <Text style={{ fontFamily: font.display, fontSize: 30, letterSpacing: -1, color: onTone(k), marginTop: "auto" as any }}>{s.title}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 16.5, lineHeight: 25, color: onTone(k), opacity: 0.9 }}>{s.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ─── Promesse budget ────────────────────────────────────────────────────────

function BudgetPromise({ t }: { t: Theme }) {
  const rules = [
    "Semaine 1 au prix de la circulaire, rabais compris.",
    "Semaines 2 à 4 au prix régulier : ta facture ne peut que baisser.",
    "Les restes d’une recette servent à la suivante.",
    "Ingrédient introuvable ? Une version maison, ou le prix maximal en épicerie spécialisée.",
  ];
  const lines: [string, string][] = [["Épicerie, 31 articles", "118,42 $"], ["Garde-manger, 1re semaine", "15,10 $"], ["Épicerie spécialisée (max.)", "8,85 $"]];
  return (
    <View style={{ backgroundColor: t.pink, borderTopWidth: 2.5, borderBottomWidth: 2.5, borderColor: NAVY, overflow: "hidden" }}>
      <View {...r("floatx", "hide-sm")} style={{ position: "absolute", right: "46%", top: 50 }}><Burst size={64} /></View>
      <Section>
        <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(16), alignItems: "center" }}>
          <View style={{ flex: 1.1 }}>
            <View {...r("reveal")}><Eyebrow tone="white">Notre promesse</Eyebrow></View>
            <View {...r("reveal", "d1")}><H2 color={NAVY} accentColor="#FFFFFF" accent="c’est sacré.">Ton budget, </H2></View>
            <View {...r("reveal", "d2")}><Lead color={NAVY}>Gusto ne te montre jamais un menu plus cher que prévu. Si ton budget est impossible à respecter, il te le dit et te propose le minimum réaliste.</Lead></View>
            <View style={{ marginTop: space(8), gap: space(4) }}>
              {rules.map((x, k) => (
                <View key={x} {...r("reveal-left", `d${k + 2}`)} style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start" }}>
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#FFE14D", borderWidth: 2, borderColor: NAVY, alignItems: "center", justifyContent: "center" }}>
                    <Check size={16} color={NAVY} strokeWidth={3.5} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 17, lineHeight: 26, color: NAVY }}>{x}</Text>
                </View>
              ))}
            </View>
          </View>
          <View {...r("full-md", "reveal-scale", "d3")} style={{ flex: 0.9, maxWidth: 420, width: "100%", alignSelf: "center" }}>
            <View {...r("float-slow")}>
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: radius.md, borderWidth: 2.5, borderColor: NAVY, padding: space(7), transform: [{ rotate: "2deg" }], boxShadow: `10px 10px 0 ${NAVY}` } as ViewStyle} aria-label="Exemple de facture estimée">
                <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#6A6F92", textAlign: "center" }}>Facture estimée · exemple</Text>
                <Text style={{ fontFamily: font.display, fontSize: 24, letterSpacing: -0.8, color: NAVY, textAlign: "center", marginTop: space(1) }}>Semaine du lundi</Text>
                <View style={{ borderTopWidth: 2, borderStyle: "dashed", borderColor: "#C9CBE0", marginVertical: space(5) }} />
                {lines.map(([a, b], k) => (
                  <View key={a} {...r("reveal", `d${k + 3}`)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: space(1.5) }}>
                    <Text style={{ fontFamily: font.medium, fontSize: 15, color: "#3B3F66" }}>{a}</Text>
                    <Text style={{ fontFamily: font.bold, fontSize: 15, color: NAVY, fontVariant: ["tabular-nums"] }}>{b}</Text>
                  </View>
                ))}
                <View style={{ borderTopWidth: 2, borderStyle: "dashed", borderColor: "#C9CBE0", marginVertical: space(5) }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={{ fontFamily: font.display, fontSize: 18, color: NAVY }}>Total</Text>
                  <CountUp to={142.37} format={money} style={{ fontFamily: font.display, fontSize: 34, letterSpacing: -1, color: NAVY, fontVariant: ["tabular-nums"] }} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space(1) }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: "#6A6F92" }}>Ton budget</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14.5, color: "#6A6F92", fontVariant: ["tabular-nums"] }}>150,00 $</Text>
                </View>
                <View {...r("pulse")} style={{ marginTop: space(5), backgroundColor: "#FFE14D", borderRadius: 12, borderWidth: 2, borderColor: NAVY, paddingVertical: space(3), paddingHorizontal: space(4), flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: NAVY }}>Il te reste</Text>
                  <Text style={{ fontFamily: font.display, fontSize: 15, color: NAVY, fontVariant: ["tabular-nums"] }}>7,63 $</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Section>
    </View>
  );
}

// ─── Cuisines ───────────────────────────────────────────────────────────────

function CuisinesGrid({ t }: { t: Theme }) {
  const dishes = (id: string) => {
    const ul = CUISINE_PAGES.find((x) => x.id === id)?.blocks.find((b) => "ul" in b) as { ul: string[] } | undefined;
    return (ul?.ul ?? []).slice(0, 3).map((d) => d.split(/ ?[:(,]/)[0].trim()).join(" · ");
  };
  return (
    <Section>
      <View {...r("stack-sm")} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space(6) }}>
        <View style={{ flex: 1 }}>
          <View {...r("reveal")}><Eyebrow tone="cobalt">Douze cuisines</Eyebrow></View>
          <View {...r("reveal", "d1")}><H2 accent="épiceries d’ici.">Le monde entier, avec les </H2></View>
        </View>
        <View {...r("reveal", "d2")}><Button label="Toutes les cuisines" variant="secondary" href="/cuisines" icon={ArrowRight} /></View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(5), marginTop: space(14) }}>
        {CUISINES.map((c, k) => (
          <View key={c.id} {...r("reveal-scale", `d${(k % 4) + 1}`)} style={{ flexGrow: 1, flexBasis: 250 }}>
            <Link href={`/cuisines/${c.id}` as any} asChild>
              <Pressable {...r("press")} accessibilityRole="link"
                style={{ minHeight: 160, padding: space(6), borderRadius: radius.lg, backgroundColor: k % 2 ? t.surface : TONES[(k / 2) % 3 | 0], borderWidth: 2.5, borderColor: NAVY, boxShadow: `4px 4px 0 ${NAVY}`, justifyContent: "space-between", gap: space(4) } as ViewStyle}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: font.display, fontSize: 26, letterSpacing: -0.8, color: k % 2 ? t.ink : onTone((k / 2) % 3 | 0) }}>{c.label}</Text>
                  <ArrowRight size={20} color={k % 2 ? t.ink : onTone((k / 2) % 3 | 0)} strokeWidth={2.5} />
                </View>
                <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: k % 2 ? t.muted : onTone((k / 2) % 3 | 0), opacity: k % 2 ? 1 : 0.85 }}>{dishes(c.id)}</Text>
              </Pressable>
            </Link>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ─── Guides ─────────────────────────────────────────────────────────────────

function GuidesTeaser({ t }: { t: Theme }) {
  return (
    <Section bg={t.surfaceAlt} style={{ borderTopWidth: 2.5, borderTopColor: NAVY }}>
      <View {...r("stack-sm")} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space(6) }}>
        <View style={{ flex: 1 }}>
          <View {...r("reveal")}><Eyebrow tone="lemon">Guides</Eyebrow></View>
          <View {...r("reveal", "d1")}><H2 accent="malin.">Faire l’épicerie </H2></View>
        </View>
        <View {...r("reveal", "d2")}><Button label="Tous les guides" variant="secondary" href="/guides" icon={ArrowRight} /></View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(6), marginTop: space(14) }}>
        {GUIDES.slice(0, 3).map((g, k) => (
          <View key={g.slug} {...r("reveal", `d${k + 2}`)} style={{ flexGrow: 1, flexBasis: 300 }}>
            <Link href={`/guides/${g.slug}` as any} asChild>
              <Pressable {...r("press")} accessibilityRole="link"
                style={{ height: "100%", padding: space(7), borderRadius: radius.xl, backgroundColor: t.surface, borderWidth: 2.5, borderColor: NAVY, boxShadow: `5px 5px 0 ${NAVY}`, gap: space(4) } as ViewStyle}>
                <IconBadge icon={BookOpen} tone={(["cobalt", "pink", "lemon"] as const)[k]} size={48} />
                <Text style={{ fontFamily: font.display, fontSize: 23, lineHeight: 28, letterSpacing: -0.6, color: t.ink }}>{g.title}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 15, lineHeight: 23, color: t.muted }}>{g.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), marginTop: "auto" as any }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.primary }}>Lire le guide</Text>
                  <ArrowRight size={16} color={t.primary} strokeWidth={2.5} />
                </View>
              </Pressable>
            </Link>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

const FAQ = [
  ["Est-ce vraiment gratuit ?", "Oui. Gusto est financé par la publicité, affichée seulement si tu acceptes les témoins publicitaires. Il n’y a ni abonnement, ni version payante."],
  ["D’où viennent les prix ?", "D’épiceries.ca, un comparateur indépendant qui suit les prix en ligne de Maxi, Super C, IGA, Metro, Provigo et Walmart. Les prix sont mis à jour chaque jeudi, quand les nouvelles circulaires sortent. Ils sont relevés par bannière et peuvent varier un peu selon ta succursale."],
  ["Pourquoi mon total est-il plus bas que mon budget ?", "Gusto vise environ 95 % de ton budget. Cette marge absorbe les petits écarts de prix entre les succursales, pour que tu ne dépasses jamais le montant prévu à la caisse."],
  ["Dois-je créer un compte ?", "Non. Gusto ne demande ni nom, ni courriel. Tes choix et ton dernier menu restent sur ton appareil. Tu peux exporter ton menu en PDF ou l’ajouter à ton calendrier."],
  ["Les recettes conviennent-elles aux allergies ?", "Tu peux demander des recettes végétariennes, sans gluten ou sans noix. En cas d’allergie, vérifie toujours les étiquettes des produits que tu achètes : les recettes sont générées automatiquement et ne remplacent pas cette vérification."],
  ["Qui écrit les recettes ?", "Les recettes et les photos des plats sont générées par intelligence artificielle, puis vérifiées automatiquement. Les valeurs nutritives sont des estimations."],
] as const;

function Faq({ t }: { t: Theme }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section narrow>
      <View style={{ alignItems: "center" }}>
        <View {...r("reveal")}><Eyebrow tone="pink">Questions fréquentes</Eyebrow></View>
        <View {...r("reveal", "d1")}><H2 center accent="bonnes questions.">Les </H2></View>
      </View>
      <View style={{ marginTop: space(12), gap: space(4) }}>
        {FAQ.map(([q, a], i) => {
          const on = open === i;
          return (
            <View key={q} {...r("reveal", `d${(i % 4) + 1}`)} style={{ borderWidth: 2.5, borderColor: NAVY, borderRadius: radius.lg, backgroundColor: on ? t.primarySoft : t.surface, boxShadow: on ? `5px 5px 0 ${NAVY}` : `3px 3px 0 ${NAVY}`, overflow: "hidden" } as ViewStyle}>
              <Pressable onPress={() => setOpen(on ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: on }}
                style={{ flexDirection: "row", alignItems: "center", gap: space(4), paddingVertical: space(5), paddingHorizontal: space(6) }}>
                <Text role="heading" aria-level={3} style={{ flex: 1, fontFamily: font.display, fontSize: 18.5, lineHeight: 25, letterSpacing: -0.3, color: t.ink }}>{q}</Text>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: NAVY, backgroundColor: on ? t.tag : t.surface, alignItems: "center", justifyContent: "center", transform: [{ rotate: on ? "180deg" : "0deg" }] }}>
                  <ChevronDown size={18} color={NAVY} strokeWidth={3} />
                </View>
              </Pressable>
              <View {...(on ? r("step-in") : {})} style={{ display: on ? "flex" : "none", paddingBottom: space(6), paddingHorizontal: space(6) }}>
                <Text style={{ fontFamily: font.medium, fontSize: 16, lineHeight: 26, color: t.ink, opacity: 0.85 }}>{a}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

// ─── Dernier appel ──────────────────────────────────────────────────────────

function FinalCta({ onStart, t }: { onStart: () => void; t: Theme }) {
  return (
    <Section tight style={{ paddingBottom: space(28) }}>
      <View {...r("reveal-scale")}>
        <View {...r("stack-md", "card-pad")} style={{ backgroundColor: t.tag, borderRadius: 40, borderWidth: 3, borderColor: NAVY, boxShadow: `12px 12px 0 ${NAVY}`, padding: space(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(10), overflow: "hidden" } as ViewStyle}>
          <View {...r("spin", "hide-sm")} style={{ position: "absolute", right: -40, top: -50 }}><Burst size={200} color="#FF5FA2" /></View>
          <View style={{ flex: 1 }}>
            <Text {...r("h2")} style={{ fontFamily: font.display, fontSize: 60, lineHeight: 64, letterSpacing: -2.5, color: NAVY }}>
              Ta prochaine épicerie,{"\n"}<Text style={{ fontFamily: font.serif, fontSize: 68, letterSpacing: -0.5, color: "#2B44FF" }}>déjà planifiée.</Text>
            </Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 18, lineHeight: 27, color: NAVY, marginTop: space(4) }}>Gratuit, sans compte, en deux minutes.</Text>
          </View>
          <Button label="Créer mon menu" size="lg" icon={Sparkles} onPress={onStart} />
        </View>
      </View>
    </Section>
  );
}
