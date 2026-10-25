// Fiche d'une recette : en-tête, bande d'infos, ingrédients à cocher (ajustés aux portions),
// étapes numérotées, prix selon les épiceries, ajout au menu et note.
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { Check, ChevronRight, ExternalLink, ListPlus, Minus, Plus, Printer, ShoppingBasket, Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import { STORES, type ListItem, type StoreId } from "../../../shared/options";
import { Chip } from "../src/components/Chip";
import { SourceBadge, Stars } from "../src/components/RecipeBits";
import { Screen } from "../src/components/Screen";
import { Button } from "../src/components/ui";
import { addAddition, duration, getRecipe, isError, priceRecipe, rateRecipe, type PriceResult, type SectionRecipe } from "../src/sectionApi";
import { StoreLogo } from "../src/stores";
import { font, money, r, radius, space, useTheme } from "../src/theme";
import { dealText } from "../src/deal";

const storeLabel = (id: string) => STORES.find((s) => s.id === id)?.label ?? id;
const scrollTo = (id: string) => { if (Platform.OS === "web") document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

// Ajuste la première quantité d'une ligne d'ingrédient (« 30 ml (2 c. à soupe) d'huile » → « 45 ml d'huile »).
const FRAC: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const fmt = (n: number) => {
  if (n >= 20) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 2) / 2).replace(".", ",");
  const q = Math.round(n * 4) / 4;
  const whole = Math.floor(q), part = q - whole;
  const f = part === 0.25 ? "¼" : part === 0.5 ? "½" : part === 0.75 ? "¾" : "";
  return whole ? `${whole}${f ? " " + f : ""}` : f || String(Math.round(n * 10) / 10).replace(".", ",");
};
function scaleLine(line: string, factor: number) {
  if (Math.abs(factor - 1) < 0.001) return line;
  const s = line.replace(/\s*\([^)]*\)/g, "");
  const m = s.match(/(\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛])?|\d+\/\d+|[½¼¾⅓⅔⅛])/);
  if (!m || m.index === undefined) return line;
  const tok = m[0];
  let v: number;
  const fr = tok.match(/^(\d+)\/(\d+)$/);
  if (fr) v = +fr[1] / +fr[2];
  else if (FRAC[tok]) v = FRAC[tok];
  else { const u = tok.match(/[½¼¾⅓⅔⅛]/); v = parseFloat(tok.replace(",", ".")) + (u ? FRAC[u[0]] : 0); }
  const rest = s.slice(m.index + tok.length);
  const n = v * factor;
  // Mesures métriques : nombres ronds (« 6 ml », « 2,5 ml »), sinon fractions de cuisine (« 1 ¼ lime »)
  const metric = /^\s*(ml|g|kg|l|L)\b/.test(rest);
  const out = metric ? (n < 10 ? String(Math.round(n * 2) / 2).replace(".", ",") : String(Math.round(n))) : fmt(n);
  return s.slice(0, m.index) + out + rest;
}

export default function RecettePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [recipe, setRecipe] = useState<SectionRecipe | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setRecipe(null); return; }
    getRecipe(String(id)).then((res) => {
      if (isError(res) || !(res as SectionRecipe).title) { setError(isError(res) ? res.message : "Recette introuvable."); setRecipe(null); }
      else setRecipe(res as SectionRecipe);
    });
  }, [id]);

  return (
    <Screen>
      <Head>
        <title>{recipe ? `${recipe.title} · Recettes · Gusto` : "Recette · Gusto"}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: 1160, alignSelf: "center", paddingHorizontal: space(8), paddingTop: space(6), paddingBottom: space(20) }}>
        {recipe === undefined ? <ActivityIndicator color={t.primary} style={{ marginTop: space(16) }} /> : recipe === null ? (
          <View style={{ marginTop: space(12), gap: space(4) }}>
            <Text style={{ fontFamily: font.display, fontSize: 30, color: t.ink }}>Recette introuvable</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 16, color: t.muted }}>{error ?? "Elle a peut-être été retirée."}</Text>
            <Button label="Voir les recettes" href="/recettes" />
          </View>
        ) : <Recipe recipe={recipe} setRecipe={setRecipe} />}
      </View>
    </Screen>
  );
}

