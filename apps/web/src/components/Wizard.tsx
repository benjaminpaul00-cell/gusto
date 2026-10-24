// Planificateur interactif : une question à la fois, grandes tuiles, transitions animées.
import { router } from "expo-router";
import {
  ArrowLeft, ArrowRight, Ban, BadgePercent, CandyOff, Check, CookingPot, Dumbbell, Flame, Leaf, MilkOff, Minus, Moon, Nut, Pencil, Plus,
  Sparkles, Sun, Sunrise, User, Wheat,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Platform, Pressable, Switch, Text, TextInput, useWindowDimensions, View, type ViewStyle } from "react-native";
import {
  BUDGET_SAFETY, CUISINES, DIETS, LIMITS, MEALS, STORES, STYLES,
  type CuisineId, type DietId, type MealId, type PlanRequest, type StoreId, type StyleId,
} from "../../../../shared/options";
import { requestPlan } from "../api";
import { CUISINE_PAGES } from "../content/cuisines";
import { saveForm, savePlan } from "../storage";
import { StoreLogo } from "../stores";
import { font, money, r, radius, space, useTheme, type Theme } from "../theme";
import { Button } from "./ui";

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
// Rien n'est choisi d'avance : c'est l'utilisateur qui répond à chaque question.
const DEFAULT: PlanRequest = { store: "" as StoreId, stores: [], specialsOnly: false, meals: [], weeks: 0, people: 0, cuisines: [], styles: [], diets: [], budget: 0, onlyStore: false };
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const TONES = ["#2B44FF", "#FF5FA2", "#FFE14D"];
const MEAL_INFO: Record<MealId, { icon: Icon; hint: string }> = {
  dejeuner: { icon: Sunrise, hint: "Le matin" }, diner: { icon: Sun, hint: "Le midi" }, souper: { icon: Moon, hint: "Le soir" },
};
const STYLE_INFO: Record<StyleId, { icon: Icon; hint: string }> = {
  normal: { icon: CookingPot, hint: "Équilibré, de tous les jours" },
  proteine: { icon: Dumbbell, hint: "30 g de protéines et plus" },
  leger: { icon: Leaf, hint: "Moins de 500 calories" },
  gourmand: { icon: Flame, hint: "Réconfortant, pour se gâter" },
};
const DIET_INFO: Record<DietId, Icon> = { vegetarien: Leaf, sans_gluten: Wheat, sans_noix: Nut, sans_lactose: MilkOff, diabetique: CandyOff };
const DIET_HINT: Partial<Record<DietId, string>> = { diabetique: "Peu de sucre, glucides modérés" };
const dishes = (id: string) => {
  const ul = CUISINE_PAGES.find((x) => x.id === id)?.blocks.find((b) => "ul" in b) as { ul: string[] } | undefined;
  return (ul?.ul ?? []).slice(0, 2).map((d) => d.split(/ ?[:(,]/)[0].trim()).join(", ");
};

const STEPS = ["store", "meals", "weeks", "people", "cuisines", "styles", "diets", "budget", "recap"] as const;
type Step = (typeof STEPS)[number];
const LABEL: Record<Step, string> = { store: "Épicerie", meals: "Repas", weeks: "Durée", people: "Personnes", cuisines: "Cuisines", styles: "Genre", diets: "Restrictions", budget: "Budget", recap: "Récapitulatif" };

export function Wizard() {
  const t = useTheme();
  // Téléphone : tuiles de cuisine plus serrées pour que les noms longs (« Vénézuélienne ») tiennent
  const narrow = useWindowDimensions().width < 560;
  const [form, setForm] = useState<PlanRequest>(DEFAULT);
  const [i, setI] = useState(0);
  const [budgetText, setBudgetText] = useState("");
  const [dietsChosen, setDietsChosen] = useState(false); // « Aucune » ou une restriction a été choisie
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; minBudget?: number } | null>(null);
  const top = useRef<any>(null);
  const step = STEPS[i];

  const set = <K extends keyof PlanRequest>(k: K, v: PlanRequest[K]) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };
  const valid: Record<Step, boolean> = {
    store: (form.stores ?? []).length > 0, meals: form.meals.length > 0, weeks: form.weeks > 0, people: form.people > 0, cuisines: form.cuisines.length > 0,
    styles: form.styles.length > 0, diets: dietsChosen, budget: form.budget > 0, recap: true,
  };
  const go = (n: number) => setI(Math.max(0, Math.min(STEPS.length - 1, n)));
  // Nouvelle question : ramener le haut de la carte sous l'en-tête (après l'affichage, une fois la hauteur de la page ajustée).
  // Sans ça, sur téléphone, passer d'une longue question (cuisines) à une courte laisse l'écran plus bas, sur la section suivante.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (Platform.OS !== "web") return;
    const el = top.current as HTMLElement | null;
    if (!el?.getBoundingClientRect) return;
    el.style.scrollMarginTop = "104px"; // hauteur de l'en-tête fixe + marge
    if (el.getBoundingClientRect().top < 96) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [i, busy]);
  const next = () => valid[step] && go(i + 1);
  const pick = <K extends keyof PlanRequest>(k: K, v: PlanRequest[K]) => { set(k, v); setTimeout(() => go(i + 1), 260); };

  // Entrée = continuer
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || busy) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "BUTTON" || tag === "A") return;
      if (step === "recap") submit(); else next();
    };
    // Phase de capture : le champ du budget intercepte sinon la touche Entrée pour lui-même.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  async function submit(budgetOverride?: number) {
    const req = budgetOverride ? { ...form, budget: budgetOverride } : form;
    if (budgetOverride) { setForm(req); setBudgetText(String(budgetOverride)); }
    setBusy(true);
    setError(null);
    saveForm(req);
    // L'écran de calcul reste au moins 2,6 s : le temps de lire les étapes.
    const [res] = await Promise.all([requestPlan(req), new Promise((ok) => setTimeout(ok, 2600))]);
    if (res.ok) {
      await savePlan(res);
      router.push("/menu");
      return;
    }
    setBusy(false);
    setError({ message: res.message, minBudget: res.minBudget });
  }

  const stores = form.stores ?? [];
  const storeLabel = stores.map((id) => STORES.find((s) => s.id === id)?.label).filter(Boolean).join(", ");
  // Plusieurs épiceries : la première reste « store » (affichage, compatibilité)
  const setStores = (list: StoreId[]) => setForm((f) => ({ ...f, stores: list, store: list[0] ?? ("" as StoreId) }));
  const mealsCount = form.meals.length * 7 * form.weeks;

  return (
    <View ref={top} style={{ backgroundColor: t.surface, borderRadius: radius.xl, borderWidth: 2, borderColor: t.edge, boxShadow: `10px 10px 0 ${t.edge}`, overflow: "hidden", maxWidth: 980, width: "100%", alignSelf: "center" } as ViewStyle}>
      {/* Progression */}
      <View style={{ paddingHorizontal: space(8), paddingTop: space(6), paddingBottom: space(5), borderBottomWidth: 2, borderBottomColor: t.edge, backgroundColor: t.surfaceAlt, gap: space(3) }} {...r("card-pad")}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.ink }}>{busy ? "Calcul en cours" : step === "recap" ? "Dernière étape" : `Question ${i + 1} sur ${STEPS.length - 1}`}</Text>
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: t.muted }}>{LABEL[step]}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {STEPS.map((s, k) => (
            <Pressable key={s} onPress={() => k < i && !busy && go(k)} disabled={k >= i || busy} accessibilityLabel={`Revenir à : ${LABEL[s]}`}
              style={{ flex: 1, height: 10, borderRadius: 5, borderWidth: 2, borderColor: t.edge, backgroundColor: k < i || busy ? t.primary : k === i ? t.tag : t.surface, overflow: "hidden" }} />
          ))}
        </View>
      </View>

      <View {...r("card-pad")} style={{ padding: space(10), minHeight: 460 }}>
        {busy ? <Computing store={storeLabel} t={t} /> : (
          <View key={step} {...r("step-in")}>
            {step === "store" && (
              <Q title="Où fais-tu ton épicerie ?" hint="Choisis-en une ou plusieurs : chaque article sera acheté là où il coûte le moins cette semaine." t={t}>
                <Grid>
                  {STORES.map((s, k) => (
                    <Tile key={s.id} selected={stores.includes(s.id)} onPress={() => { setStores(toggle(stores, s.id as StoreId)); setError(null); }} t={t} delay={k} height={124} color={t.tag}>
                      <StoreLogo id={s.id as StoreId} label={s.label} maxW={130} maxH={52} />
                    </Tile>
                  ))}
                </Grid>
                <Pressable onPress={() => set("specialsOnly", !form.specialsOnly)} accessibilityRole="switch" accessibilityState={{ checked: !!form.specialsOnly }}
                  style={{ marginTop: space(6), flexDirection: "row", alignItems: "center", gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: form.specialsOnly ? t.tagSoft : t.surfaceAlt }}>
                  <BadgePercent size={22} color={t.ink} strokeWidth={2.25} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: t.ink }}>Bâtir mon menu avec les spéciaux de la semaine</Text>
                    <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: t.muted }}>Gusto choisit les recettes dont les ingrédients sont en rabais cette semaine.</Text>
                  </View>
                  <Switch value={!!form.specialsOnly} onValueChange={(v) => set("specialsOnly", v)} trackColor={{ true: t.primary, false: t.line }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as any)} accessibilityLabel="Bâtir mon menu avec les spéciaux de la semaine" />
                </Pressable>
              </Q>
            )}

            {step === "meals" && (
              <Q title="Quels repas veux-tu planifier ?" hint="Choisis-en un ou plusieurs." t={t}>
                <Grid>
                  {MEALS.map((m, k) => {
                    const info = MEAL_INFO[m.id];
                    return (
                      <Tile key={m.id} selected={form.meals.includes(m.id)} onPress={() => set("meals", toggle(form.meals, m.id as MealId))} t={t} delay={k} height={150}>
                        <TileBody icon={info.icon} title={m.label} hint={info.hint} tone={k} on={form.meals.includes(m.id)} t={t} />
                      </Tile>
                    );
                  })}
                </Grid>
              </Q>
            )}

            {step === "weeks" && (
              <Q title="Pour combien de temps ?" hint="Un menu par semaine, avec une liste d’épicerie pour chacune." t={t}>
                <Grid cols={4}>
                  {[1, 2, 3, 4].map((w, k) => (
                    <Tile key={w} selected={form.weeks === w} onPress={() => pick("weeks", w)} t={t} radio delay={k} height={150}>
                      <Text style={{ fontFamily: font.display, fontSize: 56, lineHeight: 60, color: form.weeks === w ? "#FFFFFF" : t.ink }}>{w}</Text>
                      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: form.weeks === w ? "#FFFFFF" : t.muted }}>semaine{w > 1 ? "s" : ""}</Text>
                    </Tile>
                  ))}
                </Grid>
              </Q>
            )}

            {step === "people" && (
              <Q title="Vous êtes combien à table ?" hint="Les quantités et le nombre d’emballages suivent." t={t}>
                <View style={{ alignItems: "center", gap: space(8), paddingVertical: space(4) }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space(8) }}>
                    <Round icon={Minus} a11y="Une personne de moins" disabled={form.people <= 1} onPress={() => set("people", form.people - 1)} t={t} />
                    <Text key={form.people} {...r("pop-in")} accessibilityLiveRegion="polite" style={{ fontFamily: font.display, fontSize: 120, lineHeight: 124, color: form.people ? t.primary : t.line, minWidth: 150, textAlign: "center", fontVariant: ["tabular-nums"] }}>{form.people || "?"}</Text>
                    <Round icon={Plus} a11y="Une personne de plus" disabled={form.people >= LIMITS.maxPeople} onPress={() => set("people", form.people + 1)} t={t} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space(2), maxWidth: 520 }} aria-hidden>
                    {Array.from({ length: form.people }).map((_, k) => (
                      <View key={k} {...r("pop-in")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: TONES[k % 3], borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
                        <User size={20} color={k % 3 === 0 ? "#FFFFFF" : "#0E1030"} strokeWidth={2.5} />
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", gap: space(2) }}>
                    {[1, 2, 4, 6].map((n) => (
                      <Pressable key={n} onPress={() => set("people", n)} style={{ paddingHorizontal: space(4), height: 36, justifyContent: "center", borderRadius: 999, borderWidth: 2, borderColor: t.edge, backgroundColor: form.people === n ? t.tag : t.surface }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.ink }}>{n === 1 ? "Solo" : n === 2 ? "Couple" : `${n} pers.`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Q>
            )}

            {step === "cuisines" && (
              <Q title="Qu’est-ce qui te fait envie ?" hint="Plus tu en choisis, plus ton menu sera varié." t={t}
                extra={<Button size="sm" variant={form.cuisines.length === CUISINES.length ? "secondary" : "accent"} icon={Sparkles}
                  label={form.cuisines.length === CUISINES.length ? "Tout retirer" : "Surprends-moi"}
                  onPress={() => set("cuisines", form.cuisines.length === CUISINES.length ? [] : CUISINES.map((c) => c.id as CuisineId))} />}>
                <Grid cols={4}>
                  {CUISINES.map((c, k) => {
                    const on = form.cuisines.includes(c.id);
                    return (
                      <Tile key={c.id} selected={on} onPress={() => set("cuisines", toggle(form.cuisines, c.id as CuisineId))} t={t} delay={k % 6} height={112} align="flex-start" color={TONES[k % 3]} pad={narrow ? space(3) : undefined}>
                        <Text style={{ fontFamily: font.display, fontSize: narrow ? 15 : 18, maxWidth: "100%", color: on ? (k % 3 === 0 ? "#FFFFFF" : "#0E1030") : t.ink }}>{c.label}</Text>
                        <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 17, color: on ? (k % 3 === 0 ? "#DDE2FF" : "#3B3F66") : t.muted, marginTop: 4 }}>{dishes(c.id)}</Text>
                      </Tile>
                    );
                  })}
                </Grid>
              </Q>
            )}

            {step === "styles" && (
              <Q title="Quel genre de repas ?" hint="Tu peux en combiner plusieurs." t={t}>
                <Grid cols={4}>
                  {STYLES.map((s, k) => {
                    const info = STYLE_INFO[s.id];
                    return (
                      <Tile key={s.id} selected={form.styles.includes(s.id)} onPress={() => set("styles", toggle(form.styles, s.id as StyleId))} t={t} delay={k} height={170}>
                        <TileBody icon={info.icon} title={s.label} hint={info.hint} tone={k} on={form.styles.includes(s.id)} t={t} />
                      </Tile>
                    );
                  })}
                </Grid>
              </Q>
            )}

            {step === "diets" && (
              <Q title="Des restrictions alimentaires ?" hint="Facultatif. En cas d’allergie, vérifie toujours les étiquettes. « Diabétique » est un repère général : il ne remplace pas l’avis d’un professionnel de la santé." t={t}>
                <Grid cols={4}>
                  <Tile selected={dietsChosen && form.diets.length === 0} onPress={() => { setDietsChosen(true); pick("diets", []); }} t={t} height={150}>
                    <TileBody icon={Ban} title="Aucune" hint="Tout me va" tone={2} on={dietsChosen && form.diets.length === 0} t={t} />
                  </Tile>
                  {DIETS.map((d, k) => (
                    <Tile key={d.id} selected={form.diets.includes(d.id)} onPress={() => { const next = toggle(form.diets, d.id as DietId); setDietsChosen(next.length > 0); set("diets", next); }} t={t} delay={k + 1} height={150}>
                      <TileBody icon={DIET_INFO[d.id]} title={d.label} hint={DIET_HINT[d.id]} tone={k} on={form.diets.includes(d.id)} t={t} />
                    </Tile>
                  ))}
                </Grid>
              </Q>
            )}

            {step === "budget" && (
              <BudgetStep form={form} set={set} budgetText={budgetText} setBudgetText={setBudgetText} mealsCount={mealsCount} t={t} />
            )}

            {step === "recap" && (
              <Q title="Ton menu est prêt à être calculé." hint="Vérifie tes choix ; touche une ligne pour la modifier." t={t}>
                <View style={{ borderWidth: 2, borderColor: t.edge, borderRadius: radius.lg, overflow: "hidden" }}>
                  {([
                    ["store", stores.length > 1 ? "Épiceries" : "Épicerie", `${storeLabel}${form.specialsOnly ? " · spéciaux de la semaine" : ""}`],
                    ["meals", "Repas", form.meals.map((m) => MEALS.find((x) => x.id === m)?.label).join(", ")],
                    ["weeks", "Durée", `${form.weeks} semaine${form.weeks > 1 ? "s" : ""} · ${mealsCount} repas`],
                    ["people", "Personnes", String(form.people)],
                    ["cuisines", "Cuisines", form.cuisines.map((c) => CUISINES.find((x) => x.id === c)?.label).join(", ")],
                    ["styles", "Genre", form.styles.map((s) => STYLES.find((x) => x.id === s)?.label).join(", ")],
                    ["diets", "Restrictions", form.diets.length ? form.diets.map((d) => DIETS.find((x) => x.id === d)?.label).join(", ") : "Aucune"],
                    ["budget", "Budget", `${money(form.budget)}${form.onlyStore ? " · sans épicerie spécialisée" : ""}`],
                  ] as [Step, string, string][]).map(([s, k, v], n) => (
                    <Pressable key={s} onPress={() => go(STEPS.indexOf(s))} {...r("dim")}
                      style={{ flexDirection: "row", alignItems: "center", gap: space(4), paddingVertical: space(3.5), paddingHorizontal: space(5), borderTopWidth: n ? 1.5 : 0, borderTopColor: t.line, backgroundColor: n % 2 ? t.surfaceAlt : t.surface }}>
                      <Text style={{ width: 120, fontFamily: font.semibold, fontSize: 14, color: t.muted }}>{k}</Text>
                      <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15.5, color: t.ink }}>{v}</Text>
                      <Pencil size={16} color={t.muted} strokeWidth={2} />
                    </Pressable>
                  ))}
                </View>
                {error ? (
                  <View accessibilityRole="alert" style={{ marginTop: space(6), padding: space(5), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: t.pinkSoft, gap: space(3) }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 22, color: t.ink }}>{error.message}</Text>
                    {error.minBudget ? <Button label={`Essayer avec ${money(error.minBudget)}`} size="sm" variant="accent" onPress={() => submit(error.minBudget)} /> : null}
                  </View>
                ) : null}
              </Q>
            )}
          </View>
        )}
      </View>

      {/* Navigation */}
      {busy ? null : (
        <View {...r("card-pad")} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space(10), paddingVertical: space(6), borderTopWidth: 2, borderTopColor: t.edge, gap: space(4) }}>
          {i > 0
            ? <Pressable onPress={() => go(i - 1)} {...r("dim")} style={{ flexDirection: "row", alignItems: "center", gap: space(2), height: 48 }} accessibilityRole="button">
                <ArrowLeft size={18} color={t.ink} strokeWidth={2.5} />
                <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: t.ink }}>Retour</Text>
              </Pressable>
            : <View style={{ flex: 1 }}><Text {...r("hide-sm")} style={{ fontFamily: font.medium, fontSize: 13.5, color: t.muted }}>Appuie sur Entrée pour continuer</Text></View>}
          {step === "recap"
            ? <Button label="Créer mon menu" size="lg" variant="pink" icon={Sparkles} onPress={() => submit()} />
            : <Button label="Continuer" icon={ArrowRight} onPress={next} disabled={!valid[step]} />}
        </View>
      )}
    </View>
  );
}

