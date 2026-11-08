// Diète par macros : habitudes (alcool, shake, noix), calories par jour (ou calculateur) et répartition des macros.
// Les huiles de cuisson ne sont pas demandées : elles sont déjà comptées dans les recettes.
// Ces trois questions s'ajoutent au planificateur quand on choisit « Diète par macros ».
import { AlertTriangle, Beer, Calculator, Hash, Minus, Nut, Plus, Zap } from "lucide-react-native";
import { useEffect, type ComponentType, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type ViewStyle } from "react-native";
import { ALCOHOLS, EXTRAS, type AlcoholId, type ExtraId, type Habits, type MacroTarget } from "../../../../shared/options";
import { font, r, radius, space, type Theme } from "../theme";

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const nf = (n: number) => Math.round(n).toLocaleString("fr-CA");

// ─── Morceaux communs ───────────────────────────────────────────────────────

function Block({ icon: IconC, title, hint, children, t, tone = "#FFE14D" }: { icon: Icon; title: string; hint?: string; children: ReactNode; t: Theme; tone?: string }) {
  return (
    <View {...r("reveal")} style={{ gap: space(3), padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surfaceAlt }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tone, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
          <IconC size={20} color={tone === "#2B44FF" ? "#FFFFFF" : "#0E1030"} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.display, fontSize: 19, color: t.ink }}>{title}</Text>
          {hint ? <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: t.muted }}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Pill({ label, on, onPress, t }: { label: string; on: boolean; onPress: () => void; t: Theme }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} {...r("press")}
      style={{ paddingHorizontal: space(3.5), height: 40, justifyContent: "center", borderRadius: 999, borderWidth: 2, borderColor: t.edge, backgroundColor: on ? t.primary : t.surface, boxShadow: on ? `3px 3px 0 ${t.edge}` : "none" } as ViewStyle}>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: on ? "#FFFFFF" : t.ink }}>{label}</Text>
    </Pressable>
  );
}

/** − valeur + ; la valeur s'affiche avec son unité. */
export function Stepper({ value, onChange, step, min, max, unit, t, a11y }: { value: number; onChange: (n: number) => void; step: number; min: number; max: number; unit: string; t: Theme; a11y: string }) {
  const btn = (IconC: Icon, d: number, label: string) => (
    <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} disabled={d < 0 ? value <= min : value >= max} accessibilityRole="button" accessibilityLabel={label} {...r("press")}
      style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tag, alignItems: "center", justifyContent: "center", opacity: (d < 0 ? value <= min : value >= max) ? 0.35 : 1 }}>
      <IconC size={15} color="#0E1030" strokeWidth={3} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }} accessibilityLabel={a11y}>
      {btn(Minus, -step, `${a11y} : moins`)}
      <Text style={{ minWidth: 92, textAlign: "center", fontFamily: font.bold, fontSize: 15, color: t.ink, fontVariant: ["tabular-nums"] }}>{value} {unit}</Text>
      {btn(Plus, step, `${a11y} : plus`)}
    </View>
  );
}

function Row({ label, sub, children, t }: { label: string; sub?: string; children: ReactNode; t: Theme }) {
  return (
    <View {...r("stack-sm")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(3), paddingVertical: space(2.5), paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: t.muted }}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function NumberField({ value, onChange, placeholder, suffix, t, a11y, width = 110 }: { value: string; onChange: (s: string) => void; placeholder: string; suffix?: string; t: Theme; a11y: string; width?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), borderWidth: 2, borderColor: t.edge, borderRadius: radius.md, paddingHorizontal: space(3), backgroundColor: t.surface, height: 48 }}>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^0-9,.]/g, ""))} inputMode="decimal" keyboardType="decimal-pad" placeholder={placeholder}
        placeholderTextColor="#0E103055" accessibilityLabel={a11y} style={{ width, fontFamily: font.bold, fontSize: 18, color: t.ink, outlineStyle: "none" } as any} />
      {suffix ? <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.muted }}>{suffix}</Text> : null}
    </View>
  );
}
const num = (s: string) => Number(s.replace(",", ".")) || 0;