function Recipe({ recipe, setRecipe }: { recipe: SectionRecipe; setRecipe: (r: SectionRecipe) => void }) {
  const t = useTheme();
  const [people, setPeople] = useState(recipe.servings);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const factor = people / recipe.servings;
  const toggle = (set: Set<number>, k: number) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n; };
  const total = (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0);
  const by = recipe.source === "externe" || recipe.source === "communaute" ? recipe.author : null;

  const facts = [
    duration(recipe.prepMin) ? ["Préparation", duration(recipe.prepMin)!] : null,
    duration(recipe.cookMin) ? ["Cuisson", duration(recipe.cookMin)!] : null,
    total && recipe.prepMin && recipe.cookMin ? ["Temps total", duration(total)!] : null,
    ["Portions", `${recipe.servings}${recipe.servingsEstimated ? " (estimé)" : ""}`],
    recipe.temperature ? ["Four", recipe.temperature] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <View style={{ gap: space(10) }}>
      {/* Fil d'Ariane */}
      <View {...r("noprint")} style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), flexWrap: "wrap" }}>
        <Link href="/recettes" asChild>
          <Pressable {...r("dim")} accessibilityRole="link"><Text style={{ fontFamily: font.bold, fontSize: 14, color: t.primary }}>Recettes</Text></Pressable>
        </Link>
        <ChevronRight size={14} color={t.muted} strokeWidth={2.5} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.medium, fontSize: 14, color: t.muted }}>{recipe.title}</Text>
      </View>

      {/* En-tête : titre et actions à gauche, photo à droite */}
      <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(10), alignItems: "center" }}>
      <View style={{ flex: 1, gap: space(6) }}>
      <View {...r("rise")} style={{ gap: space(4), maxWidth: 860 }}>
        <SourceBadge source={recipe.source} />
        <Text role="heading" aria-level={1} {...r("title")} style={{ fontFamily: font.display, fontSize: 56, lineHeight: 60, letterSpacing: -2, color: t.ink }}>{recipe.title}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 16, color: t.ink }}>
          {recipe.source === "externe" ? (!by || /cuisinez|télé-québec/i.test(by) ? `Par l’équipe de ${recipe.sourceName}` : `Par ${by} · ${recipe.sourceName}`) : recipe.source === "communaute" ? `Partagée par ${by}` : "Recette Gusto"}
        </Text>
        <Pressable {...r("dim", "noprint")} onPress={() => scrollTo("note")} accessibilityRole="button" accessibilityLabel="Aller à la note"
          style={{ flexDirection: "row", alignItems: "center", gap: space(2), alignSelf: "flex-start" }}>
          <Stars value={recipe.rating.avg} size={20} />
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>{recipe.rating.count && recipe.rating.avg ? recipe.rating.avg.toFixed(1).replace(".", ",") : "Pas encore notée"}</Text>
          {recipe.rating.count ? <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.muted }}>({recipe.rating.count} avis)</Text> : null}
        </Pressable>
      </View>

      {/* Actions */}
      <View {...r("noprint", "rise", "d2")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>
        <Button label="Ajouter à mon menu" icon={ListPlus} onPress={() => scrollTo("prix")} />
        <Button label="Imprimer" icon={Printer} variant="secondary" onPress={() => Platform.OS === "web" && window.print()} />
        {recipe.source === "externe" && recipe.sourceUrl ? (
          <Link href={recipe.sourceUrl as any} target="_blank" rel="noopener noreferrer" asChild>
            <Pressable {...r("press")} accessibilityRole="link"
              style={{ flexDirection: "row", alignItems: "center", gap: space(2), height: 48, paddingHorizontal: space(5), borderRadius: 999, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surface } as ViewStyle}>
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Voir la recette originale</Text>
              <ExternalLink size={16} color={t.ink} strokeWidth={2.5} />
            </Pressable>
          </Link>
        ) : null}
      </View>
      </View>
      {recipe.photo ? <HeroPhoto uri={recipe.photo} title={recipe.title} credit={recipe.photoCredit ?? null} /> : null}
      </View>

      {/* Bande d'infos */}
      <View {...r("reveal", "stack-sm")} style={{ flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2, borderColor: t.edge }}>
        {facts.map(([label, value], k) => (
          <View key={label} style={{ flex: 1, paddingVertical: space(5), paddingHorizontal: space(5), gap: space(1), borderLeftWidth: k ? 1 : 0, borderLeftColor: t.line }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: t.muted }}>{label}</Text>
            <Text style={{ fontFamily: font.display, fontSize: 24, color: t.ink }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Ingrédients et préparation */}
      <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(12), alignItems: "flex-start" }}>
        <View {...r("reveal-left", "full-md", "sticky")} style={{ width: 380, gap: space(4), padding: space(6), borderRadius: radius.xl, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surfaceAlt }}>
          <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 28, color: t.ink }}>Ingrédients</Text>
          <View {...r("noprint")} style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <Round icon={Minus} label="Une portion de moins" disabled={people <= 1} onPress={() => setPeople(people - 1)} />
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: t.ink, minWidth: 96, textAlign: "center" }}>{people} portion{people > 1 ? "s" : ""}</Text>
            <Round icon={Plus} label="Une portion de plus" disabled={people >= 24} onPress={() => setPeople(people + 1)} />
          </View>
          {factor !== 1 ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted }}>Quantités ajustées pour {people} portions.</Text> : null}
          <View>
            {recipe.ingredients.map((i, k) => {
              const on = checked.has(k);
              return (
                <Pressable key={k} {...r("row")} onPress={() => setChecked(toggle(checked, k))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={{ flexDirection: "row", gap: space(3), paddingVertical: space(2.5), paddingHorizontal: space(1), borderBottomWidth: 1, borderBottomColor: t.line, alignItems: "flex-start" }}>
                  <View style={{ width: 22, height: 22, marginTop: 2, borderRadius: 6, borderWidth: 2, borderColor: t.edge, backgroundColor: on ? t.primary : t.surface, alignItems: "center", justifyContent: "center" }}>
                    {on ? <Check size={14} color="#FFFFFF" strokeWidth={3.5} /> : null}
                  </View>
                  <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15.5, lineHeight: 23, color: on ? t.muted : t.ink, textDecorationLine: on ? "line-through" : "none" }}>{scaleLine(i.display, factor)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View {...r("full-md")} style={{ flex: 1, gap: space(2) }}>
          <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 28, color: t.ink, marginBottom: space(2) }}>Préparation</Text>
          {recipe.steps.map((s, k) => {
            const on = done.has(k);
            return (
              <Pressable key={k} {...r("reveal", `d${Math.min(k + 1, 6)}`, "row")} onPress={() => setDone(toggle(done, k))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={{ flexDirection: "row", gap: space(5), paddingVertical: space(5), paddingHorizontal: space(3), borderBottomWidth: 1, borderBottomColor: t.line, opacity: on ? 0.45 : 1, borderRadius: radius.md }}>
                <Text {...r("rank")} style={{ fontFamily: font.display, fontSize: 40, lineHeight: 42, width: 48, color: on ? t.muted : t.primary }}>{k + 1}</Text>
                <View style={{ flex: 1, gap: space(1) }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: t.muted }}>Étape {k + 1}{on ? " · faite" : ""}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 17, lineHeight: 28, color: t.ink }}>{s}</Text>
                </View>
              </Pressable>
            );
          })}
          <Text {...r("noprint")} style={{ fontFamily: font.medium, fontSize: 13, color: t.muted, marginTop: space(2) }}>Touche une étape ou un ingrédient pour le cocher.</Text>
          {recipe.source === "externe" ? (
            <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: t.muted, marginTop: space(4) }}>
              Nom, ingrédients, portions et temps tirés de la recette originale de {recipe.sourceName}. Les étapes sont résumées dans nos mots.
            </Text>
          ) : null}
        </View>
      </View>

      <View nativeID="prix" {...r("noprint", "reveal")}><Prices recipe={recipe} people={people} setPeople={setPeople} /></View>
      <View nativeID="note" {...r("noprint", "reveal")}><Rate recipe={recipe} setRecipe={setRecipe} /></View>
    </View>
  );
}

