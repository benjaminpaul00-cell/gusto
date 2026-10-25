import { Image } from "expo-image";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { ArrowLeft, ArrowRight, CalendarDays, FileDown, Info, ShoppingBasket, Utensils, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DatePicker, longDate } from "../src/components/DatePicker";
import { Screen } from "../src/components/Screen";
import { Button, IconBadge } from "../src/components/ui";
import { CUISINES, MEALS, STORES, type ListItem, type PlanResponse, type RecipeView } from "../../../shared/options";
import { AdSlot } from "../src/components/AdSlot";
import { AddedGroceries, AddedRecipes, useAdditions } from "../src/components/Additions";
import { Chip } from "../src/components/Chip";
import { PriceTag } from "../src/components/PriceTag";
import { useConsent } from "../src/consent";
import { buildPdfHtml } from "../src/export/html";
import { buildIcs } from "../src/export/ics";
import { exportPdf } from "../src/export/pdf";
import { saveFile } from "../src/export/save";
import { loadPlan } from "../src/storage";
import { font, money, r as rsp, radius, space, useTheme, type Theme } from "../src/theme";
import { dealText } from "../src/deal";

type Plan = Extract<PlanResponse, { ok: true }>;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

// Page personnelle (le menu vient de l'appareil) : rien à indexer pour Google.
export default function MenuPage() {
  return (
    <>
      <Head>
        <title>Mon menu · Gusto</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Menu />
    </>
  );
}