// ─── 1. Habitudes ───────────────────────────────────────────────────────────

export function HabitsStep({ habits, setHabits, t }: { habits: Habits; setHabits: (f: (h: Habits) => Habits) => void; t: Theme }) {
  const alcohol = habits.alcohol;
  const extras = habits.extras ?? [];
  // Mise à jour à partir de la version la plus récente : deux choix rapides ne s'écrasent pas
  const setAlcohol = (id: AlcoholId, perWeek: number | null) =>
    setHabits((h) => {
      const rest = h.alcohol.filter((a) => a.id !== id);
      return { ...h, alcohol: perWeek === null ? rest : [...rest, { id, perWeek }] };
    });
  const setExtra = (id: ExtraId, perDay: number | null) =>
    setHabits((h) => {
      const rest = (h.extras ?? []).filter((e) => e.id !== id);
      return { ...h, extras: perDay === null ? rest : [...rest, { id, perDay }] };
    });
  const spirits = alcohol.some((a) => !ALCOHOLS.find((x) => x.id === a.id)?.grocery);

  const extraGroup = (group: "shake" | "noix") => {
    const list = EXTRAS.filter((e) => e.group === group);
    return (
      <View style={{ gap: space(3) }}>
        {list.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
            {list.map((e) => {
              const on = extras.some((x) => x.id === e.id);
              return <Pill key={e.id} label={e.label} on={on} onPress={() => setExtra(e.id, on ? null : e.preset)} t={t} />;
            })}
          </View>
        ) : null}
        {list.map((e) => {
          const cur = extras.find((x) => x.id === e.id);
          if (list.length > 1 && !cur) return null;
          const unit = `${e.unit} / jour`;
          const sub = group === "shake" ? "Une mesure ≈ 30 g" : "Une poignée ≈ 30 g";
          return (
            <Row key={e.id} label={e.label} sub={sub} t={t}>
              {cur ? (
                <Stepper value={cur.perDay} onChange={(v) => setExtra(e.id, v)} step={5} min={5} max={150} unit={unit} t={t} a11y={`${e.label} par jour`} />
              ) : (
                <Pill label="J’en prends" on={false} onPress={() => setExtra(e.id, e.preset)} t={t} />
              )}
            </Row>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ gap: space(5) }}>
      <Block icon={Beer} title="Alcool" hint="Choisis ce que tu bois habituellement et combien par semaine. Les calories sont comptées dans ta journée." t={t}>
        {([["En épicerie", (a: (typeof ALCOHOLS)[number]) => a.grocery], ["Cocktails", (a: (typeof ALCOHOLS)[number]) => "mixer" in a], ["Spiritueux secs (SAQ)", (a: (typeof ALCOHOLS)[number]) => !a.grocery && !("mixer" in a)]] as const).map(([group, keep]) => (
          <View key={group} style={{ gap: space(1.5) }}>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.muted }}>{group}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
              {ALCOHOLS.filter(keep).map((a) => {
                const on = alcohol.some((x) => x.id === a.id);
                return <Pill key={a.id} label={a.label} on={on} onPress={() => setAlcohol(a.id, on ? null : a.grocery ? 6 : 3)} t={t} />;
              })}
            </View>
          </View>
        ))}
        {ALCOHOLS.filter((a) => alcohol.some((x) => x.id === a.id)).map((a) => {
          const cur = alcohol.find((x) => x.id === a.id)!;
          return (
            <Row key={a.id} label={a.label} sub={`${a.serving} ≈ ${a.kcal} cal${a.grocery ? "" : "mixer" in a ? " · alcool à la SAQ" : " · SAQ seulement"}`} t={t}>
              <Stepper value={cur.perWeek} onChange={(v) => setAlcohol(a.id, v)} step={1} min={1} max={70} unit="/ semaine" t={t} a11y={`${a.label} par semaine`} />
            </Row>
          );
        })}
        {spirits ? (
          <View accessibilityRole="alert" style={{ flexDirection: "row", gap: space(3), padding: space(4), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: t.pinkSoft }}>
            <AlertTriangle size={18} color={t.ink} strokeWidth={2.25} />
            <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: t.ink }}>
              Les spiritueux (whisky, rhum, vodka, gin, tequila, liqueurs) ne se vendent pas dans les épiceries de Gusto : il faut les acheter à la SAQ.
              Leurs calories sont comptées dans ton menu ; pour les cocktails, la boisson de mélange (cola, jus, tonic…) est dans ta liste et ton budget, mais pas l’alcool.
            </Text>
          </View>
        ) : null}
      </Block>

      <Block icon={Zap} title="Shake protéiné" hint="Combien de grammes de poudre par jour ? Le prix de la poudre n’est pas suivi par les épiceries : prévois-le en plus." t={t} tone="#FF5FA2">
        {extraGroup("shake")}
      </Block>

      <Block icon={Nut} title="Noix et beurres de noix" hint="Amandes, noix de cajou, arachides… en collation ou dans tes plats." t={t} tone="#FFE14D">
        {extraGroup("noix")}
      </Block>

    </View>
  );
}