const LICENSE: Record<string, string> = { cc0: "CC0", pdm: "domaine public" };

/** Grande photo du plat, avec le crédit de la photo libre de droits. */
function HeroPhoto({ uri, title, credit }: { uri: string; title: string; credit: { creator: string | null; license: string; source: string; landing: string } | null }) {
  const t = useTheme();
  return (
    <View {...r("full-md", "rise", "d1")} style={{ width: 460, gap: space(2) }}>
      <View style={{ borderRadius: radius.xl, borderWidth: 2, borderColor: t.edge, overflow: "hidden", boxShadow: `8px 8px 0 ${t.edge}`, backgroundColor: t.surfaceAlt } as ViewStyle}>
        <Image {...r("hero-photo")} source={{ uri }} style={{ width: "100%", aspectRatio: 4 / 3 }} contentFit="cover" transition={300}
          accessibilityLabel={`Photo d’illustration : ${title}`} />
      </View>
      {credit ? (
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: t.muted }}>
          Photo d’illustration{credit.creator ? ` : ${credit.creator}` : ""} ({LICENSE[credit.license] ?? credit.license}
          {credit.landing ? <>, <Link href={credit.landing as any} target="_blank" rel="noopener noreferrer" style={{ color: t.muted, textDecorationLine: "underline" }}>{credit.source || "source"}</Link></> : null})
        </Text>
      ) : null}
    </View>
  );
}

