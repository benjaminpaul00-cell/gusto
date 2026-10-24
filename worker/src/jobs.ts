// Tâches d'arrière-plan, exécutées par les déclencheurs Cron (voir wrangler.toml).
// Chaque exécution traite quelques tâches en respectant la limite de sous-requêtes du forfait gratuit.

import { CUISINES, DIETS, MEALS, type Unit } from "../../shared/options";
import { AllProvidersFailed, generateImage, generateJson, imagePrompt } from "./ai";
import { computeStyles, enqueue, now, type Env } from "./db";
import { getProduct, isFree, matchIngredient, type StoreMatch } from "./epiceries";
import { deleteImage, putImage } from "./images";

const UNITS: Unit[] = ["g", "ml", "unite"];
const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;
const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
// Au Québec : déjeuner = matin, dîner = midi, souper = soir.
// Précisions envoyées à l'IA pour certaines cuisines
const CUISINE_HINT: Record<string, string> = {
  mexicaine: "Mexique, Guatemala, Salvador et le reste de l'Amérique centrale",
  venezuelienne: "Venezuela",
  colombienne: "Colombie",
  peruvienne: "Pérou",
  dominicaine: "République dominicaine",
};

const MEAL_HINT: Record<string, string> = {
  dejeuner: "déjeuner, c'est-à-dire le repas du MATIN au Québec : œufs, crêpes, gruau, pain doré, sandwichs-déjeuner, bols du matin, ou les plats du matin de cette cuisine",
  diner: "dîner, c'est-à-dire le repas du MIDI au Québec : plat principal complet du midi (soupe-repas, salade-repas, sandwich garni, bol, plat chaud)",
  souper: "souper, c'est-à-dire le repas du SOIR : plat principal complet et nourrissant",
};
const canon = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
const capitalize = (s: string) => { const t = s.trim().replace(/\s+/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
// Desserts et boissons : refusés pour le dîner et le souper.
const NOT_A_MEAL = /\b(tarte (au sucre|aux? (fraises?|bananes?|pommes?|bleuets?|citron|pacanes?|framboises?))|g[aâ]teau|pouding|biscuits?|muffins?|riz au lait|cr[eè]me (br[uû]l[ée]e|glac[ée]e|caramel)|sorbet|brownies?|beignes?|carr[ée]s aux dattes|mousse au chocolat|flan|smoothie|limonade)\b/i;
/** Texte d'affichage de secours : « 500 g de poulet », « 2 oignon ». */
const displayOf = (i: { name: string; qty: number; unit: Unit }) => {
  const q = Math.round(i.qty * 100) / 100;
  if (i.unit === "unite") return `${q} ${i.name}`;
  return `${q} ${i.unit} ${/^[aeiouyhéèêàâîôû]/i.test(i.name) ? "d'" : "de "}${i.name}`;
};

// ---------- Validation des réponses de l'IA ----------

interface AiIngredient { name: string; qty: number; unit: Unit; display: string }
interface AiRecipe {
  name: string; gourmand: boolean; diets: string[]; servings: number;
  ingredients: AiIngredient[]; steps: string[]; kcal: number; protein: number; dish_en: string;
}
const isIngredient = (i: any): i is AiIngredient =>
  i && typeof i.name === "string" && typeof i.qty === "number" && i.qty > 0 && UNITS.includes(i.unit);
const isRecipes = (x: any): x is { recipes: AiRecipe[] } =>
  Array.isArray(x?.recipes) &&
  x.recipes.every((r: any) =>
    typeof r.name === "string" && Array.isArray(r.ingredients) && r.ingredients.length > 0 && r.ingredients.every(isIngredient) &&
    Array.isArray(r.steps) && typeof r.kcal === "number" && typeof r.protein === "number");

interface AiIngredientInfo {
  section: string; pantry: boolean; unitWeightG: number | null; searchTerms: string[]; categories?: number[];
  homemade: { yieldQty: number; yieldUnit: Unit; ingredients: AiIngredient[]; steps: string[] } | null;
  specialty: { where: string; priceMax: number; sizeQty: number; sizeUnit: Unit } | null;
}
const isInfo = (x: any): x is AiIngredientInfo =>
  typeof x?.section === "string" && typeof x?.pantry === "boolean" && Array.isArray(x?.searchTerms) &&
  (x.homemade === null || (Array.isArray(x.homemade?.ingredients) && x.homemade.ingredients.every(isIngredient) && UNITS.includes(x.homemade.yieldUnit))) &&
  (x.specialty === null || (typeof x.specialty?.priceMax === "number" && UNITS.includes(x.specialty.sizeUnit)));

// Catégories alimentaires d'épiceries.ca (endpoint=categories), pour cibler la recherche de produits.
const EP_CATEGORIES = "1 Légumes, 2 Fruits, 3 Salades préemballées, 4 Fines herbes, 5 Légumes précoupés, 6 Fruits séchés et noix, 7 Lait, 8 Crème, 9 Oeufs, 10 Beurre, 11 Fromage, 12 Yogourt, 14 Crème sure, 15 Produits laitiers sans lactose, 16 Poulet et dinde, 17 Boeuf, 18 Saucisses, 19 Bacon, 20 Porc et jambon, 21 Substituts de viande, 22 Poisson et fruits de mer, 23 Autres viandes, 25 Pâtes et nouilles, 26 Riz et couscous, 27 Haricots secs, lentilles et pois, 28 Céréales et déjeuner, 29 Aliments en conserve, 30 Articles de cuisson (farine, sucre, levure), 32 Miels, sirops et tartinades, 33 Huile et vinaigre, 34 Condiments et sauces, 35 Épices et assaisonnements, 44 Pain, 46 Petits pains, 51 Pains plats et tortillas, 53 Fruits et légumes surgelés, 54 Viande et poisson surgelés, 62 Soupes et bouillons";

// ---------- Tâches ----------

// Au plus 4 recettes par demande : les quotas gratuits limitent les jetons par minute.
const RECIPES_PER_CALL = 4;

async function genRecipes(env: Env, job: { cuisine: string; meal: string; count: number }) {
  const p = { ...job, count: Math.min(job.count, RECIPES_PER_CALL) };
  // Noms déjà utilisés pour cette cuisine, tous repas confondus, pour éviter les doublons
  const existing = await env.DB.prepare("SELECT name FROM recipes WHERE cuisine = ?").bind(p.cuisine).all<{ name: string }>();
  const avoid = existing.results.map((r) => r.name).slice(-120).join("; ") || "aucune";

  const prompt = `Tu es un chef de grand talent qui crée des recettes pour des familles au Québec.
Crée ${p.count} recettes de cuisine ${label(CUISINES, p.cuisine)}${CUISINE_HINT[p.cuisine] ? ` (${CUISINE_HINT[p.cuisine]})` : ""} pour le ${MEAL_HINT[p.meal] ?? p.meal}.
Niveau attendu : qualité restaurant, inspirée des plats emblématiques et des techniques des chefs les plus réputés de cette cuisine
(assaisonnement juste, cuissons précises, textures et garnitures soignées, une touche qui fait la différence),
mais réalisable à la maison avec un budget familial. Écris tout dans tes propres mots.
Ne nomme jamais de chef, de restaurant ni de livre, et ne dis pas que la recette vient d'un chef.
Règles :
- Chaque recette est un REPAS COMPLET qui nourrit 4 personnes. Jamais de dessert, de boisson, de sauce ou d'accompagnement seul.
- "name" : nom du plat en français, avec une majuscule initiale (ex. « Poulet au beurre », « Soupe aux pois »).
- Les ${p.count} recettes doivent être toutes différentes les unes des autres.
- Ingrédients faciles à trouver dans les épiceries québécoises (Maxi, IGA, Metro, Super C), sauf si un ingrédient est essentiel à l'authenticité.
- Recettes variées : certaines riches en protéines, certaines légères, certaines réconfortantes.
- Portions pour 4 personnes. Entre 6 et 12 ingrédients par recette (garde-manger compris : huile, sel, épices).
- Entre 5 et 8 étapes détaillées et précises (températures, durées, gestes), en français québécois standard.
- "name" de chaque ingrédient : nom générique au singulier, en minuscules, sans marque ni quantité (ex. « oignon jaune », « poitrine de poulet », « riz basmati »).
- "unit" : uniquement "g", "ml" ou "unite".
- "display" : obligatoire, la quantité telle qu'on l'écrit dans une recette (ex. « 2 gousses d'ail », « 500 g de bœuf haché »).
- "kcal" et "protein" : estimation par portion.
- "gourmand" : true si c'est un plat riche et réconfortant.
- "diets" : sous-ensemble de ${JSON.stringify(DIETS.map((d) => d.id))} qui s'appliquent vraiment.
- "dish_en" : courte description du plat en anglais, pour générer une photo.
- N'utilise pas ces recettes déjà existantes : ${avoid}.
Réponds uniquement en JSON :
{"recipes":[{"name":"","gourmand":false,"diets":[],"servings":4,"ingredients":[{"name":"","qty":0,"unit":"g","display":"500 g de poitrine de poulet"}],"steps":[""],"kcal":0,"protein":0,"dish_en":""}]}`;

  const out = await generateJson(env, prompt, isRecipes);
  const seen = new Set(existing.results.map((r) => canon(r.name)));
  for (const raw of out.recipes) {
    const r = { ...raw, name: capitalize(raw.name) };
    if (p.meal !== "dejeuner" && NOT_A_MEAL.test(r.name)) continue; // dessert : refusé
    if (seen.has(canon(r.name))) continue; // doublon
    if (r.ingredients.length < 5 || r.steps.length < 4) continue; // recette trop sommaire
    seen.add(canon(r.name));
    const id = `${slug(r.name)}-${crypto.randomUUID().slice(0, 6)}`;
    const ingredients = r.ingredients.map((i) => {
      const name = canon(i.name);
      return { ...i, name, display: typeof i.display === "string" && i.display.trim() ? i.display.trim() : displayOf({ ...i, name }) };
    });
    await env.DB.prepare(
      `INSERT INTO recipes (id, name, cuisine, meal, styles, diets, servings, ingredients, steps, kcal, protein, image_prompt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id, r.name, p.cuisine, p.meal,
        JSON.stringify(computeStyles(r.kcal, r.protein, !!r.gourmand)),
        JSON.stringify((r.diets ?? []).filter((d) => DIETS.some((x) => x.id === d))),
        r.servings || 4, JSON.stringify(ingredients), JSON.stringify(r.steps), r.kcal, r.protein,
        imagePrompt(r.dish_en || r.name, label(CUISINES, p.cuisine)), now(),
      )
      .run();
    for (const i of ingredients) await ensureIngredient(env, i.name);
    await enqueue(env, "gen_image", { recipeId: id });
  }
  // Le reste du lot est remis en file
  if (job.count > p.count) await enqueue(env, "gen_recipes", { cuisine: job.cuisine, meal: job.meal, count: job.count - p.count });
}

async function ensureIngredient(env: Env, name: string) {
  const res = await env.DB.prepare("INSERT OR IGNORE INTO ingredients (name, updated_at) VALUES (?, ?)").bind(name, now()).run();
  if (res.meta.changes > 0) await enqueue(env, "resolve_ingredient", { name });
}

async function resolveIngredient(env: Env, p: { name: string }) {
  const prompt = `Ingrédient de recette : « ${p.name} ». Contexte : épiceries au Québec (Maxi, IGA, Metro, Super C, Provigo, Walmart).
Réponds uniquement en JSON avec :
- "section" : rayon d'épicerie en français (ex. « Fruits et légumes », « Viandes », « Produits laitiers », « Épicerie », « Surgelés », « Boulangerie », « Épices et condiments »).
- "pantry" : true si c'est un produit de garde-manger qu'on a souvent déjà (sel, poivre, huile, épices séchées, farine, sucre, vinaigre).
- "unitWeightG" : poids moyen en grammes d'une unité (ex. 1 oignon ≈ 150), ou null si ça ne s'applique pas.
- Vocabulaire des emballages AU QUÉBEC : lime (pas « citron vert »), morue (pas « cabillaud »), lentilles rouges (pas « corail »), boisson d'amande (pas « lait d'amande »), tomates entières ou en dés (pas « tomates pelées »), levure instantanée ou traditionnelle, coriandre fraîche, échalote française.
- "searchTerms" : 1 à 3 termes PRÉCIS, tels qu'écrits sur l'emballage en épicerie québécoise, du plus précis au plus général (ex. lait → « lait 2 % », « lait » ; sel → « sel de table », « sel » ; beurre → « beurre salé », « beurre » ; « oignons jaunes » ; « poitrines de poulet »).
- "categories" : 1 ou 2 numéros de catégorie où trouver le produit NATURE (pas un produit transformé), parmi : ${EP_CATEGORIES}. Ex. bleuets → [2, 53], œufs → [9], cheddar → [11].
- "homemade" : si l'ingrédient peut être absent des grandes épiceries mais se fait facilement à la maison avec des ingrédients courants, la sous-recette ; sinon null.
- "specialty" : s'il peut être absent des grandes épiceries et ne se fait pas à la maison, où le trouver (type de commerce, ex. « épicerie haïtienne ») et une estimation PRUDENTE du prix maximal d'un format courant ; sinon null.
Format : {"section":"","pantry":false,"unitWeightG":null,"searchTerms":[""],"categories":[1],"homemade":{"yieldQty":250,"yieldUnit":"ml","ingredients":[{"name":"","qty":0,"unit":"g","display":""}],"steps":[""]},"specialty":{"where":"","priceMax":0,"sizeQty":0,"sizeUnit":"g"}}`;

  const info = await generateJson(env, prompt, isInfo);
  const cats = (Array.isArray(info.categories) ? info.categories : []).filter((c) => Number.isInteger(c) && c > 0 && c < 100).slice(0, 2);
  const homemade = info.homemade ? { ...info.homemade, ingredients: info.homemade.ingredients.map((i) => ({ ...i, name: canon(i.name) })) } : null;

  await env.DB.prepare(
    "UPDATE ingredients SET section = ?, pantry = ?, unit_weight_g = ?, search_terms = ?, categories = ?, homemade = ?, specialty = ?, status = 'resolved', updated_at = ? WHERE name = ?",
  )
    .bind(info.section, info.pantry ? 1 : 0, info.unitWeightG, JSON.stringify(info.searchTerms), JSON.stringify(cats),
      homemade ? JSON.stringify(homemade) : null, info.specialty ? JSON.stringify(info.specialty) : null, now(), p.name)
    .run();

  if (homemade) for (const i of homemade.ingredients) await ensureIngredient(env, i.name);

  // Prix : tentés ici, mais épiceries.ca bloque souvent les serveurs Cloudflare (captcha).
  // Dans ce cas, les prix arrivent par scripts/prix.mjs, lancé depuis un ordinateur (POST /admin/prices).
  try {
    if (isFree(p.name)) return;
    const matches = await matchIngredient([...info.searchTerms, p.name], cats);
    await savePrices(env, p.name, matches);
  } catch {
    /* prix récupérés plus tard depuis un ordinateur */
  }
}

/** Enregistre les produits trouvés pour un ingrédient et note la date de vérification. */
export async function savePrices(env: Env, ingredient: string, matches: StoreMatch[]) {
  const t = now();
  // Introuvable : une seule fois, on demande à l'IA d'autres termes de recherche
  if (!matches.length && !isFree(ingredient)) {
    const row = await env.DB.prepare("SELECT terms_retried FROM ingredients WHERE name = ?").bind(ingredient).first<{ terms_retried: number | null }>();
    if (row && !row.terms_retried) {
      await env.DB.prepare("UPDATE ingredients SET terms_retried = 1 WHERE name = ?").bind(ingredient).run();
      await enqueue(env, "retry_terms", { name: ingredient });
    }
  }
  const stmts = matches.map((m) =>
    env.DB.prepare(
      `INSERT INTO store_products (ingredient, store, product_id, product_name, size_qty, size_unit, price, regular_price, discounted, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ingredient, store, product_id) DO UPDATE SET product_name = excluded.product_name,
         size_qty = excluded.size_qty, size_unit = excluded.size_unit, price = excluded.price, discounted = excluded.discounted,
         regular_price = CASE WHEN excluded.discounted = 0 THEN excluded.price
                              ELSE MAX(store_products.regular_price, excluded.price) END,
         updated_at = excluded.updated_at`,
    )
      // Prix régulier inconnu pour un produit en rabais : on le majore de 25 % par prudence.
      .bind(ingredient, m.store, m.productId, m.productName, m.sizeQty, m.sizeUnit, m.price, m.discounted ? m.price * 1.25 : m.price, m.discounted ? 1 : 0, t),
  );
  // Nouvelle liste complète : les anciens produits (peut-être mal choisis) sont remplacés.
  if (matches.length) stmts.unshift(env.DB.prepare("DELETE FROM store_products WHERE ingredient = ?").bind(ingredient));
  stmts.push(env.DB.prepare("UPDATE ingredients SET prices_checked_at = ? WHERE name = ?").bind(t, ingredient));
  await env.DB.batch(stmts);
}

/** Ingrédient introuvable sous ses termes : d'autres termes et catégories, puis nouvelle recherche de prix. */
async function retryTerms(env: Env, p: { name: string }) {
  const row = await env.DB.prepare("SELECT search_terms FROM ingredients WHERE name = ?").bind(p.name).first<{ search_terms: string | null }>();
  if (!row) return;
  const prompt = `Ingrédient de recette : « ${p.name} ». Introuvable dans les épiceries québécoises (Maxi, IGA, Metro, Super C, Provigo, Walmart) avec ces termes : ${row.search_terms}.
Propose 3 AUTRES termes, tels qu'écrits sur les emballages au Québec, du plus précis au plus général, ou un produit équivalent courant (ex. citron vert → « limes » ; cabillaud → « filets de morue » ; lentilles corail → « lentilles rouges » ; lait d'amande → « boisson d'amande »).
Et 1 ou 2 numéros de catégorie parmi : ${EP_CATEGORIES}.
Réponds uniquement en JSON : {"searchTerms":["","",""],"categories":[1]}`;
  const out = await generateJson(env, prompt, (x: any): x is { searchTerms: string[]; categories: number[] } =>
    Array.isArray(x?.searchTerms) && x.searchTerms.every((t: any) => typeof t === "string") && Array.isArray(x?.categories));
  const cats = out.categories.filter((c) => Number.isInteger(c) && c > 0 && c < 100).slice(0, 2);
  await env.DB.prepare("UPDATE ingredients SET search_terms = ?, categories = ?, prices_checked_at = NULL WHERE name = ?")
    .bind(JSON.stringify(out.searchTerms.slice(0, 3)), JSON.stringify(cats), p.name).run();
}

async function genImage(env: Env, p: { recipeId: string }) {
  const r = await env.DB.prepare("SELECT image_prompt, name FROM recipes WHERE id = ?").bind(p.recipeId).first<{ image_prompt: string; name: string }>();
  if (!r) return;
  const img = await generateImage(env, r.image_prompt || r.name);
  const key = `recipes/${p.recipeId}-${Date.now().toString(36)}.${img.type.includes("png") ? "png" : "jpg"}`;
  await putImage(env, key, img.bytes, img.type);
  const old = await env.DB.prepare("SELECT image_key FROM recipes WHERE id = ?").bind(p.recipeId).first<{ image_key: string | null }>();
  await env.DB.prepare("UPDATE recipes SET image_key = ? WHERE id = ?").bind(key, p.recipeId).run();
  if (old?.image_key) await deleteImage(env, old.image_key);
}

const REFRESH_BATCH = 20;

async function refreshPrices(env: Env, p: { offset: number }) {
  const rows = await env.DB.prepare("SELECT DISTINCT product_id FROM store_products ORDER BY product_id LIMIT ? OFFSET ?")
    .bind(REFRESH_BATCH, p.offset)
    .all<{ product_id: string }>();
  for (const { product_id } of rows.results) {
    try {
      const detail = await getProduct(product_id);
      for (const sp of detail.prices ?? []) {
        // Prix régulier : le prix non soldé le plus récent ; sinon on garde l'ancien (jamais plus bas que le prix actuel).
        await env.DB.prepare(
          `UPDATE store_products SET price = ?, discounted = ?,
             regular_price = CASE WHEN ? = 0 THEN ? ELSE MAX(regular_price, ?) END, updated_at = ?
           WHERE product_id = ? AND store = ?`,
        )
          .bind(sp.price, sp.discounted ? 1 : 0, sp.discounted ? 1 : 0, sp.price, sp.price, now(), product_id, sp.store)
          .run();
      }
    } catch {
      /* produit retiré : on garde le dernier prix connu */
    }
  }
  if (rows.results.length === REFRESH_BATCH) await enqueue(env, "refresh_prices", { offset: p.offset + REFRESH_BATCH });
}

// ---------- Exécution ----------

// Sous-requêtes maximales estimées par tâche (forfait gratuit : 50 par exécution).
const COST: Record<string, number> = { gen_recipes: 5, resolve_ingredient: 14, retry_terms: 3, gen_image: 3, refresh_prices: REFRESH_BATCH + 1 };
const HANDLERS: Record<string, (env: Env, p: any) => Promise<void>> = {
  gen_recipes: genRecipes,
  resolve_ingredient: resolveIngredient,
  retry_terms: retryTerms,
  gen_image: genImage,
  refresh_prices: refreshPrices,
};

/** Traite les tâches en file. `maxJobs` limite la durée quand quelqu'un attend la réponse (/admin/run). */
export async function runJobs(env: Env, budget = 40, maxJobs = Infinity) {
  const done: string[] = [];
  // Les ingrédients d'abord : une recette n'est utilisable que lorsque ses ingrédients ont un prix.
  const jobs = await env.DB.prepare(
    `SELECT * FROM jobs WHERE status = 'queued' AND run_after <= ?
     ORDER BY CASE kind WHEN 'refresh_prices' THEN 0 WHEN 'resolve_ingredient' THEN 1 WHEN 'retry_terms' THEN 1 WHEN 'gen_recipes' THEN 2 ELSE 3 END, id LIMIT 20`,
  )
    .bind(now())
    .all<{ id: number; kind: string; payload: string; attempts: number }>();

  for (const job of jobs.results) {
    const cost = COST[job.kind] ?? 10;
    if (cost > budget) continue;
    budget -= cost;
    try {
      await HANDLERS[job.kind](env, JSON.parse(job.payload));
      await env.DB.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").bind(job.id).run();
      done.push(`${job.kind}#${job.id}`);
    } catch (e) {
      const attempts = job.attempts + 1;
      // Quota épuisé ou panne : on réessaie dans 6 h. Le site continue de fonctionner avec la banque existante.
      // Limite par minute (429) : nouvel essai bientôt. Quota du jour épuisé : dans 6 h. Autre erreur : 30 min.
      const msg = String((e as Error).message);
      const delay = !(e instanceof AllProvidersFailed) ? 30 * 60_000 : / 429/.test(msg) && !/daily|4006/.test(msg) ? 15 * 60_000 : 6 * 3600_000;
      await env.DB.prepare("UPDATE jobs SET attempts = ?, last_error = ?, run_after = ?, status = ? WHERE id = ?")
        .bind(attempts, String((e as Error).message).slice(0, 500), now() + delay, attempts >= 5 ? "failed" : "queued", job.id)
        .run();
    }
    if (budget < 3 || done.length >= maxJobs) break;
  }
  return done;
}

/** Remplit la banque de départ : `rounds` × `count` recettes pour chaque cuisine et chaque repas. */
export async function seed(env: Env, rounds = 2, count = 8) {
  let n = 0;
  for (let i = 0; i < rounds; i++)
    for (const c of CUISINES) for (const m of MEALS) { await enqueue(env, "gen_recipes", { cuisine: c.id, meal: m.id, count }); n++; }
  return n;
}

export async function cleanup(env: Env) {
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rate_limits WHERE day < ?").bind(today),
    env.DB.prepare("DELETE FROM jobs WHERE status = 'done' AND created_at < ?").bind(now() - 7 * 86400_000),
  ]);
}