// ─── 2. Calories par jour ───────────────────────────────────────────────────

export interface CalcProfile {
  mode: "connu" | "calcul" | null;
  sex: "h" | "f" | null;
  age: string;
  weight: string;
  weightUnit: "kg" | "lb";
  height: string; // cm
  feet: string;
  inches: string;
  heightUnit: "cm" | "pi";
  activity: number | null; // multiplicateur
  goal: "perdre" | "maintenir" | "prendre" | null;
  delta: 300 | 400 | 500;
  known: string; // calories saisies directement
}
export const EMPTY_PROFILE: CalcProfile = { mode: null, sex: null, age: "", weight: "", weightUnit: "kg", height: "", feet: "", inches: "", heightUnit: "cm", activity: null, goal: null, delta: 400, known: "" };

const ACTIVITY = [
  { k: 1.2, label: "Sédentaire", hint: "Peu ou pas d’exercice" },
  { k: 1.375, label: "Légèrement actif", hint: "1 à 3 entraînements par semaine" },
  { k: 1.55, label: "Actif", hint: "3 à 5 entraînements par semaine" },
  { k: 1.725, label: "Très actif", hint: "6 ou 7 entraînements par semaine" },
  { k: 1.9, label: "Extrêmement actif", hint: "Travail physique et sport chaque jour" },
];

/** Besoin calorique (Mifflin-St Jeor × activité), puis objectif ±300 à 500 cal. null tant qu'il manque une réponse. */
export function computeCalories(p: CalcProfile): { maintenance: number; goal: number; floored: boolean } | null {
  const age = num(p.age);
  const kg = p.weightUnit === "kg" ? num(p.weight) : num(p.weight) / 2.2046;
  const cm = p.heightUnit === "cm" ? num(p.height) : (num(p.feet) * 12 + num(p.inches)) * 2.54;
  if (!p.sex || !p.activity || !p.goal || !(age >= 14 && age <= 100) || !(kg >= 30 && kg <= 300) || !(cm >= 120 && cm <= 230)) return null;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (p.sex === "h" ? 5 : -161);
  const maintenance = Math.round((bmr * p.activity) / 10) * 10;
  let goal = maintenance + (p.goal === "perdre" ? -p.delta : p.goal === "prendre" ? p.delta : 0);
  // Jamais sous un plancher prudent quand on veut perdre du poids
  const floor = p.sex === "h" ? 1500 : 1200;
  const floored = p.goal === "perdre" && goal < floor;
  if (floored) goal = floor;
  return { maintenance, goal, floored };
}

