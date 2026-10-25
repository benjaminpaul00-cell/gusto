// Client de l'API publique d'épiceries.ca — https://epiceries.ca/developers
// Usage raisonnable : tout est mis en cache dans D1, les prix sont rafraîchis une fois par semaine.

import type { Unit } from "../../shared/options";

const BASE = "https://epiceries.ca/api";

export interface EpUnitPrice { value: number | null; unit: string; raw?: string }

export interface EpProduct {
  id: string;
  name: string;
  brand?: string | null;
  size?: string | null;
  price: number;
  unitPrice?: EpUnitPrice | null;
  store: string;
  discounted: boolean;
  prices?: { store: string; price: number; discounted: boolean; size?: string | null; unitPrice?: EpUnitPrice | null }[];
}

async function get<T>(params: Record<string, string>): Promise<T> {
  const url = `${BASE}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Gusto (planificateur de menus)" } });
  const body = (await res.json()) as { ok: boolean; data: T; error?: { message: string } };
  if (!body.ok) throw new Error(`epiceries.ca: ${body.error?.message ?? res.status}`);
  return body.data;
}

export const searchProducts = (q: string, limit = 8, category?: number) =>
  get<{ results: EpProduct[] }>({ endpoint: "search", q, limit: String(limit), ...(category ? { category: String(category) } : {}) }).then((d) => d.results);

export const getProduct = (id: string) => get<EpProduct>({ endpoint: "product", id });

// ---------- Historique des prix : vrai prix régulier et vrais rabais ----------

export interface EpObservation { store: string; price: number; discounted: boolean; size?: string | null; timestamp: number }
/** Relevés d'un produit dans une bannière (les plus récents, en ordre chronologique). */
export const getHistory = (id: string, store: string, limit = 200) =>
  get<{ history: EpObservation[] }>({ endpoint: "history", id, store, limit: String(limit) }).then((d) => d.history ?? []);

/** « vrai » : rabais réel ; « plancher » : plus bas prix de l'année ; « faux » : annoncé en rabais, mais au prix habituel. */
export type Deal = "vrai" | "plancher" | "faux";
export interface PriceInsight { regularPrice: number | null; lowPrice: number | null; discounted: boolean; deal: Deal | null }

const DAY = 86400;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/**
 * Prix régulier = médiane des derniers relevés SANS rabais (6 mois, sinon 12). Un rabais compte s'il est
 * au moins 3 % sous ce prix ; sinon c'est un faux rabais. Sans relevé régulier, le prix régulier reste inconnu.
 */
export function analyzeHistory(obs: EpObservation[], current: { price: number; discounted: boolean }, nowSec = Date.now() / 1000): PriceInsight {
  // Même format que le relevé le plus récent (un ancien format plus petit fausserait la comparaison)
  const size = obs.at(-1)?.size ?? null;
  const same = obs.filter((o) => o.price > 0 && (!size || !o.size || o.size === size));
  const year = same.filter((o) => o.timestamp >= nowSec - 365 * DAY);
  const regularIn = (days: number) => year.filter((o) => !o.discounted && o.timestamp >= nowSec - days * DAY).slice(-6).map((o) => o.price);
  const regs = regularIn(180).length ? regularIn(180) : regularIn(365);
  const regular = regs.length ? Math.round(median(regs) * 100) / 100 : null;
  const low = year.length ? Math.min(...year.map((o) => o.price), current.price) : null;
  if (!current.discounted) return { regularPrice: current.price, lowPrice: low, discounted: false, deal: null };
  if (regular === null) {
    // « En rabais » sans arrêt depuis au moins 8 semaines, au même prix : c'est son prix habituel
    const recent = year.filter((o) => o.timestamp >= nowSec - 120 * DAY);
    const span = recent.length ? (recent.at(-1)!.timestamp - recent[0].timestamp) / DAY : 0;
    const steady = recent.length >= 3 && span >= 56 && recent.every((o) => o.discounted && Math.abs(o.price - current.price) <= current.price * 0.03);
    if (steady) return { regularPrice: current.price, lowPrice: low, discounted: false, deal: "faux" };
    return { regularPrice: null, lowPrice: low, discounted: true, deal: null };
  }
  if (current.price > regular * 0.97) return { regularPrice: current.price, lowPrice: low, discounted: false, deal: "faux" };
  return { regularPrice: regular, lowPrice: low, discounted: true, deal: low !== null && current.price <= low * 1.005 ? "plancher" : "vrai" };
}

/** Ajoute le vrai prix régulier aux produits annoncés en rabais (1 appel « history » par produit en rabais). */
export async function withHistory(matches: StoreMatch[]): Promise<StoreMatch[]> {
  const out: StoreMatch[] = [];
  for (const m of matches) {
    if (!m.discounted) { out.push({ ...m, regularPrice: m.price, deal: null }); continue; }
    try {
      const h = analyzeHistory(await getHistory(m.productId, m.store), m);
      out.push({ ...m, discounted: h.discounted, regularPrice: h.regularPrice, lowPrice: h.lowPrice, deal: h.deal });
    } catch {
      out.push({ ...m, regularPrice: null, deal: null }); // historique indisponible : prix régulier inconnu
    }
  }
  return out;
}

/** « 2 L » → {2000, ml} ; « 900 g » → {900, g} ; « 12 unités » → {12, unite}. */
export function parseSize(size?: string): { qty: number; unit: Unit } | null {
  if (!size) return null;
  const s = size.toLowerCase().replace(",", ".").replace(/\s+/g, " ").trim();
  const multi = s.match(/^(\d+)\s*[x×]\s*(.+)$/);
  if (multi) {
    const inner = parseSize(multi[2]);
    return inner ? { qty: inner.qty * Number(multi[1]), unit: inner.unit } : null;
  }
  const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|mg|l|ml|lb|oz|un|unité|unités|unites|ea|dz|douzaine)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "kg": return { qty: n * 1000, unit: "g" };
    case "g": return { qty: n, unit: "g" };
    case "mg": return { qty: n / 1000, unit: "g" };
    case "l": return { qty: n * 1000, unit: "ml" };
    case "ml": return { qty: n, unit: "ml" };
    case "lb": return { qty: Math.round(n * 453.6), unit: "g" };
    case "oz": return { qty: Math.round(n * 28.35), unit: "g" };
    case "dz": case "douzaine": return { qty: n * 12, unit: "unite" };
    default: return { qty: n, unit: "unite" };
  }
}

/**
 * Format d'un produit. Beaucoup de produits d'épiceries.ca n'ont pas de « size » (null) :
 * on déduit alors le format du prix et du prix unitaire (« 5.09/100g » à 3,97 $ ≈ 78 g).
 * « raw » est préféré à « value », parfois incohérent avec le prix.
 */
export function effectiveSize(size: string | null | undefined, price: number, unitPrice?: EpUnitPrice | null): { qty: number; unit: Unit } | null {
  const parsed = parseSize(size ?? undefined);
  if (parsed) return parsed;
  if (!unitPrice || !(price > 0)) return null;
  let per: number | null = null;
  let base = 1;
  let unit: Unit | null = null;
  const raw = unitPrice.raw?.toLowerCase().replace(",", ".").match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d*)\s*(g|ml|unité|unite|un)/);
  if (raw) {
    per = Number(raw[1]);
    base = raw[2] ? Number(raw[2]) : 1;
    unit = raw[3] === "g" ? "g" : raw[3] === "ml" ? "ml" : "unite";
  } else if (unitPrice.value != null) {
    const u = unitPrice.unit.toLowerCase();
    per = unitPrice.value;
    if (u === "100 g") { base = 100; unit = "g"; }
    else if (u === "100 ml") { base = 100; unit = "ml"; }
    else if (u.startsWith("unit")) unit = "unite";
  }
  if (!unit || !per || per <= 0) return null;
  const qty = (price / per) * base;
  if (!isFinite(qty) || qty <= 0) return null;
  return { qty: unit === "unite" ? Math.max(1, Math.round(qty)) : Math.round(qty), unit };
}

/** Format écrit seulement dans le nom (« Gros oeufs blancs 12 », « Oeufs, douzaine »). */
export function sizeFromName(name: string): { qty: number; unit: Unit } | null {
  const parsed = parseSize(name);
  if (parsed) return parsed;
  const n = name.toLowerCase();
  if (/douzaine/.test(n)) return { qty: 12, unit: "unite" };
  const m = n.match(/\b(\d{1,2})\s*(?:un|unit[ée]s?|ct|oeufs?|œufs?)?\s*$/);
  return m && Number(m[1]) > 0 ? { qty: Number(m[1]), unit: "unite" } : null;
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Singulier approximatif : « oignons » → « oignon », « poireaux » → « poireau ».
// (Les mots courts ne sont pas touchés : « maïs », « pois », « riz ».)
const stem = (w: string) => (w.length > 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
const sameWord = (tok: string, w: string) => tok === w || (w.length >= 5 && tok.startsWith(w));

// Mots descriptifs souvent absents des noms de produits : ignorés dans le terme cherché.
const TERM_STOP = new Set(["conserve", "frai", "fraiche", "frais", "nature", "naturel", "naturelle", "decortique", "decortiquee", "emballe", "vrac"]);
const termWords = (term: string) => normalize(term).split(" ").filter((w) => w.length > 2).map(stem).filter((w) => !TERM_STOP.has(w));

// Catégories épiceries.ca non alimentaires (jamais un ingrédient de recette)
const NON_FOOD = new Set([43, 65, 66, 67, 68, 69, 70, 71]);

// Mots trop généraux pour chercher un produit à eux seuls.
const GENERIC = new Set(["epice", "epices", "herbe", "aromatique", "aromatiques", "assaisonnement", "condiment", "melange", "produit", "aliment", "legume", "fruit", "viande"]);

/** Forme commune d'un nom d'ingrédient : « Œufs », « oeufs » et « oeuf » → « oeuf ». */
export const ingredientKey = (name: string) => normalize(name).split(" ").map(stem).join(" ");

/** Ingrédients qui ne s'achètent pas (eau du robinet, glaçons) : ni cherchés ni comptés. */
export const isFree = (name: string) => /^(eau|glaçons?)( froide| chaude| tiède| bouillante| du robinet)?$/i.test(name.trim());

/** Le nom du produit contient-il tous les mots significatifs du terme recherché, au singulier ou au pluriel ? */
export function matches(productName: string, term: string): boolean {
  const tokens = normalize(productName).split(" ").map(stem);
  const words = termWords(term);
  return words.length > 0 && words.every((w) => tokens.some((tok) => sameWord(tok, w)));
}

export interface StoreMatch {
  store: string;
  productId: string;
  productName: string;
  sizeQty: number;
  sizeUnit: Unit;
  price: number;
  discounted: boolean;
  // Tirés de l'historique des prix (analyzeHistory) quand le produit est annoncé en rabais
  regularPrice?: number | null; // vrai prix régulier (null : inconnu)
  lowPrice?: number | null; // plus bas prix des 12 derniers mois
  deal?: Deal | null;
}

// Mots qui trahissent un produit transformé (croustilles à l'avocat, muffins aux bleuets…).
const PREPARED = new Set(("croustille chip biscuit muffin gaufrette smoothie tartinade croissant enchilada sauce soupe barre cereale " +
  "yogourt yaourt boisson ju saveur arome aromatise friandise chocolat bonbon combo collation melange trempette vinaigrette " +
  "glace gateau tarte blintze spray pret repa poudre bouillon assaisonnement capsule dosette gelee confiture sirop " +
  "pate pain craquelin galette pizza burrito sandwich salade paque pane panee alimentaire nutritionnelle").split(" "));

/** Pertinence d'un produit pour un terme : nom qui commence par l'ingrédient, peu de mots, aucun mot de produit transformé. */
export function relevance(productName: string, term: string): number {
  if (!matches(productName, term)) return -Infinity;
  const tokens = normalize(productName).split(" ").map(stem);
  const words = termWords(term);
  const pos = tokens.findIndex((tok) => sameWord(tok, words[0]));
  const end = Math.max(...words.map((w) => tokens.findIndex((tok) => sameWord(tok, w))));
  let score = pos === 0 ? 3 : pos > 0 && pos <= 2 ? 1.5 : 0;
  // « aux bleuets », « à l'avocat », « de fromage » : l'ingrédient n'est qu'une saveur
  if (pos > 0 && ["aux", "au", "a", "l", "de", "d"].includes(tokens[pos - 1])) score -= 3;
  // « lait de poule », « farine de noix de coco » : un autre produit que celui cherché
  if (["de", "d", "du"].includes(tokens[end + 1] ?? "")) score -= 3;
  // « chèvre à la mangue », « poulet avec sauce » : produit aromatisé ou préparé
  if (tokens.slice(end + 1).some((tok) => ["aux", "au", "a", "avec"].includes(tok))) score -= 3;
  for (const w of tokens) if (PREPARED.has(w) && !words.includes(w)) score -= 4;
  score -= 0.15 * Math.max(0, tokens.length - words.length);
  return score;
}

/**
 * Trouve, pour chaque épicerie, le produit pertinent le moins cher à l'unité.
 * La pertinence passe d'abord (catégories choisies par l'IA, nom du produit), le prix ensuite.
 * Coût : 1 recherche par terme et par catégorie + 1 appel « product » par produit retenu.
 */
export async function matchIngredient(terms: string[], categories: number[] = [], maxProductCalls = 10): Promise<StoreMatch[]> {
  const cats = categories.filter((c) => Number.isInteger(c) && c > 0).slice(0, 2);
  const candidates = new Map<string, { p: EpProduct; score: number }>();
  const search = async (term: string, cat?: number) => {
    for (const p of await searchProducts(term, 20, cat)) {
      if (NON_FOOD.has(Number((p as any).category))) continue; // soins, ménager, animaux, bébés, alcool
      const score = relevance(`${p.name} ${p.brand ?? ""}`, term);
      if (score > -3 && (!candidates.has(p.id) || candidates.get(p.id)!.score < score)) candidates.set(p.id, { p, score });
    }
  };
  // Termes trop vagues (« épices », « assaisonnement ») : ils trouveraient n'importe quel produit
  const vague = (t: string) => termWords(t).every((w) => GENERIC.has(w));
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t && !vague(t)))];
  // Les 3 premiers termes proposés, plus le nom de l'ingrédient (dernier élément), toujours essayé
  const list = clean.length > 4 ? [...clean.slice(0, 3), clean[clean.length - 1]] : clean;
  if (!list.length) return [];
  for (const term of list) {
    for (const cat of cats.length ? cats : [undefined]) await search(term, cat);
    if (candidates.size >= 6) break;
  }
  // Rien dans les catégories choisies : dernier essai sans catégorie (pertinence toujours exigée)
  if (!candidates.size && cats.length) await search(list[list.length - 1]);
  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length) return [];
  const top = ranked[0].score;
  // Tous les formats pertinents trouvés, par bannière
  const found = new Map<string, Map<string, StoreMatch>>();
  let unit: Unit | null = null;
  let calls = 0;
  for (const { p, score } of ranked.filter((c) => c.score >= top - 3)) {
    // Les 6 bannières sont couvertes, ou assez d'appels : on arrête (les moins pertinents ne servent qu'à compléter)
    if (calls >= maxProductCalls || found.size >= 6) break;
    if (score < top - 2 && calls >= 4) break;
    calls++;
    const detail = await getProduct(p.id);
    for (const sp of detail.prices ?? []) {
      const size = effectiveSize(sp.size ?? detail.size, sp.price, sp.unitPrice ?? (sp.store === detail.store ? detail.unitPrice : null))
        ?? sizeFromName(detail.name);
      if (!size || !(sp.price > 0)) continue;
      unit ??= size.unit; // même unité pour toutes les épiceries (celle du produit le plus pertinent)
      if (size.unit !== unit) continue;
      const forStore = found.get(sp.store) ?? new Map<string, StoreMatch>();
      forStore.set(detail.id, {
        store: sp.store,
        productId: detail.id,
        productName: [detail.brand, detail.name, detail.size].filter(Boolean).join(" "),
        sizeQty: size.qty,
        sizeUnit: size.unit,
        price: sp.price,
        discounted: !!sp.discounted,
      });
      found.set(sp.store, forStore);
    }
  }
  // Par bannière, jusqu'à 3 formats : le moins cher à l'unité, le moins cher à l'achat, et un format intermédiaire.
  // Le calcul du menu choisit ensuite celui qui coûte le moins pour la quantité réelle.
  const out: StoreMatch[] = [];
  for (const options of found.values()) {
    const list = [...options.values()];
    const byUnit = [...list].sort((a, b) => a.price / a.sizeQty - b.price / b.sizeQty);
    const byPrice = [...list].sort((a, b) => a.price - b.price);
    const keep = new Map<string, StoreMatch>();
    for (const m of [byUnit[0], byPrice[0], byUnit[Math.floor(byUnit.length / 2)]]) if (m) keep.set(m.productId, m);
    out.push(...keep.values());
  }
  return out;
}
