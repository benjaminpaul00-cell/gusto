// Section Recettes : recherche par IA (mise en cache), recettes de la communauté (modérées),
// recettes de sites externes (attribuées), étoiles sans compte et prix selon les épiceries choisies.

import type { Unit } from "../../shared/options";
import { generateJson } from "./ai";
import { hashKey, type Env } from "./db";
import { normalize } from "./epiceries";
import { putImage } from "./images";
import { priceSectionRecipe } from "./sectionPrice";

export type Source = "ia" | "communaute" | "externe";
export interface SectionIngredient { qty: number; unit: Unit; name: string; display: string }

const now = () => Date.now();
const UNITS: Unit[] = ["g", "ml", "unite"];
const newId = (title: string) => `${normalize(title).replace(/ /g, "-").slice(0, 48)}-${crypto.randomUUID().slice(0, 6)}`;

// ---------- Limites anti-abus (par IP hachée et par jour) ----------

export async function underLimit(env: Env, ip: string, scope: string, max: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = await hashKey(env, `${scope}:${ip}:${day}`);
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits (key, day, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
  ).bind(key, day).first<{ count: number }>();
  return (row?.count ?? 0) <= max;
}

// ---------- Lecture ----------

interface Row {
  id: string; source: Source; status: string; title: string; servings: number; servings_estimated: number; prep_min: number | null; cook_min: number | null;
  temperature: string | null; ingredients: string; steps: string; author: string | null; source_name: string | null;
  source_url: string | null; photo_key: string | null; photo_credit: string | null; created_at: number; source_rating: number | null; source_rating_count: number | null;
}

const photoUrl = (env: Env, key: string | null) => (key ? `${env.PUBLIC_API_URL.replace(/\/$/, "")}/img/${key}` : null);

/** Note bayésienne : une recette avec peu de votes est ramenée vers la moyenne générale. */
const PRIOR_VOTES = 5;
const bayes = (avg: number, n: number, mean: number) => (PRIOR_VOTES * mean + n * avg) / (PRIOR_VOTES + n);

async function globalMean(env: Env): Promise<number> {
  const r = await env.DB.prepare(
    `SELECT (COALESCE((SELECT SUM(stars) FROM ratings), 0) + COALESCE((SELECT SUM(source_rating * source_rating_count) FROM section_recipes WHERE source_rating IS NOT NULL), 0))
       / NULLIF(COALESCE((SELECT COUNT(*) FROM ratings), 0) + COALESCE((SELECT SUM(source_rating_count) FROM section_recipes WHERE source_rating IS NOT NULL), 0), 0) AS m`,
  ).first<{ m: number | null }>();
  return r?.m ?? 3.5;
}

/** Note affichée : votes du site source (note de départ) + votes de Gusto. */
function combined(r: Row & { n: number; avg: number | null }) {
  const sn = r.source_rating && r.source_rating_count ? r.source_rating_count : 0;
  const n = r.n + sn;
  const avg = n ? ((r.avg ?? 0) * r.n + (r.source_rating ?? 0) * sn) / n : null;
  return { avg, n, sourceCount: sn };
}

function summary(env: Env, r: Row & { n: number; avg: number | null }, mean: number) {
  const ings = JSON.parse(r.ingredients) as SectionIngredient[];
  const c = combined(r);
  return {
    id: r.id, source: r.source, title: r.title, servings: r.servings, prepMin: r.prep_min, cookMin: r.cook_min,
    author: r.author, sourceName: r.source_name, photo: photoUrl(env, r.photo_key), ingredientCount: ings.length,
    rating: { avg: c.avg ? Math.round(c.avg * 10) / 10 : null, count: c.n, sourceCount: c.sourceCount },
    score: c.n ? bayes(c.avg ?? 0, c.n, mean) : 0,
    createdAt: r.created_at,
  };
}