export function CaloriesStep({ profile, setProfile, kcal, setKcal, t }: { profile: CalcProfile; setProfile: (f: (p: CalcProfile) => CalcProfile) => void; kcal: number; setKcal: (n: number) => void; t: Theme }) {
  // Mise à jour à partir de la version la plus récente ; les calories suivent les réponses
  const set = <K extends keyof CalcProfile>(k: K, v: CalcProfile[K]) => setProfile((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (profile.mode === "calcul") setKcal(computeCalories(profile)?.goal ?? 0);
    else if (profile.mode === "connu") setKcal(num(profile.known));
  }, [profile]);
  const res = computeCalories(profile);
  const big = (on: boolean) => ({ flex: 1, minWidth: 220, padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: on ? t.primary : t.surface, boxShadow: on ? `5px 5px 0 ${t.edge}` : `3px 3px 0 ${t.edge}`, gap: space(1) } as ViewStyle);
  const choice = (label: string, on: boolean, onPress: () => void) => <Pill key={label} label={label} on={on} onPress={onPress} t={t} />;

  return (
    <View style={{ gap: space(5) }}>
      <View {...r("stack-sm")} style={{ flexDirection: "row", gap: space(4), flexWrap: "wrap" }}>
        <Pressable onPress={() => set("mode", "connu")} {...r("press")} accessibilityRole="radio" accessibilityState={{ selected: profile.mode === "connu" }} style={big(profile.mode === "connu")}>
          <Hash size={24} color={profile.mode === "connu" ? "#FFFFFF" : t.ink} strokeWidth={2.25} />
          <Text style={{ fontFamily: font.display, fontSize: 19, color: profile.mode === "connu" ? "#FFFFFF" : t.ink }}>Je connais mon nombre</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: profile.mode === "connu" ? "#DDE2FF" : t.muted }}>J’inscris mes calories par jour.</Text>
        </Pressable>
        <Pressable onPress={() => set("mode", "calcul")} {...r("press")} accessibilityRole="radio" accessibilityState={{ selected: profile.mode === "calcul" }} style={big(profile.mode === "calcul")}>
          <Calculator size={24} color={profile.mode === "calcul" ? "#FFFFFF" : t.ink} strokeWidth={2.25} />
          <Text style={{ fontFamily: font.display, fontSize: 19, color: profile.mode === "calcul" ? "#FFFFFF" : t.ink }}>Je ne sais pas</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: profile.mode === "calcul" ? "#DDE2FF" : t.muted }}>Quelques questions pour calculer mon besoin.</Text>
        </Pressable>
      </View>

      {profile.mode === "connu" ? (
        <View {...r("step-in")} style={{ flexDirection: "row", alignItems: "center", gap: space(3), flexWrap: "wrap" }}>
          <NumberField value={profile.known} onChange={(v) => set("known", v)} placeholder="2000" suffix="calories par jour" t={t} a11y="Calories par jour" width={110} />
          {kcal && (kcal < 1000 || kcal > 6000) ? <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.sale }}>Entre 1 000 et 6 000 calories.</Text> : null}
        </View>
      ) : null}

      {profile.mode === "calcul" ? (
        <View {...r("step-in")} style={{ gap: space(4) }}>
          <Row label="Sexe" sub="Pour le calcul du métabolisme" t={t}>
            <View style={{ flexDirection: "row", gap: space(2) }}>
              {choice("Homme", profile.sex === "h", () => set("sex", "h"))}
              {choice("Femme", profile.sex === "f", () => set("sex", "f"))}
            </View>
          </Row>
          <Row label="Âge" t={t}><NumberField value={profile.age} onChange={(v) => set("age", v)} placeholder="35" suffix="ans" t={t} a11y="Âge" width={60} /></Row>
          <Row label="Poids" t={t}>
            <View style={{ flexDirection: "row", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
              <NumberField value={profile.weight} onChange={(v) => set("weight", v)} placeholder={profile.weightUnit === "kg" ? "70" : "155"} suffix={profile.weightUnit} t={t} a11y="Poids" width={60} />
              {choice("kg", profile.weightUnit === "kg", () => set("weightUnit", "kg"))}
              {choice("lb", profile.weightUnit === "lb", () => set("weightUnit", "lb"))}
            </View>
          </Row>
          <Row label="Taille" t={t}>
            <View style={{ flexDirection: "row", gap: space(2), alignItems: "center", flexWrap: "wrap" }}>
              {profile.heightUnit === "cm"
                ? <NumberField value={profile.height} onChange={(v) => set("height", v)} placeholder="170" suffix="cm" t={t} a11y="Taille en centimètres" width={60} />
                : <>
                    <NumberField value={profile.feet} onChange={(v) => set("feet", v)} placeholder="5" suffix="pi" t={t} a11y="Taille en pieds" width={30} />
                    <NumberField value={profile.inches} onChange={(v) => set("inches", v)} placeholder="8" suffix="po" t={t} a11y="Pouces" width={30} />
                  </>}
              {choice("cm", profile.heightUnit === "cm", () => set("heightUnit", "cm"))}
              {choice("pi/po", profile.heightUnit === "pi", () => set("heightUnit", "pi"))}
            </View>
          </Row>
          <View style={{ gap: space(2) }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Ton niveau d’activité</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
              {ACTIVITY.map((a) => (
                <Pressable key={a.k} onPress={() => set("activity", a.k)} accessibilityRole="radio" accessibilityState={{ selected: profile.activity === a.k }} {...r("press")}
                  style={{ flexGrow: 1, flexBasis: 170, padding: space(3), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: profile.activity === a.k ? t.primary : t.surface } as ViewStyle}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14.5, color: profile.activity === a.k ? "#FFFFFF" : t.ink }}>{a.label}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: profile.activity === a.k ? "#DDE2FF" : t.muted }}>{a.hint}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: space(2) }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Ton objectif</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
              {choice("Perdre du poids", profile.goal === "perdre", () => set("goal", "perdre"))}
              {choice("Maintenir mon poids", profile.goal === "maintenir", () => set("goal", "maintenir"))}
              {choice("Prendre du poids", profile.goal === "prendre", () => set("goal", "prendre"))}
            </View>
            {profile.goal === "perdre" || profile.goal === "prendre" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), alignItems: "center" }}>
                <Text style={{ fontFamily: font.medium, fontSize: 14, color: t.muted }}>{profile.goal === "perdre" ? "Retirer" : "Ajouter"} par jour :</Text>
                {([300, 400, 500] as const).map((d) => choice(`${d} cal`, profile.delta === d, () => set("delta", d)))}
              </View>
            ) : null}
          </View>

          {res ? (
            <View {...r("pop-in")} style={{ padding: space(5), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.primary, boxShadow: `5px 5px 0 ${t.edge}`, gap: space(1) } as ViewStyle}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: "#C9D0FF" }}>Ton besoin pour maintenir ton poids : {nf(res.maintenance)} cal</Text>
              <Text style={{ fontFamily: font.display, fontSize: 40, lineHeight: 44, color: "#FFFFFF" }}>{nf(res.goal)} calories par jour</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: "#FFFFFF" }}>
                {profile.goal === "perdre" ? `Avec ${profile.delta} calories de moins par jour, on vise une perte graduelle.` : profile.goal === "prendre" ? `Avec ${profile.delta} calories de plus par jour, on vise une prise graduelle.` : "Pour garder ton poids actuel."}
                {res.floored ? ` Nous ne descendons pas sous ${nf(res.goal)} calories par jour, par prudence.` : ""}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: t.muted }}>Réponds à toutes les questions pour voir ton besoin calorique.</Text>
          )}
          <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 18, color: t.muted }}>
            Estimation selon la formule de Mifflin-St Jeor. Ce n’est pas un avis médical : en cas de condition de santé, de grossesse ou d’objectif important, parles-en à un professionnel.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── 3. Répartition des macros ──────────────────────────────────────────────

