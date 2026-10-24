import { CUISINES, DIETS, MEALS, STORES, STYLES, type PlanRequest } from "../../shared/options";
import { checkRateLimit, enqueue, loadPlannerData, type Env } from "./db";
import { getImage } from "./images";
import { cleanup, runJobs, savePrices, seed, type BookRecipe } from "./jobs";
import type { StoreMatch } from "./epiceries";
import { planMenu } from "./planner";
import { imagePrompt, mistralImage } from "./ai";

const json = (env: Env, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env), ...extra },
  });

const cors = (env: Env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

function sanitize(body: any): PlanRequest {
  const pick = <T extends string>(list: readonly { id: T }[], vals: unknown): T[] =>
    Array.isArray(vals) ? [...new Set(vals.filter((v): v is T => list.some((x) => x.id === v)))] : [];
  return {
    store: STORES.some((s) => s.id === body?.store) ? body.store : (undefined as never),
    meals: pick(MEALS, body?.meals),
    weeks: Math.round(Number(body?.weeks)),
    people: Math.round(Number(body?.people)),
    cuisines: pick(CUISINES, body?.cuisines),
    styles: pick(STYLES, body?.styles),
    diets: pick(DIETS, body?.diets),
    budget: Math.round(Number(body?.budget) * 100) / 100,
    onlyStore: !!body?.onlyStore,
  };
}

async function handlePlan(req: Request, env: Env): Promise<Response> {
  const ip = req.headers.get("CF-Connecting-IP") ?? "inconnu";
  if (!(await checkRateLimit(env, ip))) {
    return json(env, { ok: false, reason: "rate_limited", message: "Limite quotidienne atteinte. Réessayez demain." }, 429);
  }
  const request = sanitize(await req.json().catch(() => null));
  const data = await loadPlannerData(env, request.store ?? "maxi");
  const base = env.PUBLIC_API_URL.replace(/\/$/, "");
  const result = planMenu(request, data, (r) => (r.image ? `${base}/img/${r.image}` : null));
  return json(env, result, result.ok ? 200 : result.reason === "invalid" ? 400 : 200);
}

async function handleImage(key: string, env: Env): Promise<Response> {
  const img = await getImage(env, key);
  if (!img) return new Response("Introuvable", { status: 404 });
  return new Response(img.body, {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable", // chaque version d'image a sa propre clé
      ...cors(env),
    },
  });
}

// ---------- Administration (protégée par ADMIN_TOKEN) ----------