export async function listSection(env: Env, p: { source?: string; sort?: string; q?: string; limit?: number; offset?: number }) {
  const where = ["s.status = 'publiee'", "s.source != 'ia'"];
  const binds: unknown[] = [];
  if (p.source && ["communaute", "externe"].includes(p.source)) { where.push("s.source = ?"); binds.push(p.source); }
  const rows = await env.DB.prepare(
    `SELECT s.*, COUNT(x.stars) AS n, AVG(x.stars) AS avg FROM section_recipes s LEFT JOIN ratings x ON x.recipe_id = s.id
     WHERE ${where.join(" AND ")} GROUP BY s.id`,
  ).bind(...binds).all<Row & { n: number; avg: number | null }>();
  const mean = await globalMean(env);
  const q = normalize(p.q ?? "");
  const items = rows.results.filter((r) => !q || normalize(r.title).includes(q)).map((r) => summary(env, r, mean));
  if (p.sort === "recentes") items.sort((a, b) => b.createdAt - a.createdAt);
  else items.sort((a, b) => b.score - a.score || b.rating.count - a.rating.count || a.title.localeCompare(b.title, "fr"));
  const total = items.length;
  const offset = Math.max(0, p.offset ?? 0);
  return { total, items: items.slice(offset, offset + Math.min(60, Math.max(1, p.limit ?? 24))) };
}

export async function getSection(env: Env, id: string, voter?: string) {
  const r = await env.DB.prepare(
    `SELECT s.*, COUNT(x.stars) AS n, AVG(x.stars) AS avg FROM section_recipes s LEFT JOIN ratings x ON x.recipe_id = s.id
     WHERE s.id = ? AND s.status = 'publiee' GROUP BY s.id`,
  ).bind(id).first<Row & { n: number; avg: number | null }>();
  if (!r) return null;
  const mine = voter ? await env.DB.prepare("SELECT stars FROM ratings WHERE recipe_id = ? AND voter = ?").bind(id, voter).first<{ stars: number }>() : null;
  return {
    ...summary(env, r, await globalMean(env)),
    temperature: r.temperature, sourceUrl: r.source_url, servingsEstimated: !!r.servings_estimated,
    ingredients: JSON.parse(r.ingredients) as SectionIngredient[], steps: JSON.parse(r.steps) as string[],
    myStars: mine?.stars ?? null,
    photoCredit: r.photo_credit ? (JSON.parse(r.photo_credit) as PhotoCredit) : null,
  };
}

// ---------- Photos libres de droits (recettes externes) ----------

export interface PhotoCredit { creator: string | null; license: string; source: string; landing: string }

