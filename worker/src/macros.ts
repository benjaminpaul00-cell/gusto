// Diète par macros : cible de calories et de macronutriments, portions ajustées, alcool.
// Les calories de l'alcool sont retirées de la journée ; les repas planifiés se partagent le reste (MEAL_SHARE).

import { ALCOHOLS, EXTRAS, MEAL_SHARE, type AlcoholId, type ExtraId, type Habits, type MacroTarget, type MealId, type Nutrition } from "../../shared/options";

export interface MacroPlan {
  target: MacroTarget; // kcal par jour et % des calories
  grams: Nutrition["target"]; // la même cible en grammes par jour
  foodKcalDay: number; // calories par jour pour la nourriture (cible moins l'alcool)
  alcohol: Nutrition["alcohol"];
  alcoholKcalDay: number;
  // Shake et noix : par jour, et ce qu'il faut acheter (ingredient null = prix non suivi)
  extras: { id: ExtraId; label: string; perDay: number; unit: string; ingredient: string | null; kcal: number; protein: number; carbs: number; fat: number }[];
  extrasDay: { kcal: number; protein: number; carbs: number; fat: number };
  mealRatio: { protein: number; carbs: number; fat: number }; // répartition (en %) visée par les repas, une fois les extras comptés
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Cible valide (1 000 à 6 000 kcal, répartition totale de 100 %), sinon null : le menu se calcule comme d'habitude. */
export function macroPlan(m?: MacroTarget, h?: Habits): MacroPlan | null {
  if (!m) return null;
  const kcal = Math.round(Number(m.kcal));
  const pct = [m.protein, m.carbs, m.fat].map((x) => Math.round(Number(x)));
  if (!(kcal >= 1000 && kcal <= 6000) || pct.some((x) => !(x >= 5 && x <= 80)) || Math.abs(pct[0] + pct[1] + pct[2] - 100) > 1) return null;
  const target = { kcal, protein: pct[0], carbs: pct[1], fat: pct[2] };
  const alcohol = (h?.alcohol ?? [])
    .map((a) => ({ a, def: ALCOHOLS.find((x) => x.id === a.id) }))
    .filter((x): x is { a: { id: AlcoholId; perWeek: number }; def: (typeof ALCOHOLS)[number] } => !!x.def && x.a.perWeek > 0)
    .map(({ a, def }) => {
      const perWeek = Math.min(70, Math.round(a.perWeek));
      // Coût à l'épicerie : l'alcool lui-même (bière, vin…) ou, pour un cocktail, la boisson de mélange
      const each = "price" in def ? def.price : "mixerPrice" in def ? def.mixerPrice : 0;
      return { id: def.id, label: def.label, serving: def.serving, perWeek, kcalPerWeek: perWeek * def.kcal, grocery: def.grocery, buy: buyText(def.id, perWeek),
        ...("mixer" in def ? { mixer: def.mixer } : {}), costPerWeek: Math.round(perWeek * each * 100) / 100 };
    });
  const alcoholKcalDay = Math.round(alcohol.reduce((n, a) => n + a.kcalPerWeek, 0) / 7);
  const extras = (h?.extras ?? [])
    .map((e) => ({ e, def: EXTRAS.find((x) => x.id === e.id) }))
    .filter((x): x is { e: { id: ExtraId; perDay: number }; def: (typeof EXTRAS)[number] } => !!x.def && x.e.perDay > 0)
    .map(({ e, def }) => {
      const perDay = Math.min(300, Math.round(e.perDay));
      const k = perDay / 100;
      return { id: def.id, label: def.label, perDay, unit: def.unit, ingredient: def.ingredient,
        kcal: Math.round(def.per100.kcal * k), protein: Math.round(def.per100.protein * k), carbs: Math.round(def.per100.carbs * k), fat: Math.round(def.per100.fat * k) };
    });
  const extrasDay = extras.reduce((n, x) => ({ kcal: n.kcal + x.kcal, protein: n.protein + x.protein, carbs: n.carbs + x.carbs, fat: n.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  // Les % s'appliquent aux calories des aliments : l'alcool n'apporte ni protéines, ni glucides, ni lipides comptés ici
  const foodTotal = Math.max(800, kcal - alcoholKcalDay);
  const grams = { kcal, protein: Math.round((foodTotal * target.protein) / 400), carbs: Math.round((foodTotal * target.carbs) / 400), fat: Math.round((foodTotal * target.fat) / 900) };
  // Ce qu'il reste aux repas : la cible moins les extras (ex. un shake couvre déjà une part des protéines)
  const left = { p: Math.max(0, grams.protein - extrasDay.protein) * 4, c: Math.max(0, grams.carbs - extrasDay.carbs) * 4, f: Math.max(0, grams.fat - extrasDay.fat) * 9 };
  const sum = left.p + left.c + left.f || 1;
  const mealRatio = { protein: (100 * left.p) / sum, carbs: (100 * left.c) / sum, fat: (100 * left.f) / sum };
  return {
    target,
    mealRatio,
    grams, // grammes visés, calculés sur les calories des aliments (sans l'alcool)
    foodKcalDay: Math.max(800, kcal - alcoholKcalDay - extrasDay.kcal), // jamais moins de 800 kcal de repas par jour
    alcohol,
    alcoholKcalDay,
    extras,
    extrasDay,
  };
}

/** Quantité à acheter pour la semaine, en emballages courants. */
export function buyText(id: AlcoholId, perWeek: number): string {
  const s = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
  const def = ALCOHOLS.find((a) => a.id === id);
  if (def && "mixer" in def) return `${perWeek} cocktail${perWeek > 1 ? "s" : ""} par semaine : l’alcool à la SAQ, le ${def.mixer} à l’épicerie`;
  if (id === "sangria") return `${s(Math.ceil((perWeek * 180) / 750), "bouteille")} de vin rouge de 750 ml et des fruits`;
  if (id === "vin") return `${s(Math.ceil((perWeek * 150) / 750), "bouteille")} de 750 ml (${perWeek} verre${perWeek > 1 ? "s" : ""})`;
  if (ALCOHOLS.find((a) => a.id === id)?.serving.includes("45 ml"))
    return `${perWeek * 45} ml par semaine (une bouteille de 750 ml ≈ 16 verres)`;
  return `${s(perWeek, "canette")} de 355 ml`;
}

/** Calories visées pour un repas, par personne. */
export const mealKcal = (mp: MacroPlan, meal: MealId) => mp.foodKcalDay * MEAL_SHARE[meal];

/** Portion ajustée pour atteindre les calories du repas : de la moitié au double de la portion de la recette. */
export function portionFor(mp: MacroPlan, meal: MealId, r: { kcal: number }): number {
  if (!(r.kcal > 0)) return 1;
  return clamp(Math.round((mealKcal(mp, meal) / r.kcal) * 20) / 20, 0.5, 2);
}

/** Écart (en points de %) entre la répartition des calories d'une recette et la cible. 0 = parfait. */
export function macroDistance(mp: MacroPlan, r: { kcal: number; protein: number; carbs: number; fat: number }): number {
  const total = 4 * r.protein + 4 * r.carbs + 9 * r.fat;
  if (!(total > 0)) return 300;
  const p = (400 * r.protein) / total, c = (400 * r.carbs) / total, f = (900 * r.fat) / total;
  // Les protéines comptent double : c'est la cible la plus importante d'une diète par macros
  return 2 * Math.abs(p - mp.mealRatio.protein) + Math.abs(c - mp.mealRatio.carbs) + Math.abs(f - mp.mealRatio.fat);
}
