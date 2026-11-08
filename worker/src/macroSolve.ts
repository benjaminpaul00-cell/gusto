// Diète par macros : chaque jour, ajuste les portions des repas et ajoute des compléments simples (poulet, thon, riz…)
// pour que les calories et les grammes de protéines, glucides et lipides se rapprochent le plus possible de la cible.

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }
export interface Complement { id: string; label: string; ingredient: string; kind: "protein" | "carbs"; per100: Macros }

// Valeurs pour 100 g (cru ou tel qu'acheté). Le moins cher, par gramme de protéines ou de glucides, est choisi.
export const COMPLEMENTS: Complement[] = [
  { id: "poulet", label: "Poitrine de poulet", ingredient: "poitrine de poulet", kind: "protein", per100: { kcal: 120, protein: 23, carbs: 0, fat: 2.6 } },
  { id: "thon", label: "Thon en conserve", ingredient: "thon", kind: "protein", per100: { kcal: 116, protein: 26, carbs: 0, fat: 1 } },
  { id: "yogourt", label: "Yogourt grec", ingredient: "yogourt grec", kind: "protein", per100: { kcal: 75, protein: 10, carbs: 4, fat: 2 } },
  { id: "riz", label: "Riz blanc", ingredient: "riz blanc", kind: "carbs", per100: { kcal: 360, protein: 7, carbs: 79, fat: 0.6 } },
  { id: "avoine", label: "Flocons d’avoine", ingredient: "flocons d'avoine", kind: "carbs", per100: { kcal: 379, protein: 13, carbs: 68, fat: 6.5 } },
  { id: "patate", label: "Pommes de terre", ingredient: "pommes de terre", kind: "carbs", per100: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 } },
];

const KEYS = ["kcal", "protein", "carbs", "fat"] as const;
const WEIGHT = { kcal: 3, protein: 3, carbs: 1, fat: 1.5 }; // les calories et les protéines comptent le plus

/**
 * Trouve les portions (x, de 0,6 à 2,2 fois la portion de la recette) et les grammes de compléments (0 à 250 g)
 * qui rapprochent le plus le total du jour de la cible. Moindres carrés relatifs, par descente de gradient projetée.
 * meals : valeurs nutritives d'une portion de chaque repas ; fixed : alcool, shake et noix du jour.
 */
export function solveDay(meals: Macros[], x0: number[], comps: Complement[], fixed: Macros, target: Macros): { x: number[]; grams: number[] } {
  const nX = meals.length, nY = comps.length;
  // Variables : portions, puis compléments en centaines de grammes (même ordre de grandeur que les portions)
  const v = [...x0, ...comps.map(() => 0)];
  const lo = [...meals.map(() => 0.6), ...comps.map(() => 0)];
  const hi = [...meals.map(() => 2.2), ...comps.map(() => 2.5)];
  const col = (j: number): Macros => (j < nX ? meals[j] : comps[j - nX].per100);
  // Pas sûr : 1 / (constante de Lipschitz du gradient)
  let L = 0;
  for (const k of KEYS) { let s = 0; for (let j = 0; j < nX + nY; j++) s += (col(j)[k] / target[k]) ** 2; L += 2 * WEIGHT[k] * s; }
  const step = 1 / Math.max(L, 1e-9);
  for (let it = 0; it < 4000; it++) {
    const tot = { ...fixed };
    for (let j = 0; j < nX + nY; j++) for (const k of KEYS) tot[k] += v[j] * col(j)[k];
    let moved = 0;
    for (let j = 0; j < nX + nY; j++) {
      let g = 0;
      for (const k of KEYS) g += 2 * WEIGHT[k] * ((tot[k] - target[k]) / target[k]) * (col(j)[k] / target[k]);
      if (j >= nX) g += 0.002; // léger penchant pour les vrais repas plutôt que les compléments
      const nv = Math.min(hi[j], Math.max(lo[j], v[j] - step * g));
      moved += Math.abs(nv - v[j]);
      v[j] = nv;
    }
    if (moved < 1e-7) break;
  }
  return { x: v.slice(0, nX).map((x) => Math.round(x * 20) / 20), grams: v.slice(nX).map((y) => Math.round((y * 100) / 10) * 10) };
}

/** Totaux d'une journée : repas à leurs portions, compléments et extras. */
export function dayTotals(meals: Macros[], x: number[], comps: Complement[], grams: number[], fixed: Macros): Macros {
  const t = { ...fixed };
  meals.forEach((m, i) => { for (const k of KEYS) t[k] += m[k] * x[i]; });
  comps.forEach((c, j) => { for (const k of KEYS) t[k] += (c.per100[k] * grams[j]) / 100; });
  return t;
}