// ─── Morceaux ───────────────────────────────────────────────────────────────

function Q({ title, hint, children, extra, t }: { title: string; hint?: string; children: ReactNode; extra?: ReactNode; t: Theme }) {
  return (
    <View>
      <View {...r("stack-sm")} style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space(4) }}>
        <View style={{ flex: 1 }}>
          <Text role="heading" aria-level={3} {...r("q-title")} style={{ fontFamily: font.display, fontSize: 40, lineHeight: 46, letterSpacing: -1.2, color: t.ink }}>{title}</Text>
          {hint ? <Text style={{ fontFamily: font.medium, fontSize: 16, lineHeight: 24, color: t.muted, marginTop: space(2) }}>{hint}</Text> : null}
        </View>
        {extra}
      </View>
      <View style={{ marginTop: space(8) }}>{children}</View>
    </View>
  );
}

function Grid({ children, cols = 3 }: { children: ReactNode; cols?: 3 | 4 }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(4) }} data-cols={cols}>{wrap(children, cols)}</View>;
}
const wrap = (children: ReactNode, cols: number) =>
  (Array.isArray(children) ? children.flat() : [children]).map((c: any, k) =>
    c ? <View key={c.key ?? k} {...r("tile-2")} style={{ flexBasis: cols === 4 ? "22%" : "30%", flexGrow: 1, minWidth: cols === 4 ? 150 : 170 }}>{c}</View> : null);