function Rate({ recipe, setRecipe }: { recipe: SectionRecipe; setRecipe: (r: SectionRecipe) => void }) {
  const t = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  async function rate(n: number) {
    const res = await rateRecipe(recipe.id, n);
    if (isError(res) || !res.ok) { setMsg((res as any).message ?? "Vote impossible pour l’instant."); return; }
    setRecipe({ ...recipe, rating: res.rating!, myStars: res.myStars ?? n });
    setMsg(recipe.myStars ? "Ta note a été modifiée. Merci!" : "Merci pour ton vote!");
  }
  return (
    <View {...r("stack-sm")} style={{ flexDirection: "row", alignItems: "center", gap: space(8), padding: space(8), borderRadius: radius.xl, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tagSoft }}>
      <View style={{ alignItems: "center", gap: space(1), minWidth: 140 }}>
        <Text style={{ fontFamily: font.display, fontSize: 56, lineHeight: 60, color: t.ink }}>{recipe.rating.count && recipe.rating.avg ? recipe.rating.avg.toFixed(1).replace(".", ",") : "–"}</Text>
        <Stars value={recipe.rating.avg} size={18} />
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted }}>{recipe.rating.count} avis</Text>
      </View>
      <View style={{ flex: 1, gap: space(2) }}>
        <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 26, color: t.ink }}>{recipe.myStars ? "Ta note" : "Tu l’as essayée ?"}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.muted }}>
          {recipe.rating.sourceCount ? `La note de départ vient de ${recipe.rating.sourceCount} avis sur ${recipe.sourceName}. ` : ""}Ton vote compte aussi.
        </Text>
        <Stars value={recipe.rating.avg} mine={recipe.myStars} size={34} onRate={rate} />
        {msg ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.semibold, fontSize: 14, color: t.ink }}>{msg}</Text> : null}
      </View>
    </View>
  );
}

// ---------- Prix et ajout au menu ----------

