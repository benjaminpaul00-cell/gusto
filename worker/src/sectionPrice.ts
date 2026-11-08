// Prix d'une recette de la section Recettes selon les épiceries choisies.
// Chaque ingrédient est relié à un ingrédient suivi (nom proche qui a un prix), puis converti dans l'unité
// de l'emballage. Les épices sans prix vont au garde-manger; les autres ingrédients introuvables sont « à venir ».

import { STORES, type StoreId, type Unit } from "../../shared/options";
import { loadPlannerData, loadPlannerDataFor, type Env } from "./db";
import { ingredientKey, isFree, normalize } from "./epiceries";
import { ensureIngredient } from "./jobs";
import { costPlan, resolveRecipe, type PlannerData, type PlannerRecipe } from "./planner";

interface Ing { qty: number; unit: Unit; name: string; display: string }
const label = (id: string) => STORES.find((s) => s.id === id)?.label ?? id;

// Mots de préparation, de coupe ou de format, ignorés pour relier les noms
const DESCRIPTORS = new Set(["hache", "hachee", "emince", "emincee", "finement", "grossierement", "tranche", "tranchee", "rape", "rapee", "coupe", "coupee",
  "cube", "cubes", "de", "du", "des", "la", "le", "les", "en", "et", "a", "au", "aux", "d", "l", "petit", "petite", "gros", "grosse", "moyen", "moyenne",
  "pele", "pelee", "ragout", "blanc", "paris", "branche", "brin", "feuille", "egoutte", "egouttee", "rince", "rincee", "fondu", "fondue", "mou", "molle",
  "frais", "fraiche", "frai", "pour", "decoration", "facultatif", "environ", "jeune", "jeunes", "bebe", "lanieres", "laniere", "rondelle", "rondelles", "de",
  "conserve", "boite", "surgele", "surgelee", "cuit", "cuite", "cru", "crue", "sec", "seche", "seches", "nature", "extra", "maigre", "mi", "bio", "biologique",
  "litre", "litres", "morceau", "morceaux", "pouce", "pouces", "po", "cm", "chacun", "chacune", "grand", "grande", "grands", "grandes", "petits", "petites", "gros",
  "bebes", "zeste", "quartier", "quartiers", "coupes", "coupees", "lave", "laves", "lavee", "lavees", "decongele", "decongeles", "entier", "entiere", "ou", "autre",
  "barquette", "sac", "paquet", "poignee", "dizaine", "pince", "pincee", "tronçons", "troncons", "troncon", "sections", "section", "env",
  "ml", "kg", "lb", "oz", "tasse", "tasses", "soupe", "table", "the", "cafe", "ecrase", "ecrases", "ecrasee", "ecrasees", "dans", "eau", "froide", "deux", "bulbe", "bulbes", "coeurs", "coeur", "mini"]);

// Lignes qui ne s'achètent pas : sous-recette, reste d'une étape, partie d'un autre ingrédient
const NOT_BOUGHT = /^\s*(\d+\s+)?(recette|le reste|la pulpe|les tiges|frondes|garnitures?|l[ée]gumes .*au choix|le zeste, les supr)/i;
// Ligne d'ingrédient sans quantités ni parenthèses, pour un second essai quand le nom découpé n'est pas reconnu
const fromDisplay = (d: string) => d.replace(/\([^)]*\)/g, " ").replace(/[\d½¼¾⅓⅔⅛⁄/.,+]+/g, " ").replace(/\s+/g, " ").trim();
export const words = (name: string) => ingredientKey(name).split(" ").filter((w) => w.length > 1 && !DESCRIPTORS.has(w));