function Menu() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { consent } = useConsent();
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [week, setWeek] = useState(1);
  const [tab, setTab] = useState<"menu" | "liste">("menu");
  const [open, setOpen] = useState<RecipeView | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState<"pdf" | "cal" | null>(null);
  const additions = useAdditions();

  useEffect(() => { loadPlan().then(setPlan); }, []);

  if (plan === undefined) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (plan === null) {
    return (
      <Screen>
        <View style={[s.center, { minHeight: 480 }]}>
          <IconBadge icon={Utensils} size={64} />
          <Text style={s.h2}>Aucun menu pour l’instant</Text>
          <Text style={[s.note, { textAlign: "center", maxWidth: 380 }]}>Réponds à quelques questions et Gusto prépare ton menu et ta liste d’épicerie.</Text>
          <Button label="Créer un menu" icon={ArrowRight} href="/#planificateur" />
        </View>
        {additions.list.length ? (
          <View {...rsp("gutter")} style={[s.page, { paddingBottom: space(16), gap: space(6) }]}>
            <AddedRecipes {...additions} />
            <AddedGroceries {...additions} />
          </View>
        ) : null}
      </Screen>
    );
  }

  const w = plan.weeks[week - 1];
  // Une ou plusieurs épiceries : « Maxi » ou « Maxi et Super C »
  const storeIds = plan.request.stores?.length ? plan.request.stores : [plan.request.store];
  const storeNames = storeIds.map((id) => label(STORES, id));
  const store = storeNames.length > 1 ? `${storeNames.slice(0, -1).join(", ")} et ${storeNames[storeNames.length - 1]}` : storeNames[0];
  const mealsCount = plan.weeks.reduce((n, x) => n + x.days.reduce((m, d) => m + d.meals.length, 0), 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ borderBottomWidth: 1, borderBottomColor: t.line }}>
          <View {...rsp("gutter")} style={[s.page, { paddingTop: space(10), paddingBottom: space(10) }]}>
            <Link href="/#planificateur" asChild>
              <Pressable {...rsp("dim")} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: space(2), alignSelf: "flex-start" }}>
                <ArrowLeft size={16} color={t.primary} strokeWidth={2.25} />
                <Text style={s.back}>Modifier mes choix</Text>
              </Pressable>
            </Link>
            <View {...rsp("stack-sm")} style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space(8), marginTop: space(8) }}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>Ton menu</Text>
                <Text role="heading" aria-level={1} {...rsp("title")} style={s.title}>{`${mealsCount} repas chez ${store}`}</Text>
                <Text style={s.heroText}>
                  {plan.request.people} personne{plan.request.people > 1 ? "s" : ""} · {plan.weeks.length} semaine{plan.weeks.length > 1 ? "s" : ""}
                  {plan.weeks.length > 1 ? ". Les semaines 2 et plus sont estimées au prix régulier : le vrai total sera égal ou plus bas." : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-start", gap: space(2) }}>
                <PriceTag amount={plan.total} caption={`sur un budget de ${money(plan.request.budget)}`} />
              </View>
            </View>
          </View>
        </View>

        <View {...rsp("gutter")} style={[s.page, { paddingTop: space(8), paddingBottom: space(20) }]}>
          {plan.notices?.length ? (
            <View accessibilityRole="alert" style={{ marginBottom: space(6), padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tagSoft, gap: space(2) }}>
              {plan.notices.map((n) => (
                <View key={n} style={{ flexDirection: "row", gap: space(3) }}>
                  <Info size={18} color={t.ink} strokeWidth={2.25} />
                  <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: t.ink }}>{n}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {plan.weeks.length > 1 ? (
            <View style={[s.chips, { marginBottom: space(5) }]}>
              {plan.weeks.map((x) => <Chip key={x.week} radio label={`Semaine ${x.week}`} selected={week === x.week} onPress={() => setWeek(x.week)} />)}
            </View>
          ) : null}

          <View style={s.tabs} accessibilityRole="tablist">
            {(["menu", "liste"] as const).map((k) => (
              <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
                style={[s.tab, tab === k && s.tabOn]}>
                {k === "menu" ? <Utensils size={16} color={tab === k ? t.ink : t.muted} strokeWidth={2.25} /> : <ShoppingBasket size={16} color={tab === k ? t.ink : t.muted} strokeWidth={2.25} />}
                <Text style={[s.tabText, tab === k && { color: t.ink }]}>{k === "menu" ? "Menu" : `Liste · ${money(w.total)}`}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "menu" ? (
            <View style={{ gap: space(6) }}>
              {w.days.map((d) => (
                <View key={d.day} style={{ gap: space(3) }}>
                  <Text style={s.day}>{DAYS[d.day - 1]}</Text>
                  {plan.request.meals.map((meal) => {
                    const m = d.meals.find((x) => x.meal === meal);
                    if (!m) {
                      // Repas laissé libre pour respecter le budget
                      return (
                        <View key={meal} style={[s.card, { borderStyle: "dashed", boxShadow: "none", paddingVertical: space(4) } as any]}>
                          <Text style={s.cardMeal}>{label(MEALS, meal)}</Text>
                          <Text style={[s.note, { flex: 1 }]}>Repas libre : non inclus dans ton budget.</Text>
                        </View>
                      );
                    }
                    const r = plan.recipes[m.recipeId];
                    return <MealCard key={m.meal} r={r} meal={label(MEALS, m.meal)} onPress={() => setOpen(r)} s={s} t={t} />;
                  })}
                </View>
              ))}
              <AddedRecipes {...additions} />
            </View>
          ) : (
            <View>
              <GroceryList w={w} checked={checked} setChecked={setChecked} s={s} t={t} />
              <AddedGroceries {...additions} />
            </View>
          )}

          <AdSlot consent={consent} />

          <View {...rsp("stack-sm", "card-pad")} style={s.exportBox}>
            <View style={{ flex: 1, gap: space(1) }}>
              <Text style={[s.h3, { marginTop: 0, marginBottom: 0, color: t.onBrand }]}>Emporte ton menu</Text>
              <Text style={[s.note, { color: t.onBrandMuted }]}>Imprime ta liste ou ajoute tes repas à ton calendrier.</Text>
            </View>
            <View style={s.chips}>
              <Button label="PDF" variant="inverse" icon={FileDown} onPress={() => setExporting("pdf")} a11y="Exporter en PDF" />
              <Button label="Calendrier" variant="accent" icon={CalendarDays} onPress={() => setExporting("cal")} a11y="Ajouter à mon calendrier" />
            </View>
          </View>

          <Text style={s.footer}>
            Prix indicatifs fournis par épiceries.ca, basés sur les prix en ligne de la bannière. Ils peuvent varier légèrement selon la succursale. Les images des plats sont illustratives et générées par IA.
          </Text>
        </View>
      </Screen>

      <RecipeSheet r={open} onClose={() => setOpen(null)} s={s} t={t} />
      <ExportSheet mode={exporting} plan={plan} onClose={() => setExporting(null)} s={s} t={t} />
    </View>
  );
}

function Dish({ r, size, s, t }: { r: RecipeView; size: number; s: Styles; t: Theme }) {
  if (r.image) return <Image source={{ uri: r.image }} style={{ width: size, height: size, borderRadius: radius.md }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
  // Illustration de secours tant que l'image n'est pas prête
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: ["#2B44FF", "#FF5FA2", "#FFE14D"][r.name.length % 3], borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
      <Utensils size={size * 0.32} color={r.name.length % 3 === 0 ? "#FFFFFF" : "#0E1030"} strokeWidth={2} />
    </View>
  );
}

function MealCard({ r, meal, onPress, s, t }: { r: RecipeView; meal: string; onPress: () => void; s: Styles; t: Theme }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`${meal} : ${r.name}. Voir la recette.`}>
      <Dish r={r} size={88} s={s} t={t} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.cardMeal}>{meal} · {label(CUISINES, r.cuisine)}</Text>
        <Text style={s.cardTitle}>{r.name}</Text>
        <Text style={s.cardMeta}>{money(r.costPerPortion)} par portion · {Math.round(r.kcal)} kcal · {Math.round(r.protein)} g de protéines</Text>
        {r.specialty.length ? <Text style={[s.cardMeta, { color: t.sale }]}>Demande un arrêt en épicerie spécialisée</Text> : null}
      </View>
    </Pressable>
  );
}

function GroceryList({ w, checked, setChecked, s, t }: { w: Plan["weeks"][number]; checked: Record<string, boolean>; setChecked: (f: (c: Record<string, boolean>) => Record<string, boolean>) => void; s: Styles; t: Theme }) {
  // Plusieurs épiceries : la liste est séparée par magasin (chaque article là où il coûte le moins)
  const storesUsed = STORES.map((x) => x.id as string).filter((id) => w.list.some((i) => i.store === id) || w.pantry.some((i) => i.store === id));
  const multi = storesUsed.length > 1;
  let showStore = false;
  const block = (title: string | null, items: ListItem[], note?: string, withStore = false) => {
    showStore = withStore;
    if (!items.length) return null;
    let section = "";
    return (
      <View style={{ marginTop: space(6) }}>
        {title ? <Text style={s.h3}>{title}</Text> : null}
        {note ? <Text style={s.note}>{note}</Text> : null}
        {items.map((i) => {
          const key = `${w.week}:${i.ingredient}:${i.product}`;
          const head = i.section !== section ? <Text key={`h-${key}`} style={s.section}>{(section = i.section)}</Text> : null;
          const on = !!checked[key];
          return (
            <View key={key}>
              {head}
              <Pressable onPress={() => setChecked((c) => ({ ...c, [key]: !on }))} style={s.item} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[s.box, on && { backgroundColor: t.primary, borderColor: t.primary }]}>{on ? <Text style={{ color: t.onPrimary, fontSize: 13 }}>✓</Text> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemName, on && { textDecorationLine: "line-through", color: t.muted }]}>{i.packages} × {i.product}</Text>
                  <Text style={s.itemMeta}>{i.size}{showStore && i.store ? ` · chez ${label(STORES, i.store)}` : ""}{i.discounted ? "  " : ""}{i.discounted ? <Text style={{ color: t.sale, fontFamily: font.semibold }}>{dealText(i)}</Text> : null}{i.estimated ? <Text style={{ color: t.muted, fontFamily: font.semibold }}>  prix estimé</Text> : null}</Text>
                </View>
                <Text style={s.itemPrice}>{money(i.total)}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };
  return (
    <View>
      {w.estimated ? <Text style={s.note}>Estimation au prix régulier : les rabais de cette semaine ne sont pas encore publiés.</Text> : null}
      {multi
        ? storesUsed.map((id) => {
            const items = w.list.filter((i) => i.store === id);
            const sub = items.reduce((n, i) => n + i.total, 0);
            return <View key={id}>{block(`Chez ${label(STORES, id)} · ${money(sub)}`, items, items.length ? undefined : undefined)}</View>;
          })
        : block(null, w.list)}
      {block("À vérifier dans ton garde-manger", w.pantry, w.pantryIncluded === false ? "Non inclus dans le total : on suppose que tu les as déjà. Achète seulement ce qui te manque." : "Déjà inclus dans le total. Retire ce que tu as déjà et économise d’autant.", multi)}
      {block("À acheter dans une épicerie spécialisée", w.specialty, "Prix estimé : le total compte le haut de la fourchette.")}
    </View>
  );
}

function RecipeSheet({ r, onClose, s, t }: { r: RecipeView | null; onClose: () => void; s: Styles; t: Theme }) {
  return (
    <Modal visible={!!r} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.sheetWrap}>
        <View style={s.sheet}>
          <Pressable onPress={onClose} style={s.close} accessibilityLabel="Fermer la recette" accessibilityRole="button"><X size={22} color={t.ink} strokeWidth={2} /></Pressable>
          {r ? (
            <ScrollView contentContainerStyle={{ padding: space(5), paddingBottom: space(12) }}>
              {r.image ? <Image source={{ uri: r.image }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md }} contentFit="cover" /> : null}
              <Text style={[s.h2, { marginTop: space(4) }]}>{r.name}</Text>
              <Text style={s.cardMeta}>{r.servings} portions · {Math.round(r.kcal)} kcal et {Math.round(r.protein)} g de protéines par portion</Text>

              <Text style={s.h3}>Ingrédients</Text>
              {r.ingredients.map((i) => <Text key={i.name} style={s.li}>• {i.display}</Text>)}

              {r.homemade.map((h) => (
                <View key={h.name}>
                  <Text style={s.h3}>{h.name} maison</Text>
                  <Text style={s.note}>Introuvable à ton épicerie : voici comment le préparer. Ses ingrédients sont dans ta liste.</Text>
                  {h.ingredients.map((x) => <Text key={x} style={s.li}>• {x}</Text>)}
                  {h.steps.map((st, i) => <Text key={i} style={s.li}>{i + 1}. {st}</Text>)}
                </View>
              ))}

              {r.specialty.map((sp) => (
                <Text key={sp.name} style={[s.note, { marginTop: space(4) }]}>{sp.name} : à trouver dans une {sp.where}, environ {money(sp.priceMax)} au maximum.</Text>
              ))}

              <Text style={s.h3}>Préparation</Text>
              {r.steps.map((st, i) => <Text key={i} style={s.li}>{i + 1}. {st}</Text>)}
              {r.image ? <Text style={[s.note, { marginTop: space(6) }]}>Image illustrative générée par IA.</Text> : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ExportSheet({ mode, plan, onClose, s, t }: { mode: "pdf" | "cal" | null; plan: Plan; onClose: () => void; s: Styles; t: Theme }) {
  const [what, setWhat] = useState<"list" | "recipes" | "both">("both");
  const [start, setStart] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Dernier jour couvert par le menu (date de début + nombre de semaines)
  const end = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + plan.weeks.length * 7 - 1) : null;

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "pdf") {
        await exportPdf(buildPdfHtml(plan, { list: what !== "recipes", recipes: what !== "list" }));
      } else {
        if (!start) { setBusy(false); setMsg("Choisis d’abord la date de début de ton menu."); return; }
        const ics = buildIcs(plan, { start, shopping: what !== "recipes", meals: what !== "list" });
        await saveFile("gusto-menu.ics", ics, "text/calendar");
        setMsg("Fichier téléchargé. Ouvre-le pour l’ajouter à ton calendrier.");
      }
    } catch {
      setMsg("L’exportation n’a pas fonctionné. Réessaie.");
    }
    setBusy(false);
  }

  const options = mode === "pdf"
    ? [["list", "Liste d’épicerie"], ["recipes", "Recettes"], ["both", "Les deux"]]
    : [["list", "Jour d’épicerie"], ["recipes", "Repas de chaque jour"], ["both", "Les deux"]];

  return (
    <Modal visible={!!mode} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <ScrollView style={s.sheet} contentContainerStyle={{ padding: space(5), gap: space(4) }}>
          <Text style={s.h2}>{mode === "pdf" ? "Exporter en PDF" : "Ajouter à mon calendrier"}</Text>
          <View style={s.chips}>
            {options.map(([k, l]) => <Chip key={k} label={l} selected={what === k} onPress={() => setWhat(k as typeof what)} />)}
          </View>
          {mode === "cal" ? (
            <>
              <Text style={[s.cardMeta, { fontFamily: font.bold, color: t.ink }]}>Quand commence ton menu ?</Text>
              <DatePicker value={start} onChange={(d) => { setStart(d); setMsg(null); }} />
              <Text style={s.note}>{start && end ? `Du ${longDate(start)} au ${longDate(end)}.` : "Touche une date dans le calendrier."}</Text>
            </>
          ) : null}
          {msg ? <Text style={s.note}>{msg}</Text> : null}
          <View style={[s.chips, { justifyContent: "flex-end" }]}>
            <Pressable style={s.btn} onPress={onClose}><Text style={s.btnText}>Fermer</Text></Pressable>
            <Pressable style={[s.btn, { backgroundColor: t.primary, borderColor: t.primary, opacity: mode === "cal" && !start ? 0.4 : 1 }]} onPress={run} disabled={busy || (mode === "cal" && !start)}>
              <Text style={[s.btnText, { color: t.onPrimary }]}>{busy ? "Préparation…" : mode === "pdf" ? "Créer le PDF" : "Télécharger le calendrier"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

type Styles = ReturnType<typeof makeStyles>;
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    page: { width: "100%", maxWidth: 880, alignSelf: "center", paddingHorizontal: space(8) },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space(4), padding: space(8) },
    back: { fontFamily: font.semibold, color: t.primary, fontSize: 14.5 },
    eyebrow: { fontFamily: font.semibold, fontSize: 13, letterSpacing: 1.6, textTransform: "uppercase", color: t.primary },
    title: { fontFamily: font.display, fontSize: 52, lineHeight: 58, letterSpacing: -2, color: t.ink, marginTop: space(2) },
    heroText: { fontFamily: font.body, color: t.muted, fontSize: 16.5, lineHeight: 25, maxWidth: 520, marginTop: space(3) },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
    tabs: { flexDirection: "row", alignSelf: "flex-start", gap: space(1), padding: space(1), marginBottom: space(8), borderRadius: 999, backgroundColor: t.surfaceAlt, borderWidth: 2, borderColor: t.edge },
    tab: { flexDirection: "row", alignItems: "center", gap: space(2), height: 42, paddingHorizontal: space(5), borderRadius: 999 },
    tabOn: { backgroundColor: t.tag, borderWidth: 2, borderColor: t.edge } as any,
    tabText: { fontFamily: font.semibold, fontSize: 15, color: t.muted },
    day: { fontFamily: font.display, fontSize: 28, color: t.ink, letterSpacing: -1 },
    card: { flexDirection: "row", gap: space(4), alignItems: "center", backgroundColor: t.surface, borderRadius: radius.lg, padding: space(3), paddingRight: space(5), borderWidth: 2, borderColor: t.edge, boxShadow: t.shadow } as any,
    cardMeal: { fontFamily: font.bold, color: t.primary, fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase" },
    cardTitle: { fontFamily: font.display, color: t.ink, fontSize: 20, lineHeight: 26 },
    cardMeta: { fontFamily: font.body, color: t.muted, fontSize: 13.5, lineHeight: 19 },
    h2: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: t.ink, letterSpacing: -0.5 },
    h3: { fontFamily: font.display, fontSize: 22, color: t.ink, marginTop: space(8), marginBottom: space(2) },
    section: { fontFamily: font.semibold, color: t.primary, fontSize: 12.5, letterSpacing: 1.2, textTransform: "uppercase", marginTop: space(6), marginBottom: space(1) },
    item: { flexDirection: "row", alignItems: "center", gap: space(4), paddingVertical: space(4), borderBottomWidth: 1, borderBottomColor: t.line },
    box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" },
    itemName: { fontFamily: font.medium, color: t.ink, fontSize: 15.5, lineHeight: 21 },
    itemMeta: { fontFamily: font.body, color: t.muted, fontSize: 13 },
    itemPrice: { fontFamily: font.semibold, color: t.ink, fontSize: 15, fontVariant: ["tabular-nums"] },
    note: { fontFamily: font.body, color: t.muted, fontSize: 14.5, lineHeight: 21 },
    li: { fontFamily: font.body, color: t.ink, fontSize: 16, lineHeight: 26 },
    exportBox: { marginTop: space(12), padding: space(8), borderRadius: radius.xl, backgroundColor: t.brand, gap: space(5), flexDirection: "row", alignItems: "center", borderWidth: 2.5, borderColor: t.edge, boxShadow: t.shadowLg } as any,
    btn: { height: 44, justifyContent: "center", paddingHorizontal: space(5), borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.surface },
    btnText: { fontFamily: font.semibold, color: t.ink, fontSize: 15 },
    footer: { fontFamily: font.body, color: t.muted, fontSize: 13, lineHeight: 19, marginTop: space(8) },
    sheetWrap: { flex: 1, backgroundColor: "rgba(10,20,14,0.5)", justifyContent: "flex-end", alignItems: "center" },
    sheet: { width: "100%", maxWidth: 760, maxHeight: "92%", backgroundColor: t.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden", borderWidth: 2.5, borderColor: t.edge },
    close: { position: "absolute", top: space(3), right: space(3), zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: t.tag, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" },
  });