function Prices({ recipe, people, setPeople }: { recipe: SectionRecipe; people: number; setPeople: (n: number) => void }) {
  const t = useTheme();
  const [stores, setStores] = useState<StoreId[]>([]);
  const [mode, setMode] = useState<"une" | "plusieurs">("plusieurs");
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!stores.length) { setPrice(null); return; }
    setBusy(true);
    priceRecipe(recipe.id, people, stores).then((res) => { setBusy(false); setPrice(isError(res) ? null : (res as PriceResult)); });
  }, [recipe.id, people, stores.join(",")]);

  const multi = stores.length > 1 && mode === "plusieurs" && price?.multi;
  const shown = multi ? { total: price!.multi!.total, items: price!.multi!.items, pantry: price!.multi!.pantry } : price?.best ?? null;

  async function add(withRecipe: boolean) {
    if (!shown || !price) return;
    await addAddition({
      recipeId: recipe.id, title: recipe.title, people, withRecipe, mode: multi ? "plusieurs" : "une",
      storesLabel: multi ? stores.map(storeLabel).join(", ") : price.best!.label, total: shown.total, items: shown.items, pantry: shown.pantry,
    });
    setAdded(withRecipe ? "Recette et ingrédients ajoutés à ton menu." : "Ingrédients ajoutés à ta liste d’épicerie.");
  }

  return (
    <View {...r("card-pad")} style={{ borderWidth: 2, borderColor: t.edge, borderRadius: radius.xl, backgroundColor: t.surface, boxShadow: `8px 8px 0 ${t.edge}`, padding: space(8), gap: space(6) } as ViewStyle}>
      <View style={{ gap: space(1) }}>
        <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 28, color: t.ink }}>Combien ça coûte ?</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.muted }}>Prix de la semaine pour {people} portion{people > 1 ? "s" : ""}, au nombre d’emballages à acheter.</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space(4), flexWrap: "wrap" }}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Portions</Text>
        <Round icon={Minus} label="Une portion de moins" disabled={people <= 1} onPress={() => setPeople(people - 1)} />
        <Text style={{ fontFamily: font.display, fontSize: 28, color: t.primary, minWidth: 40, textAlign: "center" }}>{people}</Text>
        <Round icon={Plus} label="Une portion de plus" disabled={people >= 24} onPress={() => setPeople(people + 1)} />
      </View>

      <View style={{ gap: space(3) }}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Où fais-tu ton épicerie ?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
          {STORES.map((s) => {
            const on = stores.includes(s.id);
            return (
              <Pressable key={s.id} onPress={() => setStores(on ? stores.filter((x) => x !== s.id) : [...stores, s.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={s.label}
                {...r("press")} style={{ height: 52, minWidth: 104, paddingHorizontal: space(3), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: on ? t.tag : t.surface, alignItems: "center", justifyContent: "center", boxShadow: on ? `3px 3px 0 ${t.edge}` : "none" } as ViewStyle}>
                <StoreLogo id={s.id} label={s.label} maxW={78} maxH={26} />
              </Pressable>
            );
          })}
        </View>
        {stores.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
            <Chip radio label="Une seule épicerie" selected={mode === "une"} onPress={() => setMode("une")} />
            <Chip radio label="Plusieurs épiceries" selected={mode === "plusieurs"} onPress={() => setMode("plusieurs")} />
          </View>
        ) : null}
      </View>

      {!stores.length ? (
          <View style={{ padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderStyle: "dashed", borderColor: t.edge, backgroundColor: t.surfaceAlt }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 15.5, lineHeight: 23, color: t.ink }}>Choisis une ou plusieurs épiceries pour voir le prix de cette recette.</Text>
          </View>
        )
        : busy && !price ? <ActivityIndicator color={t.primary} /> : !price || !shown ? (
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.muted }}>Les prix ne sont pas encore disponibles pour cette recette.</Text>
        ) : (
          <View style={{ gap: space(5), opacity: busy ? 0.5 : 1 }}>
            <View {...r("stack-sm")} style={{ flexDirection: "row", gap: space(4), alignItems: "stretch" }}>
              <View {...r("pop-in")} style={{ flex: 1, padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.primary, gap: space(1) }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 14, color: "#C9D0FF" }}>{multi ? `En combinant ${stores.length} épiceries` : `Meilleur prix : ${price.best?.label}`}</Text>
                <Text style={{ fontFamily: font.display, fontSize: 40, lineHeight: 44, color: "#FFFFFF" }}>{money(shown.total)}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 14, color: "#FFFFFF" }}>{money(shown.total / people)} par portion</Text>
              </View>
              {multi && price.multi!.savings > 0 ? (
                <View {...r("pop-in", "d1")} style={{ flex: 1, padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tag, gap: space(1), justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: "#0E1030" }}>Tu économises</Text>
                  <Text style={{ fontFamily: font.display, fontSize: 34, color: "#0E1030" }}>{money(price.multi!.savings)}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: "#0E1030" }}>par rapport à tout acheter chez {price.best?.label}</Text>
                </View>
              ) : null}
            </View>

            {price.single.length > 1 ? (
              <View style={{ gap: space(2) }}>
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Tout acheter dans une seule épicerie</Text>
                {price.single.map((s, k) => (
                  <View key={s.store} style={{ flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: t.line }}>
                    <Text style={{ flex: 1, fontFamily: k === 0 ? font.bold : font.medium, fontSize: 15, color: t.ink }}>{s.label}{k === 0 ? "  · le moins cher" : ""}{s.estimated ? `  (${s.estimated} prix estimé${s.estimated > 1 ? "s" : ""})` : ""}</Text>
                    <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink, fontVariant: ["tabular-nums"] }}>{money(s.total)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <ItemList items={shown.items} byStore={!!multi} />
            {shown.pantry.length || price.pantryMissing?.length ? (
              <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: t.muted }}>
                Garde-manger à vérifier (non compté) : {[...shown.pantry.map((p) => p.ingredient), ...(price.pantryMissing ?? [])].join(", ")}.
              </Text>
            ) : null}
            {price.missing.length ? (
              <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: t.muted }}>
                Prix à venir (non compté) : {price.missing.join(" · ")}.
              </Text>
            ) : null}

            <View {...r("stack-sm")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>
              <Button label="Ajouter à mon menu" icon={ListPlus} onPress={() => add(true)} />
              <Button label="Ajouter à ma liste d’épicerie" icon={ShoppingBasket} variant="secondary" onPress={() => add(false)} />
            </View>
            {added ? (
              <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: space(3), flexWrap: "wrap", padding: space(4), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tagSoft }}>
                <Check size={18} color={t.ink} strokeWidth={3} />
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: t.ink }}>{added}</Text>
                <Button label="Voir mon menu" size="sm" variant="accent" onPress={() => router.push("/menu")} />
              </View>
            ) : null}
          </View>
        )}
    </View>
  );
}

function ItemList({ items, byStore }: { items: ListItem[]; byStore: boolean }) {
  const t = useTheme();
  const groups = byStore ? STORES.map((s) => [s.id, items.filter((i) => i.store === s.id)] as const).filter(([, l]) => l.length) : [["", items] as const];
  return (
    <View style={{ gap: space(4) }}>
      {groups.map(([store, list]) => (
        <View key={store || "tout"} style={{ gap: space(1) }}>
          {store ? <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Chez {storeLabel(store)} · {money(list.reduce((n, i) => n + i.total, 0))}</Text> : null}
          {list.map((i) => (
            <View key={`${i.ingredient}-${i.product}`} style={{ flexDirection: "row", gap: space(3), paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: t.line }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 15, color: t.ink }}>{i.packages} × {i.product}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted }}>
                  {i.size}{i.discounted ? ` · ${dealText(i)}` : ""}{i.estimated ? " · prix estimé" : ""}
                </Text>
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink, fontVariant: ["tabular-nums"] }}>{money(i.total)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Round({ icon: IconC, label, onPress, disabled }: { icon: typeof Plus; label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} {...r("press")}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tag, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}>
      <IconC size={17} color="#0E1030" strokeWidth={3} />
    </Pressable>
  );
}
