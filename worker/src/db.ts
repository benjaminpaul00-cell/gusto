import { STYLE_RULES, type StyleId, type Unit } from "../../shared/options";
import type { IngredientInfo, PlannerData, PlannerRecipe, StoreProduct } from "./planner";

export interface Env {
  DB: D1Database;
  IMAGES?: R2Bucket; // photos : R2 si branché…
  IMAGES_KV?: KVNamespace; // …sinon Workers KV (voir src/images.ts)
  AI: Ai;
  ADMIN_TOKEN: string;
  IP_SALT: string;
  ALLOWED_ORIGIN: string;
  PUBLIC_API_URL: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
  GEMINI_IMAGE_MODEL: string;
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL: string;
  WORKERS_AI_TEXT_FALLBACK?: string; // "1" : IA de Cloudflare en dernier recours pour le texte (forfait payant)
  JOB_PARALLEL?: string; // tâches menées en même temps par passage
  JOB_BUDGET?: string; // sous-requêtes par passage (40 au forfait gratuit)
  GROQ_API_KEY?: string;
  GROQ_MODEL: string;
  WORKERS_AI_TEXT_MODEL: string;
  WORKERS_AI_IMAGE_MODEL: string;
  DAILY_PLAN_LIMIT: string;
}

export const now = () => Date.now();

export function computeStyles(kcal: number, protein: number, gourmand: boolean): StyleId[] {
  const s: StyleId[] = [];
  if (gourmand) s.push("gourmand");
  else s.push("normal");
  if (protein >= STYLE_RULES.proteineMinProteinG) s.push("proteine");
  if (kcal > 0 && kcal < STYLE_RULES.legerMaxKcal && !gourmand) s.push("leger");
  return s;
}

// Cache en mémoire de l'isolat : évite de relire toute la banque à chaque visiteur.
const memo = new Map<string, { at: number; data: PlannerData }>();
const TTL = 10 * 60 * 1000;

export async function loadPlannerData(env: Env, store: string): Promise<PlannerData> {
  const hit = memo.get(store);
  if (hit && now() - hit.at < TTL) return hit.data;

  const [recipesRes, ingRes, prodRes] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM recipes WHERE status = 'active'"),
    env.DB.prepare("SELECT * FROM ingredients WHERE status = 'resolved'"),
    env.DB.prepare("SELECT * FROM store_products"),
  ]);

  const recipes: PlannerRecipe[] = (recipesRes.results as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    meal: r.meal,
    styles: JSON.parse(r.styles),
    diets: JSON.parse(r.diets),
    servings: r.servings,
    ingredients: JSON.parse(r.ingredients),
    steps: JSON.parse(r.steps),
    kcal: r.kcal,
    protein: r.protein,
    image: r.image_key,
  }));

  const ingredients = new Map<string, IngredientInfo>();
  for (const i of ingRes.results as any[]) {
    ingredients.set(i.name, {
      name: i.name,
      section: i.section ?? "Autres",
      pantry: !!i.pantry,
      unitWeightG: i.unit_weight_g,
      homemade: i.homemade ? JSON.parse(i.homemade) : null,
      specialty: i.specialty ? JSON.parse(i.specialty) : null,
    });
  }

  const products = new Map<string, StoreProduct[]>();
  const add = (p: StoreProduct) => { const list = products.get(p.ingredient) ?? []; if (!list.length || list[0].sizeUnit === p.sizeUnit) list.push(p); products.set(p.ingredient, list); };
  const rows = prodRes.results as any[];
  for (const p of rows.filter((x) => x.store === store)) {
    add({
      ingredient: p.ingredient,
      store,
      productName: p.product_name,
      sizeQty: p.size_qty,
      sizeUnit: p.size_unit as Unit,
      price: p.price,
      regularPrice: p.regular_price,
      discounted: !!p.discounted,
      deal: p.deal === "vrai" || p.deal === "plancher" ? p.deal : null,
    });
  }
  // Ingrédient non suivi dans cette bannière : formats relevés dans les autres bannières, au prix régulier
  // majoré de 10 % par prudence. La liste affiche « prix estimé ».
  const own = new Set(products.keys());
  const seen = new Set<string>();
  for (const p of rows) {
    if (p.store === store || own.has(p.ingredient) || seen.has(`${p.ingredient}:${p.product_id}`)) continue;
    seen.add(`${p.ingredient}:${p.product_id}`);
    const price = Math.round(p.regular_price * 1.1 * 100) / 100;
    add({
      ingredient: p.ingredient,
      store, // acheté dans la bannière choisie, au prix estimé
      productName: p.product_name,
      sizeQty: p.size_qty,
      sizeUnit: p.size_unit as Unit,
      price,
      regularPrice: price,
      discounted: false,
      estimated: true,
    });
  }

  const data = { recipes, ingredients, products };
  memo.set(store, { at: now(), data });
  return data;
}

/**
 * Plusieurs épiceries : pour chaque ingrédient, les formats relevés dans toutes les bannières choisies.
 * Le calcul prend ensuite le moins cher, donc chaque article est acheté là où il coûte le moins.
 * Un ingrédient suivi dans aucune d'elles garde le prix estimé de la première.
 */
export async function loadPlannerDataFor(env: Env, stores: string[]): Promise<PlannerData> {
  const list = [...new Set(stores)].filter(Boolean);
  if (list.length <= 1) return loadPlannerData(env, list[0] ?? "maxi");
  const all = [];
  for (const s of list) all.push(await loadPlannerData(env, s));
  const products = new Map<string, StoreProduct[]>();
  for (const data of all) {
    for (const [ing, prods] of data.products) {
      const real = prods.filter((p) => !p.estimated);
      if (!real.length) continue;
      const cur = products.get(ing) ?? [];
      // Mêmes unités seulement (le calcul additionne des quantités)
      const unit = cur[0]?.sizeUnit ?? real[0].sizeUnit;
      products.set(ing, [...cur, ...real.filter((p) => p.sizeUnit === unit)]);
    }
  }
  for (const [ing, prods] of all[0].products) if (!products.has(ing)) products.set(ing, prods);
  return { recipes: all[0].recipes, ingredients: all[0].ingredients, products };
}

export async function enqueue(env: Env, kind: string, payload: unknown, delayMs = 0) {
  await env.DB.prepare("INSERT INTO jobs (kind, payload, run_after, created_at) VALUES (?, ?, ?, ?)")
    .bind(kind, JSON.stringify(payload), now() + delayMs, now())
    .run();
}

export async function hashKey(env: Env, value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.IP_SALT}:${value}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Limite douce par IP et par jour. Retourne false si la limite est atteinte. */
export async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = await hashKey(env, `${ip}:${day}`);
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits (key, day, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
  )
    .bind(key, day)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= Number(env.DAILY_PLAN_LIMIT || 40);
}