function authorized(req: Request, env: Env): boolean {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("Authorization")?.replace("Bearer ", "");
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

async function adminImages(env: Env, token: string): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT id, name, cuisine, image_key, status FROM recipes ORDER BY created_at DESC LIMIT 120",
  ).all<{ id: string; name: string; cuisine: string; image_key: string | null; status: string }>();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const cards = rows.results
    .map(
      (r) => `<figure class="${r.status}">
  ${r.image_key ? `<img src="/img/${esc(r.image_key)}" loading="lazy" alt="">` : `<div class="empty">Image en attente</div>`}
  <figcaption>${esc(r.name)}<small>${esc(r.cuisine)}</small></figcaption>
  <form method="post" action="/admin/regen/${esc(r.id)}?token=${esc(token)}"><button>Regénérer l’image</button></form>
  <form method="post" action="/admin/toggle/${esc(r.id)}?token=${esc(token)}"><button>${r.status === "active" ? "Retirer la recette" : "Remettre la recette"}</button></form>
</figure>`,
    )
    .join("\n");
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gusto — images</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#f4f6f2;color:#1c2a22}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
figure{margin:0;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #d6ddd3}
figure.rejected{opacity:.4}
img,.empty{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#e3e8df}
.empty{display:grid;place-items:center;color:#6b7a70}
figcaption{padding:8px 10px;font-size:14px}small{display:block;color:#6b7a70}
form{margin:0 10px 8px}button{width:100%;padding:6px;border-radius:6px;border:1px solid #2e6b4f;background:#fff;color:#2e6b4f;cursor:pointer}
</style><h1>Dernières recettes</h1><div class="grid">${cards}</div></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function adminStatus(env: Env): Promise<Response> {
  const [jobs, recipes, ingredients, priced, errors] = await env.DB.batch([
    env.DB.prepare("SELECT kind, status, COUNT(*) AS n FROM jobs GROUP BY kind, status"),
    env.DB.prepare("SELECT cuisine, meal, COUNT(*) AS n, SUM(image_key IS NOT NULL) AS images FROM recipes WHERE status = 'active' GROUP BY cuisine, meal"),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM ingredients GROUP BY status"),
    env.DB.prepare("SELECT store, COUNT(*) AS n FROM store_products GROUP BY store"),
    env.DB.prepare("SELECT kind, attempts, last_error FROM jobs WHERE last_error IS NOT NULL ORDER BY id DESC LIMIT 5"),
  ]);
  return json(env, { jobs: jobs.results, recipes: recipes.results, ingredients: ingredients.results, priced: priced.results, errors: errors.results });
}

async function handleAdmin(req: Request, env: Env, path: string): Promise<Response> {
  if (!authorized(req, env)) return new Response("Non autorisé", { status: 401 });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const back = () => Response.redirect(new URL(`/admin/images?token=${encodeURIComponent(token)}`, req.url).toString(), 303);

  if (path === "/admin/images") return adminImages(env, token);
  if (path === "/admin/status") return adminStatus(env);
  // Modèles disponibles chez Groq (pour choisir GROQ_MODEL quand un modèle est retiré)
  // Essai d'une photo par Mistral : renvoie l'image ou l'erreur
  if (path === "/admin/test-image") {
    try {
      const img = await mistralImage(env, imagePrompt("poulet aux arachides", "haïtienne"));
      return new Response(img.bytes, { headers: { "Content-Type": img.type } });
    } catch (e) {
      return json(env, { error: (e as Error).message }, 502);
    }
  }
  if (path === "/admin/ai-models") {
    if (!env.GROQ_API_KEY) return json(env, { groq: null });
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` } });
    const d: any = await r.json().catch(() => ({}));
    return json(env, { status: r.status, groq: (d.data ?? []).map((m: any) => ({ id: m.id, ctx: m.context_window, active: m.active })) });
  }
  // Ingrédients dont les prix sont absents ou datent de plus de 5 jours (pour scripts/prix.mjs)
  if (path === "/admin/prices/pending") {
    const limit = Math.min(100, Number(new URL(req.url).searchParams.get("limit")) || 30);
    const rows = await env.DB.prepare(
      `SELECT name, search_terms, categories FROM ingredients WHERE status = 'resolved' AND (prices_checked_at IS NULL OR prices_checked_at < ?)
       ORDER BY prices_checked_at IS NOT NULL, prices_checked_at LIMIT ?`,
    ).bind(Date.now() - 5 * 86400_000, limit).all<{ name: string; search_terms: string | null; categories: string | null }>();
    return json(env, { items: rows.results.map((r) => ({ name: r.name, terms: JSON.parse(r.search_terms || "[]"), categories: JSON.parse(r.categories || "[]") })) });
  }
  if (req.method !== "POST") return new Response("Méthode non permise", { status: 405 });

  // Recueil de recettes (scripts/importer-recueil.mjs) : { recipes: BookRecipe[] }, mis en file par 2
  if (path === "/admin/import" && req.method === "POST") {
    const body: any = await req.json().catch(() => null);
    const cuisines = new Set(CUISINES.map((c) => c.id as string));
    const meals = new Set(MEALS.map((m) => m.id as string));
    const list: BookRecipe[] = (Array.isArray(body?.recipes) ? body.recipes : []).filter((r: any) =>
      typeof r?.name === "string" && cuisines.has(r.cuisine) && meals.has(r.meal) && Array.isArray(r.ingredients) && typeof r.steps === "string");
    let jobs = 0;
    for (let i = 0; i < list.length; i += 2) { await enqueue(env, "import_recipes", { recipes: list.slice(i, i + 2) }); jobs++; }
    return json(env, { received: list.length, jobs });
  }
  if (path === "/admin/seed") return json(env, { queued: await seed(env) });
  // Prix envoyés par scripts/prix.mjs : { items: [{ ingredient, matches: StoreMatch[] }] }
  if (path === "/admin/prices") {
    const body: any = await req.json().catch(() => null);
    const stores = new Set(STORES.map((s) => s.id as string));
    const ok = (m: any): m is StoreMatch =>
      m && stores.has(m.store) && typeof m.productId === "string" && typeof m.productName === "string" &&
      ["g", "ml", "unite"].includes(m.sizeUnit) && m.sizeQty > 0 && m.sizeQty < 100000 && m.price > 0 && m.price < 500;
    let saved = 0;
    for (const it of Array.isArray(body?.items) ? body.items.slice(0, 50) : []) {
      // (jusqu'à 3 formats par bannière : 18 produits au plus par ingrédient)
      if (typeof it?.ingredient !== "string") continue;
      const exists = await env.DB.prepare("SELECT 1 FROM ingredients WHERE name = ?").bind(it.ingredient).first();
      if (!exists) continue;
      const matches = (Array.isArray(it.matches) ? it.matches : []).filter(ok).slice(0, 18);
      await savePrices(env, it.ingredient, matches);
      saved += matches.length;
    }
    return json(env, { saved });
  }
  if (path === "/admin/run") return json(env, { done: await runJobs(env, 40, 2) }); // 2 tâches : réponse rapide
  if (path === "/admin/refresh-prices") { await enqueue(env, "refresh_prices", { offset: 0 }); return json(env, { queued: true }); }
  const regen = path.match(/^\/admin\/regen\/(.+)$/);
  if (regen) { await enqueue(env, "gen_image", { recipeId: decodeURIComponent(regen[1]) }); return back(); }
  // Regénère les photos manquantes (ex. après un changement de stockage).
  if (path === "/admin/images-backfill") {
    const rows = await env.DB.prepare("SELECT id FROM recipes WHERE image_key IS NULL AND status = 'active'").all<{ id: string }>();
    for (const r of rows.results) await enqueue(env, "gen_image", { recipeId: r.id });
    return json(env, { queued: rows.results.length });
  }
  const toggle = path.match(/^\/admin\/toggle\/(.+)$/);
  if (toggle) {
    await env.DB.prepare("UPDATE recipes SET status = CASE status WHEN 'active' THEN 'rejected' ELSE 'active' END WHERE id = ?")
      .bind(decodeURIComponent(toggle[1])).run();
    return back();
  }
  return new Response("Introuvable", { status: 404 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });

    try {
      if (path === "/api/plan" && req.method === "POST") return await handlePlan(req, env);
      if (path === "/api/health") return json(env, { ok: true });
      if (path.startsWith("/img/")) return await handleImage(decodeURIComponent(path.slice(5)), env);
      if (path.startsWith("/admin/")) return await handleAdmin(req, env, path);
      return json(env, { ok: false, message: "Introuvable" }, 404);
    } catch (e) {
      console.error(e);
      return json(env, { ok: false, reason: "invalid", message: "Erreur du serveur. Réessayez dans un instant." }, 500);
    }
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 9 * * 4") {
      // Jeudi matin : les nouvelles circulaires sont en ligne.
      ctx.waitUntil(enqueue(env, "refresh_prices", { offset: 0 }).then(() => cleanup(env)));
      return;
    }
    // Photos à part : elles ne doivent pas attendre que toutes les recettes soient écrites.
    // Photos en même temps que le reste (une partie du budget leur est réservée).
    const budget = Number(env.JOB_BUDGET) || 40;
    const parallel = Number(env.JOB_PARALLEL) || 1;
    ctx.waitUntil(Promise.all([runJobs(env, Math.min(90, Math.max(9, Math.round(budget / 5))), 30, "gen_image"), runJobs(env, budget, Infinity, undefined, parallel)]));
    // Une fois par jour (vers 4 h au Québec) : effacer les compteurs anti-abus de la veille,
    // comme l'annonce la politique de confidentialité.
    const t = new Date(event.scheduledTime);
    if (t.getUTCHours() === 8 && t.getUTCMinutes() < 10) ctx.waitUntil(cleanup(env));
  },
} satisfies ExportedHandler<Env>;