const PRESETS: { label: string; hint: string; p: number; c: number; f: number }[] = [
  { label: "Équilibré", hint: "30 / 40 / 30", p: 30, c: 40, f: 30 },
  { label: "Riche en protéines", hint: "40 / 35 / 25", p: 40, c: 35, f: 25 },
  { label: "Faible en glucides", hint: "35 / 20 / 45", p: 35, c: 20, f: 45 },
  { label: "Sportif", hint: "30 / 50 / 20", p: 30, c: 50, f: 20 },
];

export const macrosValid = (m: MacroTarget) =>
  m.kcal >= 1000 && m.kcal <= 6000 && m.protein + m.carbs + m.fat === 100 && [m.protein, m.carbs, m.fat].every((x) => x >= 5 && x <= 80);

export function MacrosStep({ macros, setMacros, t }: { macros: MacroTarget; setMacros: (m: MacroTarget) => void; t: Theme }) {
  const sum = macros.protein + macros.carbs + macros.fat;
  const grams = (pct: number, per: number) => Math.round((macros.kcal * pct) / 100 / per);
  const rows: { k: "protein" | "carbs" | "fat"; label: string; per: number; color: string }[] = [
    { k: "protein", label: "Protéines", per: 4, color: "#2B44FF" },
    { k: "carbs", label: "Glucides", per: 4, color: "#FFE14D" },
    { k: "fat", label: "Lipides", per: 9, color: "#FF5FA2" },
  ];
  return (
    <View style={{ gap: space(5) }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
        {PRESETS.map((p) => {
          const on = macros.protein === p.p && macros.carbs === p.c && macros.fat === p.f;
          return (
            <Pressable key={p.label} onPress={() => setMacros({ ...macros, protein: p.p, carbs: p.c, fat: p.f })} accessibilityRole="radio" accessibilityState={{ selected: on }} {...r("press")}
              style={{ flexGrow: 1, flexBasis: 150, padding: space(3.5), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: on ? t.primary : t.surface, boxShadow: on ? `4px 4px 0 ${t.edge}` : `2px 2px 0 ${t.edge}` } as ViewStyle}>
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: on ? "#FFFFFF" : t.ink }}>{p.label}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: on ? "#DDE2FF" : t.muted }}>Prot. / Gluc. / Lip. : {p.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Barre de répartition */}
      <View style={{ flexDirection: "row", height: 22, borderRadius: 11, overflow: "hidden", borderWidth: 2, borderColor: t.edge }}>
        {rows.map((x) => <View key={x.k} style={{ flex: Math.max(0.0001, macros[x.k]), backgroundColor: x.color }} />)}
      </View>

      <View style={{ gap: space(2.5) }}>
        {rows.map((x) => (
          <Row key={x.k} label={`${x.label} · ${macros[x.k]} %`} sub={macros.kcal ? `${grams(macros[x.k], x.per)} g par jour` : undefined} t={t}>
            <Stepper value={macros[x.k]} onChange={(v) => setMacros({ ...macros, [x.k]: v })} step={5} min={5} max={80} unit="%" t={t} a11y={x.label} />
          </Row>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.bold, fontSize: 15, color: sum === 100 ? t.ink : t.sale }}>
        {sum === 100 ? `Total : 100 % de ${nf(macros.kcal)} calories par jour.` : `Total : ${sum} %. Ajuste pour arriver à 100 %.`}
      </Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 18, color: t.muted }}>
        Les valeurs nutritives des recettes sont des estimations. Les portions de ton menu sont ajustées pour se rapprocher de ta cible.
      </Text>
    </View>
  );
}