function Tile({ selected, onPress, children, t, radio, delay = 0, height = 120, align = "center", color, pad }: {
  selected: boolean; onPress: () => void; children: ReactNode; t: Theme; radio?: boolean; delay?: number; height?: number; align?: "center" | "flex-start"; color?: string; pad?: number;
}) {
  const bg = selected ? (color ?? t.primary) : t.surface;
  return (
    <Pressable onPress={onPress} accessibilityRole={radio ? "radio" : "checkbox"} accessibilityState={radio ? { selected } : { checked: selected }}
      {...r("press", "reveal-scale", `d${Math.min(6, delay + 1)}`)}
      style={{
        minHeight: height, borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: bg,
        boxShadow: selected ? `5px 5px 0 ${t.edge}` : `3px 3px 0 ${t.edge}`, padding: pad ?? space(5),
        alignItems: align, justifyContent: "center", transform: [{ translateY: selected ? -2 : 0 }],
      } as ViewStyle}>
      {children}
      {selected ? (
        <View {...r("pop-in")} style={{ position: "absolute", top: -11, right: -11, width: 26, height: 26, borderRadius: 13, backgroundColor: color === t.pink || color === "#FF5FA2" ? t.tag : t.pink, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
          <Check size={14} color="#0E1030" strokeWidth={3.5} />
        </View>
      ) : null}
    </Pressable>
  );
}

function TileBody({ icon: IconC, title, hint, tone, on, t }: { icon: Icon; title: string; hint?: string; tone: number; on: boolean; t: Theme }) {
  return (
    <View style={{ alignItems: "center", gap: space(2.5) }}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: TONES[tone % 3], borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
        <IconC size={24} color={tone % 3 === 0 ? "#FFFFFF" : "#0E1030"} strokeWidth={2.25} />
      </View>
      <Text style={{ fontFamily: font.display, fontSize: 18, color: on ? "#FFFFFF" : t.ink }}>{title}</Text>
      {hint ? <Text style={{ fontFamily: font.medium, fontSize: 13, textAlign: "center", color: on ? "#DDE2FF" : t.muted }}>{hint}</Text> : null}
    </View>
  );
}

function Round({ icon: IconC, a11y, disabled, onPress, t }: { icon: Icon; a11y: string; disabled: boolean; onPress: () => void; t: Theme }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={a11y} accessibilityRole="button" {...r("press")}
      style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1, backgroundColor: t.tag, borderWidth: 2, borderColor: t.edge, boxShadow: `3px 3px 0 ${t.edge}` } as ViewStyle}>
      <IconC size={26} color="#0E1030" strokeWidth={3} />
    </Pressable>
  );
}