// Synonymes courants : nom de recette → nom suivi
export const SYNONYMS: [RegExp, string[]][] = [
  [/\b(steak|bifteck|surlonge|contre filet|faux filet|bavette|entrecote|onglet)\b/, ["bœuf à bifteck", "boeuf"]],
  [/\b(cube|cubes) de b(oe|œ)uf|b(oe|œ)uf (a|à) (ragout|mijoter|braiser)/, ["bœuf à mijoter", "bœuf à braiser", "boeuf"]],
  [/\b(longe|filet|roti|rôti|cotelette|côtelette)s? de porc\b/, ["filet de porc", "longe de porc", "porc"]],
  [/\b(pancetta|lardons?)\b/, ["bacon"]],
  [/\b(emmenthal|emmental|gruyere|gruyère|monterey|jack|mozzarella|cheddar|parmesan|feta|fromage)\b/, ["cheddar", "mozzarella", "fromage"]],
  [/\btortillas?\b/, ["tortilla", "tortillas de blé", "tortillas"]],
  [/\b(baguette|pain|miche)\b/, ["baguette", "pain"]],
  [/\b(creme 15|crème 15|creme a cuisson|crème à cuisson|creme champetre|crème champêtre)/, ["crème 15 %", "crème"]],
  [/\b(oignons? verts?|echalotes? vertes?|échalotes? vertes?)\b/, ["oignon vert"]],
  [/\bechalotes? francaises?|échalotes? françaises?\b/, ["échalote", "échalote française"]],
  [/\b(piments? forts?|piment rouge|jalapeno|jalapeño)\b/, ["piment jalapeño", "piment"]],
  [/\bpoitrines? de poulet\b/, ["poitrine de poulet", "poulet"]],
  [/\bcuisses? de poulet|hauts? de cuisses?\b/, ["cuisse de poulet", "poulet"]],
  [/\bpoulet entier\b/, ["poulet entier", "poulet"]],
  [/\b(pates|pâtes)? ?(a|à) lasagnes?|lasagnes?\b/, ["lasagnes", "pâtes à lasagne", "pâtes"]],
  [/\b(spaghetti|spaghettini|penne|macaroni|fusilli|linguine|fettuccine|rotini)\b/, ["spaghetti", "pâtes"]],
  [/\btomates? broyees?|tomates? broyées?|coulis de tomates?|passata\b/, ["tomates broyées", "tomates en dés", "tomates"]],
  [/\bjus de legumes|jus de légumes\b/, ["jus de légumes", "jus de tomate"]],
  [/\bbouillon\b/, ["bouillon de poulet", "bouillon"]],
  [/\bconsomme|consommé\b/, ["bouillon de bœuf", "bouillon"]],
  [/\bfond de veau\b/, ["bouillon de bœuf", "bouillon"]],
  [/\bepinards?|épinards?\b/, ["épinards"]],
  [/\bchampignons?\b/, ["champignons tranche", "champignons de paris", "champignon"]],
  [/\bjus (de |d'|d’)?lime\b/, ["lime"]],
  [/\bjus (de |d'|d’)?citron\b/, ["citron"]],
  [/\b(pak choy|bok choy|bok choys)\b/, ["bok choy", "chou"]],
  [/\b(rigatoni|rigatonis|pennes?|tagliatelles?|orecchiette|farfalle)\b/, ["pâtes", "spaghetti"]],
  [/\bprosciutto|jambon cru\b/, ["prosciutto", "jambon"]],
  [/\b(plie|sole|aiglefin|morue|tilapia|goberge|poisson blanc)\b/, ["tilapia", "aiglefin", "morue", "poisson"]],
  [/\bescalopes? de dinde|dinde\b/, ["dinde", "poitrine de poulet"]],
  [/\bcitrouille|courge\b/, ["courge musquée", "courge"]],
  [/\bmesclun\b/, ["mesclun", "laitue"]],
  [/\bgigot|carre d'agneau|épaule d'agneau|epaule d'agneau\b/, ["agneau"]],
  [/\b(roti|rôti) de palette|palette\b/, ["bœuf à braiser", "bœuf à mijoter", "boeuf"]],
  [/\bailes? de poulet\b/, ["ailes de poulet", "cuisse de poulet", "poulet"]],
  [/\bchair (a|à) saucisses?\b/, ["saucisse", "porc haché"]],
  [/\bcotes? levees|côtes? levées\b/, ["côtes levées", "porc"]],
  [/\bmini[- ]poivrons?\b/, ["poivrons", "poivron"]],
  [/\bromaine\b/, ["laitue romaine", "laitue"]],
  [/\bfenouil\b/, ["fenouil"]],
];

// Épices, fines herbes séchées et condiments : au garde-manger s'ils n'ont pas de prix
const PANTRY = /\b(sel|poivre|epice|épice|epices|épices|poudre|flocons?|piment (broye|broyé|de cayenne|de la jamaique|de la jamaïque)|cayenne|sarriette|laurier|thym seche|thym séché|origan|cumin|paprika|cannelle|muscade|girofle|graines?|fines herbes|herbes|assaisonnement|sauce piquante|tabasco|sriracha|fumee liquide|fumée liquide|extrait|vanille|curcuma|garam|cari|curry|chili|chipotle|moutarde seche|moutarde sèche|bicarbonate|levure|fecule|fécule|sucre|vinaigre|huile|sauce soya|sauce worcestershire|harissa)\b/i;

// Poids moyen d'une unité (g), pour convertir « 2 poitrines de poulet » en grammes
const UNIT_WEIGHT: [RegExp, number][] = [
  [/hamburger|burger|hot dog|kaiser|sous marin/, 70], [/laitue|romaine|iceberg/, 500], [/tortilla/, 45], [/pita|naan/, 90],
  [/poitrine de poulet/, 200], [/cuisse de poulet/, 250], [/poulet entier/, 2000], [/oignon vert/, 15], [/oignon|echalote/, 150],
  [/pomme de terre grelot|grelot/, 40], [/pomme de terre|patate/, 220], [/patate douce/, 300], [/carotte/, 80], [/poivron/, 160],
  [/tomate/, 120], [/ail/, 5], [/oeuf/, 50], [/citron/, 110], [/lime/, 70], [/orange/, 180], [/tortilla/, 45], [/courgette/, 250],
  [/panais/, 150], [/rutabaga/, 800], [/baguette/, 300], [/chou fleur/, 900], [/brocoli/, 450], [/poireau/, 250], [/celeri/, 50],
  [/piment|jalapeno/, 15], [/champignon/, 20], [/aubergine/, 400], [/ananas/, 1500], [/avocat/, 170], [/pomme/, 180], [/banane/, 120],
  [/pain/, 500], [/pruneau/, 8], [/amande/, 1.2], [/pois mange tout/, 4], [/fenouil/, 400], [/chou/, 1000], [/concombre/, 300], [/crevette/, 20], [/petoncle/, 25], [/mini ma[iï]s/, 15], [/radis/, 15], [/asperge/, 20],
];
// Petits articles vendus en casseau, botte ou tête : combien en contient un emballage vendu « à l'unité »
const PER_PACK: [RegExp, number][] = [
  [/tomates? cerises?|raisins?/, 25], [/radis/, 10], [/asperges?/, 18], [/fraises?/, 25], [/okras?/, 20],
  [/\bail\b|gousses?/, 10], [/oignons? verts?/, 8], [/champignons?/, 15], [/mini ma[iï]s/, 20],
];
const perPack = (name: string) => PER_PACK.find(([re]) => re.test(normalize(name)))?.[1] ?? 1;
// Fines herbes et feuilles hachées mesurées en ml : environ 0,25 g par ml
const LEAFY_G_PER_ML = 0.25;
const LEAFY = /laitue|romaine|iceberg|epinard|chou|roquette|kale|bok choy|cresson|persil|coriandre|basilic|menthe|aneth|ciboulette|herbe|mesclun/;
const weightOf = (name: string) => UNIT_WEIGHT.find(([re]) => re.test(normalize(name)))?.[1] ?? 100;

/** Morceau d'un produit compté à l'unité (« 4 tranches de pain », « 2 branches de thym ») : une fraction d'emballage. */
function pieceShare(i: Ing): number | null {
  if (i.unit !== "unite") return null;
  const text = `${i.name} ${i.display}`;
  if (/feuilles? de laurier/i.test(text)) return 0.02;
  if (/\btranches?\b/i.test(text)) return 0.05;
  if (/\b(branches?|brins?|tiges?)\b/i.test(text)) return 0.1;
  if (/\bfeuilles?\b/i.test(text)) return 0.03;
  return null;
}

export interface Known { name: string; w: string[]; n: number }

/** Relie un nom libre à un ingrédient suivi. 1) tous les mots de l'ingrédient suivi présents; 2) même mot principal. */
export function matchKnown(name: string, known: Known[]): string | null {
  const q = words(name);
  if (!q.length) return null;
  let best: { k: Known; score: number } | null = null;
  for (const k of known) {
    if (!k.w.length) continue;
    const common = k.w.filter((w) => q.includes(w)).length;
    if (common < k.w.length) continue;
    const score = common / Math.max(q.length, k.w.length);
    if (score >= 0.6 && (!best || score > best.score || (score === best.score && k.n > best.k.n))) best = { k, score };
  }
  if (best) return best.k.name;
  // Second essai : le mot principal (le premier) est commun, et assez de mots se recoupent
  let alt: { k: Known; common: number } | null = null;
  for (const k of known) {
    if (!k.w.includes(q[0])) continue;
    const common = k.w.filter((w) => q.includes(w)).length;
    if (common < Math.min(2, q.length, k.w.length)) continue;
    if (!alt || common > alt.common || (common === alt.common && (k.w.length < alt.k.w.length || (k.w.length === alt.k.w.length && k.n > alt.k.n)))) alt = { k, common };
  }
  return alt?.k.name ?? null;
}

function toRecipe(id: string, servings: number, ings: { qty: number; unit: Unit; name: string }[]): PlannerRecipe {
  return { id, name: id, cuisine: "", meal: "souper", styles: [], diets: [], servings, ingredients: ings, steps: [], kcal: 0, protein: 0, carbs: 0, fat: 0, image: null };
}

export async function priceSectionRecipe(env: Env, r: { id: string; servings: number; ingredients: string }, body: any) {
  const stores = (Array.isArray(body?.stores) ? body.stores : []).filter((s: string) => STORES.some((x) => x.id === s)) as StoreId[];
  const chosen = [...new Set(stores)];
  const people = Math.min(24, Math.max(1, Math.round(Number(body?.people) || r.servings)));
  if (!chosen.length) return { people, stores: [], missing: [], pantryMissing: [], single: [], best: null, multi: null };
  const ings = JSON.parse(r.ingredients) as Ing[];

  const perStore = new Map<string, PlannerData>();
  for (const s of chosen) perStore.set(s, await loadPlannerData(env, s));
  const combined = await loadPlannerDataFor(env, chosen);
  const priced = (n: string) => !!combined.products.get(n)?.length || !!combined.ingredients.get(n)?.homemade || !!combined.ingredients.get(n)?.specialty;
  const known: Known[] = [...combined.ingredients.keys()].filter(priced).map((name) => ({ name, w: words(name), n: combined.products.get(name)?.length ?? 0 }));
  const findName = (name: string): string | null => {
    if (priced(name)) return name;
    const direct = matchKnown(name, known);
    if (direct) return direct;
    const n = normalize(name);
    if (PANTRY.test(n)) return null;
    for (const [re, targets] of SYNONYMS) if (re.test(n)) for (const t of targets) { const m = priced(t) ? t : matchKnown(t, known); if (m) return m; }
    return null;
  };

  const mapped: { qty: number; unit: Unit; name: string }[] = [];
  const missing: string[] = [];
  const pantryMissing: string[] = [];
  for (const i of ings) {
    if (isFree(i.name) || NOT_BOUGHT.test(i.display ?? "")) continue;
    const k = findName(i.name) ?? (i.display ? findName(fromDisplay(i.display)) : null);
    const product = k ? combined.products.get(k)?.[0] : undefined;
    let need: { qty: number; unit: Unit } | null = null;
    if (k && product) {
      const share = pieceShare(i);
      if (share !== null && product.sizeUnit === "unite") need = { qty: i.qty * share, unit: "unite" };
      else if (share !== null) need = { qty: product.sizeQty * Math.min(1, i.qty * share), unit: product.sizeUnit };
      else if (i.unit === "unite" && product.sizeUnit === "unite") need = { qty: i.qty / perPack(`${i.name} ${k}`), unit: "unite" };
      else if (i.unit === "ml" && product.sizeUnit === "g" && LEAFY.test(normalize(i.name))) need = { qty: i.qty * LEAFY_G_PER_ML, unit: "g" };
      else if (i.unit === product.sizeUnit || (i.unit !== "unite" && product.sizeUnit !== "unite")) need = { qty: i.qty, unit: i.unit };
      else if (i.unit === "unite") need = { qty: i.qty * weightOf(i.name), unit: product.sizeUnit }; // unités → grammes
      else {
        // grammes → unités (ex. une botte, une laitue); des feuilles hachées mesurées en ml pèsent environ 0,4 g par ml
        const grams = i.unit === "ml" && LEAFY.test(normalize(i.name)) ? i.qty * LEAFY_G_PER_ML : i.qty;
        need = { qty: Math.max(0.01, grams / weightOf(k)), unit: "unite" };
      }
    }
    const test = k && need ? resolveRecipe(toRecipe("t", r.servings, [{ ...need, name: k }]), people, combined, false) : null;
    if (k && need && test) mapped.push({ ...need, name: k });
    else if (k && !need) mapped.push({ qty: i.qty, unit: i.unit, name: k }); // version maison ou épicerie spécialisée
    else if (PANTRY.test(normalize(i.name)) || PANTRY.test(normalize(i.display))) pantryMissing.push(i.display || i.name);
    else {
      missing.push(i.display || i.name);
      if (!k) await ensureIngredient(env, i.name.toLowerCase().trim()).catch(() => {});
    }
  }

  const recipe = toRecipe(r.id, r.servings, mapped);
  const cost = (data: PlannerData) => {
    // Un ingrédient introuvable dans cette épicerie ne bloque pas toute la recette : il est mis de côté
    let res = resolveRecipe(recipe, people, data, false);
    if (!res) {
      const ok = mapped.filter((m) => resolveRecipe(toRecipe("t", r.servings, [m]), people, data, false));
      if (!ok.length) return null;
      res = resolveRecipe(toRecipe(r.id, r.servings, ok), people, data, false);
      if (!res) return null;
    }
    const w = costPlan([{ week: 1, day: 1, meal: "souper", r: res }], data, 1).perWeek[0];
    const items = [...w.list, ...w.specialty];
    const total = Math.round(items.reduce((n, i) => n + i.total, 0) * 100) / 100; // garde-manger listé à part, non compté
    return { total, items, pantry: w.pantry, estimated: items.filter((i) => i.estimated).length };
  };
  const single = chosen.map((s) => {
    const c = cost(perStore.get(s)!);
    return c ? { store: s, label: label(s), total: c.total, estimated: c.estimated, items: c.items, pantry: c.pantry } : null;
  }).filter(Boolean) as { store: StoreId; label: string; total: number; estimated: number; items: unknown[]; pantry: unknown[] }[];
  single.sort((a, b) => a.total - b.total);
  const multi = chosen.length > 1 ? cost(combined) : null;
  const best = single[0] ?? null;
  return {
    people, stores: chosen, missing, pantryMissing,
    single: single.map(({ items, pantry, ...s }) => s),
    best: best ? { store: best.store, label: best.label, total: best.total, items: best.items, pantry: best.pantry } : null,
    multi: multi && best ? { total: multi.total, savings: Math.max(0, Math.round((best.total - multi.total) * 100) / 100), items: multi.items, pantry: multi.pantry } : null,
  };
}
