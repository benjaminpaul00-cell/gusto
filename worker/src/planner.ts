// Planificateur de menus — code pur, sans IA ni réseau.
// Garantit que le total ne dépasse jamais la cible (budget × BUDGET_SAFETY).

import { ingredientKey, isFree, normalize } from "./epiceries";
import {
  BUDGET_SAFETY,
  type DietId,
  type HomemadeRecipe,
  type ListItem,
  type MealId,
  type PlanRequest,
  type PlanResponse,
  type RecipeIngredient,
  type RecipeView,
  type StyleId,
  type Unit,
  type WeekPlan,
} from "../../shared/options";

export interface PlannerRecipe {
  id: string;
  name: string;
  cuisine: string;
  meal: MealId;
  styles: StyleId[];
  diets: DietId[];
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  kcal: number;
  protein: number;
  image: string | null;
}

export interface IngredientInfo {
  name: string;
  section: string; // rayon
  pantry: boolean;
  unitWeightG: number | null; // poids moyen d'une unité (ex. 1 oignon ≈ 150 g)
  homemade: (HomemadeRecipe & { displayName?: string }) | null;
  specialty: { where: string; priceMax: number; sizeQty: number; sizeUnit: Unit } | null;
}

export interface StoreProduct {
  ingredient: string;
  productName: string;
  sizeQty: number;
  sizeUnit: Unit;
  price: number; // prix actuel (rabais inclus)
  regularPrice: number; // prix sans rabais (≥ price)
  discounted: boolean;
  estimated?: boolean; // produit non suivi dans cette bannière : prix le plus élevé relevé ailleurs
}

export interface PlannerData {
  recipes: PlannerRecipe[];
  ingredients: Map<string, IngredientInfo>;
  products: Map<string, StoreProduct[]>; // clé = ingrédient : formats offerts dans l'épicerie choisie (même unité)
}

type Source = "store" | "specialty";

interface Need {
  ingredient: string;
  qty: number; // dans l'unité de l'emballage
  source: Source;
  pantry: boolean;
}

interface Resolved {
  recipe: PlannerRecipe;
  needs: Need[];
  homemade: string[];
  specialty: string[];
}

export function convert(qty: number, from: Unit, to: Unit, unitWeightG: number | null): number | null {
  if (from === to) return qty;
  const massLike = (u: Unit) => u === "g" || u === "ml"; // densité ≈ 1
  if (massLike(from) && massLike(to)) return qty;
  if (!unitWeightG || unitWeightG <= 0) return null;
  if (from === "unite") return qty * unitWeightG;
  return qty / unitWeightG;
}

/** Vérifie qu'une recette est réalisable à l'épicerie choisie et calcule ses besoins pour `people` personnes. */
export function resolveRecipe(
  recipe: PlannerRecipe,
  people: number,
  data: PlannerData,
  onlyStore: boolean,
): Resolved | null {
  const scale = people / recipe.servings;
  const needs: Need[] = [];
  const homemade: string[] = [];
  const specialty: string[] = [];

  const addFromStore = (name: string, qty: number, unit: Unit): boolean => {
    const product = data.products.get(name)?.[0];
    const info = data.ingredients.get(name);
    if (!product) return false;
    const q = convert(qty, unit, product.sizeUnit, info?.unitWeightG ?? null);
    if (q === null) return false;
    needs.push({ ingredient: name, qty: q, source: "store", pantry: !!info?.pantry });
    return true;
  };

  for (const ing of recipe.ingredients) {
    if (isFree(ing.name)) continue; // eau du robinet : rien à acheter
    const need = ing.qty * scale;
    if (addFromStore(ing.name, need, ing.unit)) continue;

    const info = data.ingredients.get(ing.name);
    if (info?.homemade) {
      const h = info.homemade;
      const inYield = convert(need, ing.unit, h.yieldUnit, info.unitWeightG);
      if (inYield === null || h.yieldQty <= 0) return null;
      const factor = inYield / h.yieldQty;
      const ok = h.ingredients.every((sub) => addFromStore(sub.name, sub.qty * factor, sub.unit));
      if (!ok) return null;
      homemade.push(ing.name);
      continue;
    }

    if (info?.specialty && !onlyStore) {
      const s = info.specialty;
      const q = convert(need, ing.unit, s.sizeUnit, info.unitWeightG);
      if (q === null) return null;
      needs.push({ ingredient: ing.name, qty: q, source: "specialty", pantry: false });
      specialty.push(ing.name);
      continue;
    }

    return null; // introuvable et impossible à remplacer
  }

  return { recipe, needs, homemade, specialty };
}