function BudgetStep({ form, set, budgetText, setBudgetText, mealsCount, t }: {
  form: PlanRequest; set: <K extends keyof PlanRequest>(k: K, v: PlanRequest[K]) => void; budgetText: string; setBudgetText: (s: string) => void; mealsCount: number; t: Theme;
}) {
  // Suggestions selon la taille du menu (environ 3, 4 et 5,50 $ par portion)
  const portions = mealsCount * form.people;
  const round5 = (n: number) => Math.max(20, Math.round(n / 5) * 5);
  const presets = [["Serré", round5(portions * 3)], ["Confortable", round5(portions * 4)], ["Généreux", round5(portions * 5.5)]] as const;
  const perPortion = form.budget > 0 && portions > 0 ? (form.budget * BUDGET_SAFETY) / portions : 0;
  const setBudget = (v: number) => { setBudgetText(String(v)); set("budget", v); };
  return (
    <Q title="Quel est ton budget ?" hint={`Le total pour ${form.weeks} semaine${form.weeks > 1 ? "s" : ""}, garde-manger compris. Gusto ne le dépassera jamais.`} t={t}>
      <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(8), alignItems: "center" }}>
        <View style={{ flex: 1, gap: space(5) }}>
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderWidth: 2, borderColor: t.edge, borderRadius: radius.lg, paddingHorizontal: space(6), backgroundColor: t.tagSoft, boxShadow: `4px 4px 0 ${t.edge}` } as ViewStyle}>
            <TextInput
              value={budgetText}
              autoFocus={Platform.OS === "web"}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9,.]/g, "");
                setBudgetText(clean);
                set("budget", Number(clean.replace(",", ".")) || 0);
              }}
              inputMode="decimal"
              keyboardType="decimal-pad"
              placeholder="150"
              placeholderTextColor="#0E103033"
              accessibilityLabel="Budget total en dollars"
              style={{ fontFamily: font.display, fontSize: 64, color: t.ink, width: 210, paddingVertical: space(2), outlineStyle: "none" } as any}
            />
            <Text style={{ fontFamily: font.display, fontSize: 48, color: t.ink }}>$</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
            {presets.map(([label, v]) => (
              <Pressable key={label} onPress={() => setBudget(v)} {...r("press")}
                style={{ paddingHorizontal: space(4), height: 44, justifyContent: "center", borderRadius: 999, borderWidth: 2, borderColor: t.edge, backgroundColor: form.budget === v ? t.primary : t.surface, boxShadow: `3px 3px 0 ${t.edge}` } as ViewStyle}>
                <Text style={{ fontFamily: font.bold, fontSize: 14.5, color: form.budget === v ? "#FFFFFF" : t.ink }}>{label} · {v} $</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => set("onlyStore", !form.onlyStore)} style={{ flexDirection: "row", alignItems: "center", gap: space(3) }} accessibilityRole="switch" accessibilityState={{ checked: form.onlyStore }}>
            <Switch value={form.onlyStore} onValueChange={(v) => set("onlyStore", v)} trackColor={{ true: t.primary, false: t.line }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as any)} accessibilityLabel="Seulement des recettes réalisables à mon épicerie" />
            <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14.5, lineHeight: 21, color: t.ink }}>Seulement des recettes réalisables à mon épicerie (pas d’arrêt en épicerie spécialisée)</Text>
          </Pressable>
        </View>
        <View {...r("full-md")} style={{ width: 280, padding: space(6), borderRadius: radius.lg, backgroundColor: t.primary, borderWidth: 2, borderColor: t.edge, boxShadow: `5px 5px 0 ${t.edge}`, gap: space(2), transform: [{ rotate: "2deg" }] } as ViewStyle}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: "#C9D0FF" }}>Ce que ça donne</Text>
          <Text style={{ fontFamily: font.display, fontSize: 44, lineHeight: 48, color: "#FFFFFF" }}>{perPortion ? money(perPortion) : "—"}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: "#FFFFFF" }}>par portion, pour {portions} portions.</Text>
          <View style={{ height: 2, backgroundColor: "rgba(255,255,255,.25)", marginVertical: space(2) }} />
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: "#C9D0FF" }}>
            Gusto vise {form.budget > 0 ? money(form.budget * BUDGET_SAFETY) : "95 % du budget"}, pour garder une marge entre les succursales.
          </Text>
        </View>
      </View>
    </Q>
  );
}

