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
export function costPlan(slots: Slot[], data: PlannerData, weeks: number, pantryOwned = false) {
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
      if (!(n.pantry && pantryOwned)) total += line; // garde-manger supposé déjà à la maison : listé, pas compté
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

const CUISINE_ADJ: Record<string, string> = {
  quebecoise: "québécoises", haitienne: "haïtiennes", chinoise: "chinoises", vietnamienne: "vietnamiennes", grecque: "grecques",
  libanaise: "libanaises", italienne: "italiennes", mexicaine: "d’Amérique centrale", indienne: "indiennes", marocaine: "marocaines",
  thailandaise: "thaïlandaises", portugaise: "portugaises", venezuelienne: "vénézuéliennes", colombienne: "colombiennes",
  peruvienne: "péruviennes", dominicaine: "dominicaines",
};
const CUISINE_NOUN: Record<string, string> = {
  quebecoise: "cuisine québécoise", haitienne: "cuisine haïtienne", chinoise: "cuisine chinoise", vietnamienne: "cuisine vietnamienne",
  grecque: "cuisine grecque", libanaise: "cuisine libanaise", italienne: "cuisine italienne", mexicaine: "cuisine d’Amérique centrale",
  indienne: "cuisine indienne", marocaine: "cuisine marocaine", thailandaise: "cuisine thaïlandaise", portugaise: "cuisine portugaise",
  venezuelienne: "cuisine vénézuélienne", colombienne: "cuisine colombienne", peruvienne: "cuisine péruvienne", dominicaine: "cuisine dominicaine",
};
// Familles de cuisines : l'appoint vient d'abord des cuisines voisines de celles choisies.
const FAMILIES: string[][] = [
  ["haitienne", "dominicaine", "venezuelienne", "colombienne", "peruvienne", "mexicaine"],
  ["chinoise", "vietnamienne", "thailandaise", "indienne"],
  ["grecque", "libanaise", "italienne", "marocaine", "portugaise"],
  ["quebecoise", "portugaise", "italienne"],
];
const closeness = (chosen: readonly string[], c: string) =>
  chosen.includes(c) ? 0 : FAMILIES.some((f) => f.includes(c) && chosen.some((x) => f.includes(x))) ? 1 : 2;
const joinFr = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);
/** « cuisine vénézuélienne et cuisine colombienne » ou « vénézuéliennes et colombiennes » */
function cuisineList(ids: readonly string[], form: "noun" | "adj" = "noun") {
  return joinFr(ids.map((c) => (form === "adj" ? CUISINE_ADJ[c] : CUISINE_NOUN[c]) ?? c));
}