/**
 * Prix et format retenus pour un besoin. Sans quantité (classement des recettes) : le format le moins cher à l'unité.
 * Avec la quantité de la semaine : le format qui coûte le moins une fois arrondi au nombre d'emballages.
 */
function unitCost(data: PlannerData, need: Need, week: number, qty?: number): { price: number; size: number; product?: StoreProduct } {
  if (need.source === "specialty") {
    const s = data.ingredients.get(need.ingredient)!.specialty!;
    return { price: s.priceMax, size: s.sizeQty }; // toujours le haut de la fourchette
  }
  // Semaine 1 : prix réels de la circulaire. Semaines suivantes : prix régulier (prudent).
  const priceOf = (p: StoreProduct) => (week === 1 ? p.price : Math.max(p.price, p.regularPrice));
  const cost = (p: StoreProduct) =>
    qty === undefined ? priceOf(p) / p.sizeQty : Math.max(1, Math.ceil(qty / p.sizeQty - 1e-9)) * priceOf(p);
  let best: StoreProduct | null = null;
  for (const p of data.products.get(need.ingredient)!) if (!best || cost(p) < cost(best)) best = p;
  return { price: priceOf(best!), size: best!.sizeQty, product: best! };
}

/** Coût fractionnel (sans arrondi aux emballages) — sert seulement à classer les recettes. */
function approxCost(r: Resolved, data: PlannerData, week: number): number {
  let c = 0;
  for (const n of r.needs) {
    const { price, size } = unitCost(data, n, week);
    c += (n.qty / size) * price;
  }
  return c;
}

