// Prix d'un ingrédient saisi à la main, par épicerie.
// 1) Ingrédient déjà suivi (prix de la semaine en base) : réponse immédiate.
// 2) Sinon : recherche en direct sur épiceries.ca (produits nature, pertinence d'abord), puis l'ingrédient est suivi.

import { STORES, type Unit } from "../../shared/options";
import type { Env } from "./db";
import { isFree, matchIngredient, normalize, withHistory } from "./epiceries";
import { ensureIngredient, savePrices } from "./jobs";
import { SYNONYMS, matchKnown, words, type Known } from "./sectionPrice";

interface Row { ingredient: string; store: string; product_name: string; size_qty: number; size_unit: Unit; price: number; regular_price: number; discounted: number; deal: string | null; updated_at: number }

export interface Offer {
  store: string; label: string; product: string; size: string; price: number;
  unitPrice: number; unitLabel: string; discounted: boolean; updatedAt: number;
  regularPrice: number | null; // vrai prix régulier, quand le rabais est réel
  deal: "vrai" | "plancher" | "faux" | null;
}

const label = (id: string) => STORES.find((s) => s.id === id)?.label ?? id;
const sizeText = (q: number, u: Unit) =>
  u === "g" ? (q >= 1000 ? `${+(q / 1000).toFixed(2)} kg` : `${Math.round(q)} g`) : u === "ml" ? (q >= 1000 ? `${+(q / 1000).toFixed(2)} L` : `${Math.round(q)} ml`) : `${q} unité${q > 1 ? "s" : ""}`;
// Prix au kilo, au litre ou à l'unité, pour comparer des formats différents
const perUnit = (r: Row) => (r.size_unit === "unite" ? r.price / r.size_qty : (r.price / r.size_qty) * 1000);
const unitLabel = (u: Unit) => (u === "g" ? "/kg" : u === "ml" ? "/L" : "/unité");

/** Meilleure offre par épicerie (la moins chère au kilo, au litre ou à l'unité), triées du moins cher au plus cher. */
function offers(rows: Row[]): Offer[] {
  const best = new Map<string, Row>();
  for (const r of rows) {
    if (!STORES.some((s) => s.id === r.store) || !(r.price > 0) || !(r.size_qty > 0)) continue;
    const cur = best.get(r.store);
    if (!cur || perUnit(r) < perUnit(cur)) best.set(r.store, r);
  }
  return [...best.values()]
    .map((r) => ({
      store: r.store, label: label(r.store), product: r.product_name, size: sizeText(r.size_qty, r.size_unit), price: r.price,
      unitPrice: Math.round(perUnit(r) * 100) / 100, unitLabel: unitLabel(r.size_unit), discounted: !!r.discounted, updatedAt: r.updated_at,
      regularPrice: r.discounted && r.regular_price > r.price + 0.004 ? r.regular_price : null,
      deal: r.deal === "vrai" || r.deal === "plancher" || r.deal === "faux" ? (r.deal as Offer["deal"]) : null,
    }))
    .sort((a, b) => a.unitPrice - b.unitPrice);
}

async function tracked(env: Env, q: string): Promise<string | null> {
  const names = (await env.DB.prepare("SELECT ingredient, COUNT(*) AS n FROM store_products GROUP BY ingredient").all<{ ingredient: string; n: number }>()).results;
  const known: Known[] = names.map((x) => ({ name: x.ingredient, w: words(x.ingredient), n: x.n }));
  const n = normalize(q);
  const exact = names.find((x) => normalize(x.ingredient) === n);
  if (exact) return exact.ingredient;
  const direct = matchKnown(q, known);
  if (direct) return direct;
  for (const [re, targets] of SYNONYMS) if (re.test(n)) for (const t of targets) { const m = matchKnown(t, known); if (m) return m; }
  return null;
}

const rowsFor = async (env: Env, ingredient: string) =>
  (await env.DB.prepare("SELECT * FROM store_products WHERE ingredient = ?").bind(ingredient).all<Row>()).results;

export async function lookupIngredientPrice(env: Env, raw: string, canSearchLive: () => Promise<boolean>) {
  const q = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (q.length < 2) return { ok: false, message: "Écris le nom d’un ingrédient (au moins 2 lettres)." };
  if (isFree(q)) return { ok: true, query: q, ingredient: q, offers: [], message: "Cet ingrédient ne s’achète pas." };

  const name = await tracked(env, q);
  if (name) {
    const list = offers(await rowsFor(env, name));
    if (list.length) return { ok: true, query: q, ingredient: name, offers: list };
  }

  // Nouveau : recherche en direct (limitée par jour), puis on le suit pour les prochaines fois
  if (!(await canSearchLive())) return { ok: false, message: "Limite de recherches atteinte pour aujourd’hui. Réessaie demain." };
  const key = q.toLowerCase();
  try {
    const matches = await withHistory(await matchIngredient([key]));
    if (matches.length) {
      await ensureIngredient(env, key); // suivi : rayon, termes de recherche et prix rafraîchis chaque semaine
      await savePrices(env, key, matches);
      return { ok: true, query: q, ingredient: key, offers: offers(await rowsFor(env, key)) };
    }
  } catch {
    /* épiceries.ca injoignable : l'ingrédient sera ajouté plus tard */
  }
  return { ok: true, query: q, ingredient: null, offers: [], message: "Aucun prix trouvé pour cet ingrédient. Vérifie l’orthographe ou essaie un nom plus courant (ex. « fromage cheddar »)." };
}