/** Écran de calcul : les étapes s'affichent une à une. */
function Computing({ store, t }: { store: string; t: Theme }) {
  const lines = ["On choisit les recettes", `On compare les prix chez ${store}`, "On compte les emballages", "On vérifie ton budget"];
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => Math.min(lines.length, x + 1)), 600);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ alignItems: "center", justifyContent: "center", minHeight: 400, gap: space(8) }} accessibilityLiveRegion="polite">
      <View {...r("spin")} style={{ width: 96, height: 96, borderRadius: 30, backgroundColor: t.tag, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center", boxShadow: `5px 5px 0 ${t.edge}` } as ViewStyle}>
        <Sparkles size={42} color="#0E1030" strokeWidth={2.25} />
      </View>
      <View style={{ gap: space(3), minWidth: 300 }}>
        {lines.map((l, k) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: space(3), opacity: k <= n ? 1 : 0.25 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: t.edge, backgroundColor: k < n ? t.primary : t.surface, alignItems: "center", justifyContent: "center" }}>
              {k < n ? <View {...r("pop-in")}><Check size={15} color="#FFFFFF" strokeWidth={3.5} /></View> : k === n ? <View {...r("dot")} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary }} /> : null}
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 17, color: t.ink }}>{l}{k === n ? "…" : ""}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