interface Slot {
  week: number;
  day: number;
  meal: MealId;
  r: Resolved;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function sizeLabel(qty: number, unit: Unit): string {
  if (unit === "unite") return `${qty} unité${qty > 1 ? "s" : ""}`;
  if (unit === "g") return qty >= 1000 ? `${qty / 1000} kg` : `${qty} g`;
  return qty >= 1000 ? `${qty / 1000} L` : `${qty} ml`;
}

/** Coût réel d'un plan, au nombre d'emballages achetés. Les items de garde-manger sont achetés une fois, en semaine 1. */
export function costPlan(slots: Slot[], data: PlannerData, weeks: number) {
  const perWeek: { list: ListItem[]; pantry: ListItem[]; specialty: ListItem[]; total: number }[] = [];
  const pantryNeeds = new Map<string, number>();
  const pantryFirst = new Map<string, string>(); // forme commune → premier nom rencontré (son produit est utilisé)
  for (const s of slots) for (const n of s.r.needs) {
    if (!n.pantry) continue;
    const k = ingredientKey(n.ingredient);
    if (!pantryFirst.has(k)) pantryFirst.set(k, n.ingredient);
    const name = pantryFirst.get(k)!;
    pantryNeeds.set(name, (pantryNeeds.get(name) ?? 0) + n.qty);
  }

  let grand = 0;
  for (let w = 1; w <= weeks; w++) {
    const agg = new Map<string, Need>();
    for (const s of slots) {
      if (s.week !== w) continue;
      for (const n of s.r.needs) {
        if (n.pantry) continue;
        // « œufs » et « oeuf » : un seul article (même unité requise pour additionner)
        const key = `${n.source}:${ingredientKey(n.ingredient)}`;
        const prev = agg.get(key);
        const sameUnit = !prev || data.products.get(prev.ingredient)?.[0]?.sizeUnit === data.products.get(n.ingredient)?.[0]?.sizeUnit;
        if (prev && !sameUnit) agg.set(`${key}:${n.ingredient}`, { ...n });
        else agg.set(key, prev ? { ...prev, qty: prev.qty + n.qty } : { ...n });
      }
    }
    if (w === 1) for (const [ingredient, qty] of pantryNeeds) agg.set(`pantry:${ingredient}`, { ingredient, qty, source: "store", pantry: true });

    const list: ListItem[] = [];
    const pantry: ListItem[] = [];
    const specialty: ListItem[] = [];
    let total = 0;
    for (const n of agg.values()) {
      const { price, size, product } = unitCost(data, n, w, n.qty);
      const packages = Math.max(1, Math.ceil(n.qty / size - 1e-9));
      const line = round2(packages * price);
      total += line;
      const info = data.ingredients.get(n.ingredient);
      const item: ListItem = {
        ingredient: n.ingredient,
        product: n.source === "specialty" ? `${n.ingredient} (${info?.specialty?.where ?? "épicerie spécialisée"})` : product!.productName,
        size: n.source === "specialty" ? sizeLabel(info!.specialty!.sizeQty, info!.specialty!.sizeUnit) : sizeLabel(product!.sizeQty, product!.sizeUnit),
        packages,
        unitPrice: price,
        total: line,
        discounted: n.source === "store" && w === 1 && !!product?.discounted,
        estimated: n.source === "store" && !!product?.estimated,
        section: info?.section ?? "Autres",
      };
      (n.source === "specialty" ? specialty : n.pantry ? pantry : list).push(item);
    }
    const bySection = (a: ListItem, b: ListItem) => a.section.localeCompare(b.section, "fr") || a.product.localeCompare(b.product, "fr");
    list.sort(bySection);
    pantry.sort(bySection);
    perWeek.push({ list, pantry, specialty, total: round2(total) });
    grand += total;
  }
  return { perWeek, total: round2(grand) };
}

export function validateRequest(req: PlanRequest): string | null {
  if (!req || typeof req !== "object") return "Requête invalide.";
  if (!req.store) return "Choisissez une épicerie.";
  if (!req.meals?.length) return "Choisissez au moins un repas.";
  if (!(req.weeks >= 1 && req.weeks <= 4)) return "La durée doit être de 1 à 4 semaines.";
  if (!(req.people >= 1 && req.people <= 20)) return "Le nombre de personnes doit être de 1 à 20.";
  if (!req.cuisines?.length) return "Choisissez au moins une cuisine.";
  if (!(req.budget > 0)) return "Entrez un budget.";
  return null;
}

export function planMenu(req: PlanRequest, data: PlannerData, imageUrl: (r: PlannerRecipe) => string | null): PlanResponse {
  const invalid = validateRequest(req);
  if (invalid) return { ok: false, reason: "invalid", message: invalid };

  const target = round2(req.budget * BUDGET_SAFETY);
  const styles = req.styles?.length ? req.styles : (["normal"] as StyleId[]);

  // 1. Recettes admissibles et réalisables à cette épicerie
  const pools = new Map<MealId, Resolved[]>();
  for (const meal of req.meals) {
    const pool: Resolved[] = [];
    for (const r of data.recipes) {
      if (r.meal !== meal) continue;
      if (!req.cuisines.includes(r.cuisine as never)) continue;
      if (!r.styles.some((s) => styles.includes(s))) continue;
      if (!(req.diets ?? []).every((d) => r.diets.includes(d))) continue;
      const res = resolveRecipe(r, req.people, data, req.onlyStore);
      if (res) pool.push(res);
    }
    if (pool.length === 0) {
      return {
        ok: false,
        reason: "not_enough_recipes",
        message: "Aucune recette ne correspond à ces choix pour cette épicerie. Ajoutez une cuisine ou un genre de repas.",
      };
    }
    pools.set(meal, pool);
  }

  // 2. Sélection initiale : variété d'abord, en alternant les cuisines, du moins cher au plus cher
  const slots: Slot[] = [];
  const useCount = new Map<string, number>(); // par nom de plat
  const dish = (r: Resolved) => normalize(r.recipe.name);
  for (let w = 1; w <= req.weeks; w++) {
    for (const meal of req.meals) {
      const pool = pools.get(meal)!;
      const byCuisine = new Map<string, Resolved[]>();
      for (const r of pool) {
        const list = byCuisine.get(r.recipe.cuisine) ?? [];
        list.push(r);
        byCuisine.set(r.recipe.cuisine, list);
      }
      for (const list of byCuisine.values()) list.sort((a, b) => approxCost(a, data, w) - approxCost(b, data, w));
      const cuisines = [...byCuisine.keys()];
      let prev: string | null = null;
      const weekCount = new Map<string, number>();
      for (let d = 1; d <= 7; d++) {
        const list = byCuisine.get(cuisines[(d - 1 + w) % cuisines.length])!;
        // Le plat le moins servi jusqu'ici, jamais deux jours de suite, au plus 2 fois par semaine
        // (comparé par nom de plat). Si la cuisine du jour n'a plus d'option, on prend dans les autres.
        const inWeek = (r: Resolved) => weekCount.get(dish(r)) ?? 0;
        const fits = (r: Resolved) => dish(r) !== prev && inWeek(r) < 2;
        const leastUsed = (xs: Resolved[]) => [...xs].sort((a, b) => (useCount.get(dish(a)) ?? 0) - (useCount.get(dish(b)) ?? 0));
        const pick =
          leastUsed(list).find(fits) ?? leastUsed(pool).find(fits) ?? leastUsed(pool).find((r) => dish(r) !== prev) ?? list[0];
        useCount.set(dish(pick), (useCount.get(dish(pick)) ?? 0) + 1);
        weekCount.set(dish(pick), inWeek(pick) + 1);
        prev = dish(pick);
        slots.push({ week: w, day: d, meal, r: pick });
      }
    }
  }

  // 3. Tant que le total dépasse la cible, remplacer le repas le plus cher par une option moins chère
  let { total } = costPlan(slots, data, req.weeks);
  for (let guard = 0; total > target && guard < 600; guard++) {
    const order = slots
      .map((s, i) => ({ i, c: approxCost(s.r, data, s.week) }))
      .sort((a, b) => b.c - a.c);
    let improved = false;
    for (const { i, c } of order) {
      const s = slots[i];
      const cheaper = pools
        .get(s.meal)!
        .map((r) => ({ r, c: approxCost(r, data, s.week) }))
        .filter((x) => x.c < c - 0.01)
        .sort((a, b) => a.c - b.c);
      // Au plus 2 fois le même plat par semaine, si une autre option existe
      const timesInWeek = (r: Resolved) => slots.filter((o, j) => j !== i && o.week === s.week && dish(o.r) === dish(r)).length;
      // … et jamais le même plat que la veille ou le lendemain (même repas)
      const neighbor = (r: Resolved) => slots.some((o) => o.week === s.week && o.meal === s.meal && Math.abs(o.day - s.day) === 1 && dish(o.r) === dish(r));
      // Limite stricte : au plus 2 fois le même plat par semaine (plus seulement s'il n'y a pas assez de plats différents).
      // Mieux vaut annoncer un budget minimum réaliste que servir 7 fois la même recette.
      const distinct = new Set(pools.get(s.meal)!.map(dish)).size;
      const cap = Math.max(2, Math.ceil(7 / Math.max(1, distinct)));
      const allowed = cheaper.filter((x) => timesInWeek(x.r) < cap);
      cheaper.splice(0, cheaper.length, ...allowed);
      // Ordre de préférence : plats jamais servis sur la période, puis peu servis, puis le reste (toujours du moins cher au plus cher)
      const timesInPeriod = (r: Resolved) => slots.filter((o, j) => j !== i && dish(o.r) === dish(r)).length;
      const rank = (x: { r: Resolved }) => (timesInPeriod(x.r) === 0 ? 0 : timesInWeek(x.r) < 2 && !neighbor(x.r) ? 1 : 2);
      cheaper.sort((a, b) => rank(a) - rank(b) || a.c - b.c);
      for (const cand of cheaper) {
        const old = s.r;
        s.r = cand.r;
        const next = costPlan(slots, data, req.weeks).total;
        if (next < total) {
          total = next;
          improved = true;
          break;
        }
        s.r = old;
      }
      if (improved) break;
    }
    if (!improved) break;
  }

  // 4. Même coût, meilleur ordre : dans chaque semaine, on répartit les plats pour éviter deux jours de suite identiques
  for (let w = 1; w <= req.weeks; w++) {
    for (const meal of req.meals) {
      const days = slots.filter((x) => x.week === w && x.meal === meal).sort((a, b) => a.day - b.day);
      const counts = new Map<string, Resolved[]>();
      for (const x of days) counts.set(dish(x.r), [...(counts.get(dish(x.r)) ?? []), x.r]);
      let prevDish: string | null = null;
      for (const x of days) {
        // Le plat restant le plus fréquent, différent de la veille (stratégie gloutonne classique)
        const options = [...counts.entries()].filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
        const chosen = options.find(([k]) => k !== prevDish) ?? options[0];
        x.r = chosen[1].pop()!;
        prevDish = chosen[0];
      }
    }
  }

  const costed = costPlan(slots, data, req.weeks);
  if (costed.total > target) {
    return {
      ok: false,
      reason: "budget",
      message: "Ce budget est trop bas pour ces choix. Augmentez le budget ou réduisez le nombre de repas, de semaines ou de personnes.",
      minBudget: Math.ceil(costed.total / BUDGET_SAFETY),
    };
  }

  // 4. Réponse
  const recipes: Record<string, RecipeView> = {};
  for (const s of slots) {
    const r = s.r.recipe;
    if (recipes[r.id]) continue;
    recipes[r.id] = {
      id: r.id,
      name: r.name,
      cuisine: r.cuisine as RecipeView["cuisine"],
      meal: r.meal,
      styles: r.styles,
      servings: req.people,
      ingredients: r.ingredients.map((i) => ({
        name: i.name,
        display: scaleDisplay(i, req.people / r.servings),
      })),
      steps: r.steps,
      homemade: s.r.homemade.map((name) => {
        const h = data.ingredients.get(name)!.homemade!;
        return { name, steps: h.steps, ingredients: h.ingredients.map((x) => x.display ?? `${x.name}`) };
      }),
      specialty: s.r.specialty.map((name) => {
        const sp = data.ingredients.get(name)!.specialty!;
        return { name, where: sp.where, priceMax: sp.priceMax };
      }),
      kcal: r.kcal,
      protein: r.protein,
      image: imageUrl(r),
      costPerPortion: round2(approxCost(s.r, data, 1) / req.people),
    };
  }

  const weeks: WeekPlan[] = [];
  for (let w = 1; w <= req.weeks; w++) {
    const days = [];
    for (let d = 1; d <= 7; d++) {
      days.push({
        day: d,
        meals: req.meals
          .map((meal) => slots.find((s) => s.week === w && s.day === d && s.meal === meal)!)
          .map((s) => ({ meal: s.meal, recipeId: s.r.recipe.id })),
      });
    }
    const pw = costed.perWeek[w - 1];
    weeks.push({ week: w, estimated: w > 1, days, list: pw.list, pantry: pw.pantry, specialty: pw.specialty, total: pw.total });
  }

  return { ok: true, request: req, weeks, recipes, total: costed.total, target, generatedAt: new Date().toISOString() };
}

function scaleDisplay(i: RecipeIngredient, factor: number): string {
  const q = i.qty * factor;
  const nice = q >= 100 ? Math.round(q / 5) * 5 : Math.round(q * 10) / 10;
  const unit = i.unit === "unite" ? "" : ` ${i.unit}`;
  return `${nice}${unit} ${i.name}`.trim();
}