export function planMenu(req: PlanRequest, data: PlannerData, imageUrl: (r: PlannerRecipe) => string | null): PlanResponse {
  const invalid = validateRequest(req);
  if (invalid) return { ok: false, reason: "invalid", message: invalid };

  const target = round2(req.budget * BUDGET_SAFETY);
  const styles = req.styles?.length ? req.styles : (["normal"] as StyleId[]);

  // 1. Recettes admissibles et réalisables à cette épicerie
  const notices: string[] = [];
  const eligible = (meal: MealId, cuisines: readonly string[] | null, strictStyles: boolean) => {
    const pool: Resolved[] = [];
    for (const r of data.recipes) {
      if (r.meal !== meal) continue;
      if (cuisines && !cuisines.includes(r.cuisine)) continue;
      if (strictStyles && !r.styles.some((s) => styles.includes(s))) continue;
      if (!(req.diets ?? []).every((d) => r.diets.includes(d))) continue; // restrictions : jamais assouplies
      const res = resolveRecipe(r, req.people, data, req.onlyStore);
      if (res) pool.push(res);
    }
    return pool;
  };
  const pools = new Map<MealId, Resolved[]>();
  const usedCuisines = new Set<string>();
  for (const meal of req.meals) {
    // Cuisines choisies d'abord ; sinon (recettes pas encore prêtes) d'autres cuisines, puis d'autres genres de repas.
    let pool = eligible(meal, req.cuisines, true);
    if (!pool.length) {
      pool = eligible(meal, null, true);
      if (pool.length) notices.push(`Nous préparons encore les recettes de ${cuisineList(req.cuisines)} pour ce repas : ton menu utilise d’autres cuisines en attendant.`);
    }
    if (!pool.length) pool = eligible(meal, null, false);
    if (pool.length === 0) {
      return {
        ok: false,
        reason: "not_enough_recipes",
        message: "Aucune recette ne respecte encore ces restrictions alimentaires pour cette épicerie. Réessaie bientôt : de nouvelles recettes s’ajoutent chaque jour.",
      };
    }
    for (const r of pool) usedCuisines.add(r.recipe.cuisine);
    // Moins de 4 plats différents : on complète avec d'autres cuisines plutôt que de répéter le même plat
    const names = new Set(pool.map((r) => normalize(r.recipe.name)));
    if (names.size < 4) {
      const extra = eligible(meal, null, true)
        .filter((r) => !pool.includes(r) && !names.has(normalize(r.recipe.name)))
        .sort((a, b) => closeness(req.cuisines, a.recipe.cuisine) - closeness(req.cuisines, b.recipe.cuisine));
      if (extra.length) {
        pool = [...pool, ...extra.slice(0, Math.max(0, 6 - names.size) * 3)];
        if (!notices.some((n) => n.startsWith("Pour varier"))) notices.push("Pour varier ton menu, nous avons ajouté quelques recettes d’autres cuisines, le temps que ta sélection s’enrichisse.");
      }
    }
    pools.set(meal, pool);
  }
  const waiting = req.cuisines.filter((c) => !usedCuisines.has(c));
  if (waiting.length && waiting.length < req.cuisines.length)
    notices.push(`Les recettes ${cuisineList(waiting, "adj")} arrivent bientôt : ton menu utilise tes autres cuisines pour l’instant.`);

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
      // Les cuisines choisies se relaient ; les recettes d'appoint (autres cuisines) ne servent qu'à compléter
      const all = [...byCuisine.keys()];
      const chosen = all.filter((c) => (req.cuisines as readonly string[]).includes(c));
      const cuisines = chosen.length ? chosen : all;
      let prev: string | null = null;
      const weekCount = new Map<string, number>();
      for (let d = 1; d <= 7; d++) {
        // Les cuisines choisies se relaient d'un jour à l'autre
        const list = byCuisine.get(cuisines[(d - 1 + w) % cuisines.length])!;
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

  // 3. Tant que le total dépasse la cible, remplacer les repas les plus chers par des options moins chères.
  //    Préférences : même cuisine (garde la répartition), plats pas encore servis, peu servis, puis le prix.
  //    strict = au plus 2 fois le même plat par semaine.
  //    Rapidité (forfait gratuit : peu de temps de calcul) : les remplacements se décident avec le coût estimé
  //    de chaque plat (en cache) ; la facture exacte, au nombre d'emballages, n'est recalculée qu'une fois par tour.
  const acCache = new Map<string, number>();
  const ac = (r: Resolved, w: number) => {
    const k = `${r.recipe.id}|${w === 1 ? 1 : 2}`;
    let v = acCache.get(k);
    if (v === undefined) { v = approxCost(r, data, w); acCache.set(k, v); }
    return v;
  };
  let pantryOwned = false;
  let total = costPlan(slots, data, req.weeks).total;
  // maxPerWeek = nombre maximal de fois le même plat dans une semaine
  const reduce = (maxPerWeek: number) => {
    for (let round = 0; round < 12 && total > target; round++) {
      const weekCount = new Map<string, number>();
      const periodCount = new Map<string, number>();
      for (const o of slots) {
        weekCount.set(`${o.week}|${dish(o.r)}`, (weekCount.get(`${o.week}|${dish(o.r)}`) ?? 0) + 1);
        periodCount.set(dish(o.r), (periodCount.get(dish(o.r)) ?? 0) + 1);
      }
      const est0 = slots.reduce((sum, o) => sum + ac(o.r, o.week), 0);
      const goal = est0 * (target / total) - 0.5; // ce que l'estimation doit atteindre pour passer sous la cible
      let est = est0;
      let changed = false;
      const order = slots.map((_, i) => i).sort((x, y) => ac(slots[y].r, slots[y].week) - ac(slots[x].r, slots[x].week));
      for (const i of order) {
        if (est <= goal) break;
        const s = slots[i];
        const c = ac(s.r, s.week);
        const inWeek = (r: Resolved) => (weekCount.get(`${s.week}|${dish(r)}`) ?? 0) - (dish(r) === dish(s.r) ? 1 : 0);
        const inPeriod = (r: Resolved) => (periodCount.get(dish(r)) ?? 0) - (dish(r) === dish(s.r) ? 1 : 0);
        const distinct = new Set(pools.get(s.meal)!.map(dish)).size;
        const cap = Math.max(maxPerWeek, Math.ceil(7 / Math.max(1, distinct)));
        // Cuisines choisies d'abord, puis même cuisine que le plat remplacé, puis plats peu servis
        const chosenFirst = (r: Resolved) => ((req.cuisines as readonly string[]).includes(r.recipe.cuisine) ? 0 : 4);
        const rank = (r: Resolved) => chosenFirst(r) + (r.recipe.cuisine === s.r.recipe.cuisine ? 0 : 1) + (inPeriod(r) === 0 ? 0 : inWeek(r) < 2 ? 1 : 2);
        let best: Resolved | null = null;
        let bestKey = Infinity;
        for (const r of pools.get(s.meal)!) {
          const rc = ac(r, s.week);
          if (rc >= c - 0.01 || inWeek(r) >= cap) continue;
          const key = rank(r) * 1e6 + rc;
          if (key < bestKey) { bestKey = key; best = r; }
        }
        if (!best) continue;
        // Mise à jour des compteurs
        const oldW = `${s.week}|${dish(s.r)}`, newW = `${s.week}|${dish(best)}`;
        weekCount.set(oldW, (weekCount.get(oldW) ?? 1) - 1);
        weekCount.set(newW, (weekCount.get(newW) ?? 0) + 1);
        periodCount.set(dish(s.r), (periodCount.get(dish(s.r)) ?? 1) - 1);
        periodCount.set(dish(best), (periodCount.get(dish(best)) ?? 0) + 1);
        est += ac(best, s.week) - c;
        s.r = best;
        changed = true;
      }
      if (!changed) break;
      total = costPlan(slots, data, req.weeks, pantryOwned).total;
    }
  };
  // Ordre des ajustements : la variété passe avant tout le reste.
  reduce(2);
  if (total > target) {
    // 1. Le garde-manger (sel, huile, épices…) est supposé déjà à la maison : la variété est préservée
    pantryOwned = true;
    total = costPlan(slots, data, req.weeks, true).total;
    reduce(2);
    notices.push("Ton budget suppose que tu as déjà le garde-manger (sel, huile, épices…) : ces articles sont listés à part, sans être comptés.");
  }
  if (total > target) {
    // 2. Un même plat peut revenir 3, puis au plus 4 fois dans la semaine (jamais plus)
    reduce(3);
    if (total > target) reduce(4);
    notices.push("Pour respecter ton budget, certains plats reviennent plus souvent dans la semaine.");
  }
  if (total > target) {
    // Budget très serré : on laisse libres les repas les plus chers, par paquets, jusqu'à passer sous le budget.
    const requested = slots.length;
    for (let round = 0; round < 40 && slots.length && total > target; round++) {
      const est = slots.reduce((sum, o) => sum + ac(o.r, o.week), 0);
      const goal = est * (target / total);
      slots.sort((x, y) => ac(y.r, y.week) - ac(x.r, x.week));
      let cut = est;
      let n = 0;
      while (n < slots.length - 1 && cut > goal) { cut -= ac(slots[n].r, slots[n].week); n++; }
      slots.splice(0, Math.max(1, n));
      total = costPlan(slots, data, req.weeks, pantryOwned).total;
    }
    slots.sort((x, y) => x.week - y.week || x.day - y.day);
    // Des repas laissés libres : l'avis sur les plats répétés n'a plus d'intérêt
    const k = notices.findIndex((n) => n.startsWith("Pour respecter ton budget, certains plats"));
    if (k >= 0) notices.splice(k, 1);
    notices.push(slots.length
      ? `Ton budget couvre ${slots.length} repas sur ${requested}. Les autres sont laissés libres pour que tu ne dépasses jamais ton budget.`
      : "Ce budget ne couvre pas encore un repas complet avec ces choix. Augmente un peu le montant pour obtenir un menu.");
  }

  // 4. Même coût, meilleur ordre : dans chaque semaine, on répartit les plats pour éviter deux jours de suite identiques
  for (let w = 1; w <= req.weeks; w++) {
    for (const meal of req.meals) {
      const days = slots.filter((x) => x.week === w && x.meal === meal).sort((a, b) => a.day - b.day);
      const counts = new Map<string, Resolved[]>();
      for (const x of days) counts.set(dish(x.r), [...(counts.get(dish(x.r)) ?? []), x.r]);
      let prevDish: string | null = null;
      for (const x of days) {
        const options = [...counts.entries()].filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
        const chosen = options.find(([k]) => k !== prevDish) ?? options[0];
        x.r = chosen[1].pop()!;
        prevDish = chosen[0];
      }
    }
  }

  const costed = costPlan(slots, data, req.weeks, pantryOwned);

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
          .map((meal) => slots.find((s) => s.week === w && s.day === d && s.meal === meal))
          .filter((s): s is Slot => !!s)
          .map((s) => ({ meal: s.meal, recipeId: s.r.recipe.id })),
      });
    }
    const pw = costed.perWeek[w - 1];
    weeks.push({ week: w, estimated: w > 1, days, list: pw.list, pantry: pw.pantry, specialty: pw.specialty, total: pw.total, ...(pantryOwned ? { pantryIncluded: false } : {}) });
  }

  return { ok: true, request: req, weeks, recipes, total: costed.total, target, generatedAt: new Date().toISOString(), ...(notices.length ? { notices } : {}) };
}

function scaleDisplay(i: RecipeIngredient, factor: number): string {
  const q = i.qty * factor;
  const nice = q >= 100 ? Math.round(q / 5) * 5 : Math.round(q * 10) / 10;
  const unit = i.unit === "unite" ? "" : ` ${i.unit}`;
  return `${nice}${unit} ${i.name}`.trim();
}

/**
 * Coût d'une recette par portion dans une bannière (prix de la semaine), pour les pages publiques de recettes.
 * null si un ingrédient est introuvable et impossible à remplacer.
 */
export function recipeCost(recipe: PlannerRecipe, data: PlannerData): { perPortion: number; estimated: boolean; homemade: string[]; specialty: string[] } | null {
  const r = resolveRecipe(recipe, recipe.servings, data, false);
  if (!r) return null;
  const estimated = r.specialty.length > 0 || r.needs.some((n) => n.source === "store" && data.products.get(n.ingredient)?.[0]?.estimated);
  return { perPortion: round2(approxCost(r, data, 1) / recipe.servings), estimated, homemade: r.homemade, specialty: r.specialty };
}
