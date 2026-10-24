// Recettes publiques : liste et fiche détaillée, avec le coût par portion dans chaque bannière.
// Servent aux pages /recettes du site (rendues par apps/web/site-worker.js) et au plan du site.

import { CUISINES, DIETS, MEALS, STORES, STYLES } from "../../shared/options";
import { loadPlannerData, type Env } from "./db";
import { recipeCost, type PlannerData, type PlannerRecipe } from "./planner";

const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

/** Données de toutes les bannières (gardées en mémoire par loadPlannerData). */
async function allStores(env: Env): Promise<Map<string, PlannerData>> {
  const out = new Map<string, PlannerData>();
  for (const s of STORES) out.set(s.id, await loadPlannerData(env, s.id));
  return out;
}

function costs(recipe: PlannerRecipe, stores: Map<string, PlannerData>) {
  const list: { store: string; label: string; perPortion: number; estimated: boolean }[] = [];
  for (const s of STORES) {
    const c = recipeCost(recipe, stores.get(s.id)!);
    // Coût invalide (format de produit à 0, par exemple) : bannière ignorée
    if (c && Number.isFinite(c.perPortion) && c.perPortion > 0) list.push({ store: s.id, label: s.label, perPortion: c.perPortion, estimated: c.estimated });
  }
  return list.sort((a, b) => a.perPortion - b.perPortion);
}

const imageOf = (env: Env, r: PlannerRecipe) => (r.image ? `${env.PUBLIC_API_URL.replace(/\/$/, "")}/img/${r.image}` : null);

/** Liste de toutes les recettes prêtes (au moins un prix connu). */
export async function listRecipes(env: Env) {
  const stores = await allStores(env);
  const recipes = stores.get(STORES[0].id)!.recipes;
  const items: { id: string; name: string; cuisine: string; cuisineLabel: string; meal: string; mealLabel: string; image: string | null; kcal: number; protein: number; from: ReturnType<typeof costs>[number] }[] = [];
  for (const r of recipes) {
    const c = costs(r, stores);
    if (!c.length) continue;
    items.push({
      id: r.id, name: r.name, cuisine: r.cuisine, cuisineLabel: label(CUISINES, r.cuisine),
      meal: r.meal, mealLabel: label(MEALS, r.meal), image: imageOf(env, r),
      kcal: r.kcal, protein: r.protein, from: c.find((x) => !x.estimated) ?? c[0], // prix relevé de préférence à un prix estimé
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return {
    cuisines: CUISINES.map((c) => ({ id: c.id, label: c.label, count: items.filter((i) => i.cuisine === c.id).length })),
    recipes: items,
  };
}

/** Fiche complète d'une recette, avec des suggestions de la même cuisine. */
export async function getRecipe(env: Env, id: string) {
  const stores = await allStores(env);
  const all = stores.get(STORES[0].id)!.recipes;
  const r = all.find((x) => x.id === id);
  if (!r) return null;
  const c = costs(r, stores);
  if (!c.length) return null;
  const ref = recipeCost(r, stores.get(c[0].store)!)!;
  const info = stores.get(c[0].store)!.ingredients;
  // Suggestions : même cuisine, même repas d'abord ; choix stable d'un jour à l'autre
  const related = all
    .filter((x) => x.id !== r.id && x.cuisine === r.cuisine)
    .sort((a, b) => Number(b.meal === r.meal) - Number(a.meal === r.meal) || a.id.localeCompare(b.id))
    .slice(0, 4)
    .map((x) => ({ id: x.id, name: x.name, image: imageOf(env, x) }));
  return {
    id: r.id, name: r.name, cuisine: r.cuisine, cuisineLabel: label(CUISINES, r.cuisine),
    meal: r.meal, mealLabel: label(MEALS, r.meal), servings: r.servings,
    styles: r.styles.map((s) => label(STYLES, s)), diets: r.diets.map((d) => label(DIETS, d)),
    ingredients: r.ingredients.map((i) => i.display ?? i.name),
    steps: r.steps, kcal: r.kcal, protein: r.protein, image: imageOf(env, r),
    costs: c,
    homemade: ref.homemade.map((name) => {
      const h = info.get(name)?.homemade;
      return { name, ingredients: h?.ingredients.map((x) => x.display ?? x.name) ?? [], steps: h?.steps ?? [] };
    }),
    specialty: ref.specialty.map((name) => ({ name, where: info.get(name)?.specialty?.where ?? "" })),
    related,
  };
}