/** Enregistre la photo d'une recette (domaine public ou CC0 seulement) et son crédit. */
export async function setSectionPhoto(env: Env, id: string, body: any) {
  const m = String(body?.image ?? "").match(/^data:(image\/(jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, message: "Image JPEG ou WebP attendue." };
  const c = body?.credit ?? {};
  if (!["cc0", "pdm"].includes(String(c.license))) return { ok: false, message: "Seules les photos du domaine public ou CC0 sont acceptées." };
  const exists = await env.DB.prepare("SELECT 1 FROM section_recipes WHERE id = ?").bind(id).first();
  if (!exists) return { ok: false, message: "Recette introuvable." };
  const bytes = Uint8Array.from(atob(m[3]), (ch) => ch.charCodeAt(0));
  const key = `externes/${id}.${m[2] === "jpeg" ? "jpg" : "webp"}`;
  await putImage(env, key, bytes, m[1]);
  const credit: PhotoCredit = { creator: c.creator ? String(c.creator).slice(0, 120) : null, license: String(c.license), source: String(c.source ?? "").slice(0, 60), landing: String(c.landing ?? "").slice(0, 400) };
  await env.DB.prepare("UPDATE section_recipes SET photo_key = ?, photo_credit = ? WHERE id = ?").bind(key, JSON.stringify(credit), id).run();
  return { ok: true, key };
}

// ---------- Étoiles ----------

export async function rateSection(env: Env, id: string, body: any, ip: string) {
  const stars = Math.round(Number(body?.stars));
  const voter = String(body?.voter ?? "");
  if (!(stars >= 1 && stars <= 5)) return { ok: false, message: "Choisis de 1 à 5 étoiles." };
  if (!/^[a-z0-9-]{16,64}$/i.test(voter)) return { ok: false, message: "Vote impossible depuis ce navigateur." };
  const exists = await env.DB.prepare("SELECT 1 FROM section_recipes WHERE id = ? AND status = 'publiee'").bind(id).first();
  if (!exists) return { ok: false, message: "Recette introuvable." };
  if (!(await underLimit(env, ip, "vote", 60))) return { ok: false, message: "Trop de votes aujourd’hui. Réessaie demain." };
  const ipHash = await hashKey(env, `vote:${ip}`);
  // Même navigateur : le vote est remplacé. Autre navigateur, même IP : refusé (un vote par personne).
  const other = await env.DB.prepare("SELECT voter FROM ratings WHERE recipe_id = ? AND ip_hash = ?").bind(id, ipHash).first<{ voter: string }>();
  if (other && other.voter !== voter) return { ok: false, message: "Un vote a déjà été enregistré pour cette recette depuis ta connexion." };
  await env.DB.prepare(
    `INSERT INTO ratings (recipe_id, voter, ip_hash, stars, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(recipe_id, voter) DO UPDATE SET stars = excluded.stars, created_at = excluded.created_at`,
  ).bind(id, voter, ipHash, stars, now()).run();
  const row = await env.DB.prepare(
    "SELECT s.*, COUNT(x.stars) AS n, AVG(x.stars) AS avg FROM section_recipes s LEFT JOIN ratings x ON x.recipe_id = s.id WHERE s.id = ? GROUP BY s.id",
  ).bind(id).first<Row & { n: number; avg: number | null }>();
  const c = combined(row!);
  return { ok: true, rating: { avg: c.avg ? Math.round(c.avg * 10) / 10 : stars, count: c.n, sourceCount: c.sourceCount }, myStars: stars };
}

// ---------- Recherche par IA (mise en cache) ----------

const isAiRecipe = (x: any): x is { ok: boolean; reason?: string; title: string; servings: number; prep_min: number; cook_min: number; temperature: string | null; ingredients: SectionIngredient[]; steps: string[] } =>
  typeof x?.ok === "boolean" && (!x.ok || (
    typeof x.title === "string" && Array.isArray(x.ingredients) && x.ingredients.length >= 2 &&
    x.ingredients.every((i: any) => typeof i?.name === "string" && typeof i.qty === "number" && i.qty > 0 && UNITS.includes(i.unit)) &&
    Array.isArray(x.steps) && x.steps.length >= 2 && x.steps.every((s: any) => typeof s === "string")));

export async function searchRecipe(env: Env, query: string, ip: string) {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 80);
  const key = normalize(q);
  if (key.length < 3) return { ok: false, message: "Écris le nom d’un plat (au moins 3 lettres)." };
  // Recettes existantes dont le nom contient tous les mots cherchés : la mieux notée
  const qWords = key.split(" ").filter((w) => w.length > 2 && !["avec", "aux", "des", "les", "pour", "une"].includes(w));
  if (qWords.length) {
    const rows = await env.DB.prepare(
      `SELECT s.*, COUNT(x.stars) AS n, AVG(x.stars) AS avg FROM section_recipes s LEFT JOIN ratings x ON x.recipe_id = s.id
       WHERE s.status = 'publiee' AND s.source != 'ia' GROUP BY s.id`,
    ).all<Row & { n: number; avg: number | null }>();
    const stem = (w: string) => (w.length > 4 ? w.replace(/[sx]$/, "") : w);
    const hits = rows.results.filter((r) => { const t = normalize(r.title).split(" ").map(stem); return qWords.every((w) => t.includes(stem(w))); });
    if (hits.length) {
      const mean = await globalMean(env);
      hits.sort((a, b) => summary(env, b, mean).score - summary(env, a, mean).score);
      return { ok: true, id: hits[0].id, cached: true };
    }
  }
  // Déjà cherché : on renvoie la même recette
  const cached = await env.DB.prepare("SELECT id FROM section_recipes WHERE query_key = ? AND status = 'publiee'").bind(key).first<{ id: string }>();
  if (cached) return { ok: true, id: cached.id, cached: true };
  if (!(await underLimit(env, ip, "recherche-ia", 15))) return { ok: false, message: "Tu as atteint la limite de recherches pour aujourd’hui. Réessaie demain, ou explore les recettes déjà créées." };

  const prompt = `Tu es un chef québécois. Une personne cherche une recette de : « ${q} ».
Si ce n'est pas un plat ou une préparation culinaire mangeable, ou si la demande est inappropriée, réponds {"ok":false,"reason":"phrase courte en français"}.
Sinon, crée une recette ORIGINALE, écrite dans tes propres mots (ne reproduis aucune recette publiée, ne nomme aucun chef, site ni livre), pour 4 portions,
réalisable à la maison avec des ingrédients des épiceries du Québec (Maxi, IGA, Metro, Super C), en français québécois standard.
- "title" : nom du plat, majuscule initiale.
- "ingredients" : 4 à 15 ingrédients. Pour chacun : "qty" (nombre), "unit" : uniquement "g", "ml" ou "unite",
  "name" : nom générique au singulier, en minuscules, sans quantité ni préparation (ex. « oignon jaune », « poitrine de poulet », « bouillon de poulet »),
  pour une partie d'un produit (tranches de pain, branches d'herbes, feuilles), donne la quantité en "g" (ex. 4 tranches de pain → 120 g de pain),
  "display" : la ligne telle qu'écrite dans une recette (ex. « 1 oignon jaune haché », « 500 g de poitrines de poulet »).
- "steps" : 4 à 8 étapes précises (durées, températures, gestes), sans numéro au début.
- "prep_min" et "cook_min" : minutes. "temperature" : température du four (ex. « 190 °C ») ou null.
Réponds uniquement en JSON : {"ok":true,"title":"","servings":4,"prep_min":0,"cook_min":0,"temperature":null,"ingredients":[{"qty":0,"unit":"g","name":"","display":""}],"steps":[""]}`;
  let out;
  try {
    out = await generateJson(env, prompt, isAiRecipe);
  } catch (e) {
    console.error("recherche IA :", (e as Error).message);
    return { ok: false, message: "La recherche est indisponible pour l’instant. Réessaie dans quelques minutes." };
  }
  if (!out.ok) return { ok: false, message: out.reason || "Je n’ai pas trouvé de plat correspondant. Essaie un autre nom." };
  const id = newId(out.title);
  const ingredients = out.ingredients.slice(0, 20).map((i) => ({ qty: i.qty, unit: i.unit, name: i.name.toLowerCase().trim(), display: (i.display || `${i.qty} ${i.unit} ${i.name}`).trim() }));
  await env.DB.prepare(
    `INSERT INTO section_recipes (id, source, status, title, servings, prep_min, cook_min, temperature, ingredients, steps, query_key, created_at)
     VALUES (?, 'ia', 'publiee', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, capitalize(out.title), Math.max(1, Math.round(out.servings || 4)), int(out.prep_min), int(out.cook_min), out.temperature || null,
    JSON.stringify(ingredients), JSON.stringify(out.steps.slice(0, 10)), key, now()).run();
  return { ok: true, id, cached: false };
}

const capitalize = (s: string) => {
  let t = s.trim().replace(/\s+/g, " ");
  const words = t.split(" ");
  if (words.length > 1 && words.every((w) => /^[A-ZÀ-Ý]/.test(w))) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const int = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);

// ---------- Recettes de la communauté ----------

/** Unités du formulaire → unités de calcul (g, ml, unité). */
const FORM_UNITS: Record<string, { unit: Unit; factor: number; label: string }> = {
  g: { unit: "g", factor: 1, label: "g" }, kg: { unit: "g", factor: 1000, label: "kg" },
  ml: { unit: "ml", factor: 1, label: "ml" }, l: { unit: "ml", factor: 1000, label: "L" },
  cat: { unit: "ml", factor: 5, label: "c. à thé" }, cas: { unit: "ml", factor: 15, label: "c. à soupe" },
  tasse: { unit: "ml", factor: 250, label: "tasse" }, pincee: { unit: "ml", factor: 0.5, label: "pincée" },
  unite: { unit: "unite", factor: 1, label: "" },
};
export const FORM_UNIT_IDS = Object.keys(FORM_UNITS);

/** « 2 », « 1,5 », « 1/2 », « 1 1/2 » → nombre (NaN si illisible). */
function parseQty(v: unknown): number {
  const s = String(v ?? "").trim().replace(",", ".");
  const m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/) ?? s.match(/^()(\d+)\/(\d+)$/);
  if (m) return (m[1] ? Number(m[1]) : 0) + Number(m[2]) / Number(m[3]);
  return s ? Number(s) : NaN;
}

const fmtQty = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export async function submitRecipe(env: Env, body: any, ip: string) {
  if (body?.rights !== true) return { ok: false, message: "Coche la case qui confirme que tu as le droit de partager cette recette et cette photo." };
  const title = clean(body?.title, 120);
  const author = clean(body?.author, 40);
  const servings = Math.round(Number(body?.servings));
  if (title.length < 3) return { ok: false, message: "Donne un titre à ta recette." };
  if (author.length < 2) return { ok: false, message: "Choisis un pseudo (2 caractères ou plus)." };
  if (!(servings >= 1 && servings <= 24)) return { ok: false, message: "Le nombre de portions doit être entre 1 et 24." };
  const ingredients: SectionIngredient[] = [];
  for (const i of Array.isArray(body?.ingredients) ? body.ingredients.slice(0, 40) : []) {
    const name = clean(i?.name, 80).toLowerCase();
    const qty = parseQty(i?.qty);
    const u = FORM_UNITS[String(i?.unit)];
    if (!name) continue;
    if (!(qty > 0) || !u) return { ok: false, message: `Vérifie la quantité et l’unité de « ${name} ».` };
    ingredients.push({ qty: qty * u.factor, unit: u.unit, name, display: `${fmtQty(qty)}${u.label ? ` ${u.label}` : ""} ${u.label ? (/^[aeiouyéèêh]/i.test(name) ? "d’" : "de ") : ""}${name}`.replace(/ d’ /, " d’").trim() });
  }
  const steps = (Array.isArray(body?.steps) ? body.steps : []).map((s: unknown) => clean(s, 1000)).filter((s: string) => s.length >= 3).slice(0, 30);
  if (ingredients.length < 2) return { ok: false, message: "Ajoute au moins 2 ingrédients." };
  if (steps.length < 1) return { ok: false, message: "Ajoute au moins une étape." };
  if (!(await underLimit(env, ip, "partage", 5))) return { ok: false, message: "Tu as déjà partagé plusieurs recettes aujourd’hui. Réessaie demain." };

  // Photo facultative : JPEG, PNG ou WebP, 3 Mo au plus
  let photoKey: string | null = null;
  if (typeof body?.photo === "string" && body.photo) {
    const m = body.photo.match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return { ok: false, message: "La photo doit être en JPEG, PNG ou WebP." };
    const bin = atob(m[3]);
    if (bin.length > 3 * 1024 * 1024) return { ok: false, message: "La photo est trop lourde (3 Mo au plus)." };
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    photoKey = `communaute/${crypto.randomUUID()}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
    await putImage(env, photoKey, bytes, m[1]);
  }
  const id = newId(title);
  await env.DB.prepare(
    `INSERT INTO section_recipes (id, source, status, title, servings, prep_min, cook_min, temperature, ingredients, steps, author, photo_key, ip_hash, created_at)
     VALUES (?, 'communaute', 'en_attente', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, capitalize(title), servings, int(body?.prepMin), int(body?.cookMin), JSON.stringify(ingredients), JSON.stringify(steps),
    author, photoKey, await hashKey(env, `partage:${ip}`), now()).run();
  return { ok: true, id };
}

// ---------- Recettes externes (importées par l'administrateur) ----------

/** Identifiant stable : titre + numéro de la recette sur le site source (sinon un court hachage du lien). */
function externalId(title: string, url: string) {
  const num = url.match(/\/(\d+)\//)?.[1] ?? [...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  return `ext-${normalize(title).replace(/ /g, "-").slice(0, 48)}-${num}`;
}

export async function importExternal(env: Env, list: any[]) {
  let n = 0;
  for (const r of list) {
    const title = clean(r?.title, 120), url = clean(r?.sourceUrl, 400);
    if (!title || !/^https:\/\//.test(url) || /ricardocuisine\.com/i.test(url)) continue;
    const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).filter((i: any) => i?.name && i.qty > 0 && UNITS.includes(i.unit));
    const steps = (Array.isArray(r.steps) ? r.steps : []).filter((s: any) => typeof s === "string" && s.trim());
    if (ingredients.length < 2 || steps.length < 2) continue;
    await env.DB.prepare(
      `INSERT INTO section_recipes (id, source, status, title, servings, servings_estimated, prep_min, cook_min, temperature, ingredients, steps, author, source_name, source_url, created_at, source_rating, source_rating_count)
       VALUES (?, 'externe', 'publiee', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, ingredients = excluded.ingredients, steps = excluded.steps,
         author = excluded.author, source_name = excluded.source_name, servings = excluded.servings, servings_estimated = excluded.servings_estimated,
         prep_min = excluded.prep_min, cook_min = excluded.cook_min, temperature = excluded.temperature,
         source_rating = excluded.source_rating, source_rating_count = excluded.source_rating_count`,
    ).bind(externalId(title, url), title, Math.max(1, Math.round(r.servings || 4)), r.servingsEstimated ? 1 : 0, int(r.prepMin), int(r.cookMin),
      r.temperature || null, JSON.stringify(ingredients), JSON.stringify(steps), clean(r.author, 80) || null, clean(r.sourceName, 80), url,
      now() - n * 1000, Number(r.rating) > 0 ? Number(r.rating) : null, Math.max(0, Math.round(Number(r.ratingCount) || 0))).run();
    n++;
  }
  return { imported: n };
}

// ---------- Modération ----------

export async function moderationPage(env: Env, token: string): Promise<string> {
  const rows = await env.DB.prepare("SELECT * FROM section_recipes WHERE source = 'communaute' AND status = 'en_attente' ORDER BY created_at")
    .all<Row>();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const cards = rows.results.map((r) => {
    const ings = (JSON.parse(r.ingredients) as SectionIngredient[]).map((i) => `<li>${esc(i.display)}</li>`).join("");
    const steps = (JSON.parse(r.steps) as string[]).map((s) => `<li>${esc(s)}</li>`).join("");
    return `<article><h2>${esc(r.title)}</h2><p class="meta">par <b>${esc(r.author ?? "")}</b> · ${r.servings} portions · reçue le ${new Date(r.created_at).toLocaleString("fr-CA")}</p>
${r.photo_key ? `<img src="/img/${esc(r.photo_key)}" alt="">` : "<p class='meta'>Sans photo</p>"}
<div class="cols"><div><h3>Ingrédients</h3><ul>${ings}</ul></div><div><h3>Étapes</h3><ol>${steps}</ol></div></div>
<form method="post" action="/admin/moderation/${esc(r.id)}/publier?token=${esc(token)}"><button class="ok">Publier</button></form>
<form method="post" action="/admin/moderation/${esc(r.id)}/refuser?token=${esc(token)}"><button class="no">Refuser</button></form></article>`;
  }).join("");
  return `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Modération · Gusto</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#F3F4FF;color:#0E1030}h1{margin:0 0 6px}article{background:#fff;border:2px solid #0E1030;border-radius:16px;padding:20px;margin:18px 0;box-shadow:4px 4px 0 #0E1030}
.meta{color:#585D82;font-size:14px}img{max-width:320px;border-radius:12px;border:2px solid #0E1030}.cols{display:grid;grid-template-columns:1fr 2fr;gap:20px}@media(max-width:700px){.cols{grid-template-columns:1fr}}
form{display:inline-block;margin-right:10px}button{font:700 15px system-ui;padding:10px 18px;border-radius:999px;border:2px solid #0E1030;cursor:pointer}.ok{background:#2B44FF;color:#fff}.no{background:#FF5FA2}</style></head>
<body><h1>Recettes à modérer</h1><p class="meta">${rows.results.length} en attente. Vérifie le contenu, la photo et le titre avant de publier.</p>${cards || "<p>Aucune recette en attente.</p>"}</body></html>`;
}

export async function moderate(env: Env, id: string, action: "publier" | "refuser") {
  await env.DB.prepare("UPDATE section_recipes SET status = ? WHERE id = ? AND source = 'communaute'")
    .bind(action === "publier" ? "publiee" : "refusee", id).run();
}

// ---------- Prix selon les épiceries choisies (voir sectionPrice.ts) ----------

export async function priceSection(env: Env, id: string, body: any) {
  const r = await env.DB.prepare("SELECT id, servings, ingredients FROM section_recipes WHERE id = ? AND status = 'publiee'").bind(id).first<{ id: string; servings: number; ingredients: string }>();
  return r ? priceSectionRecipe(env, r, body) : null;
}
