// Site Gusto : sert les pages statiques, génère les pages de recettes et renvoie les anciennes adresses vers mongusto.ca.
// - www.mongusto.ca et gusto.<compte>.workers.dev → https://mongusto.ca (redirection permanente, chemin conservé)
// - /recettes, /recettes/<cuisine>, /recettes/<recette> : pages HTML rendues à partir de l'API (liaison de service « API »)
// - /sitemap.xml : plan statique + toutes les recettes
const HOME = "mongusto.ca";
const SITE = `https://${HOME}`;
const PAGE_TTL = 3600; // pages de recettes gardées 1 h dans le cache de Cloudflare
const CACHE_VERSION = "2"; // à augmenter pour vider le cache des pages de recettes après un changement de mise en page

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.hostname !== HOME && !local) {
      url.hostname = HOME;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "GET" && (path === "/recettes" || path.startsWith("/recettes/") || path === "/sitemap.xml")) {
      return cachedPage(req, ctx, () => route(path, req, env));
    }
    return env.ASSETS.fetch(req);
  },
};

async function cachedPage(req, ctx, make) {
  const cache = caches.default;
  // Clé à part (version incluse) : ne jamais reprendre une réponse statique gardée à la même adresse
  const u = new URL(req.url);
  u.searchParams.set("__gusto", CACHE_VERSION);
  const key = new Request(u.toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await make();
  if (res.status === 200) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function api(env, path) {
  const res = await env.API.fetch(new Request(`https://api.mongusto.ca${path}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function route(path, req, env) {
  try {
    if (path === "/sitemap.xml") return await sitemap(req, env);
    const list = await api(env, "/api/recipes");
    if (path === "/recettes") return html(indexPage(list));
    const slug = decodeURIComponent(path.slice("/recettes/".length));
    const cuisine = list.cuisines.find((c) => c.id === slug);
    if (cuisine) return html(cuisinePage(list, cuisine));
    const recipe = await api(env, `/api/recipes/${encodeURIComponent(slug)}`);
    if (recipe) return html(recipePage(recipe));
    return notFound(req, env);
  } catch (e) {
    console.error(e);
    return new Response("Erreur temporaire. Réessaie dans un instant.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function notFound(req, env) {
  const page = await env.ASSETS.fetch(new Request(new URL("/404", req.url)));
  return new Response(page.body, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const html = (body) =>
  new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": `public, max-age=${PAGE_TTL}` } });

// ---------- Plan du site ----------

async function sitemap(req, env) {
  const base = await (await env.ASSETS.fetch(new Request(new URL("/sitemap.xml", req.url)))).text();
  const list = await api(env, "/api/recipes");
  const day = new Date().toISOString().slice(0, 10);
  const urls = ["/recettes", ...list.cuisines.filter((c) => c.count).map((c) => `/recettes/${c.id}`), ...list.recipes.map((r) => `/recettes/${r.id}`)]
    .map((p) => `  <url><loc>${SITE}${esc(p)}</loc><lastmod>${day}</lastmod></url>`)
    .join("\n");
  return new Response(base.replace("</urlset>", `${urls}\n</urlset>`), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": `public, max-age=${PAGE_TTL}` },
  });
}

// ---------- Mise en forme ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => (Number.isFinite(n) ? `${n.toFixed(2).replace(".", ",")} $` : "—");
// « recettes québécoises », « recettes d’Amérique centrale »
const ofCuisine = (id, label) => (id === "mexicaine" ? `d’${label}` : `${label.toLowerCase()}s`);
const LOGOS = { maxi: "maxi.svg", superc: "superc.png", iga: "iga.svg", metro: "metro.svg", provigo: "provigo.svg", walmart: "walmart.svg" };

const LOGO = `<img src="/favicon.svg" width="34" height="34" alt="">`;

const CSS = `
:root{--bg:#fff;--alt:#F3F4FF;--ink:#0E1030;--muted:#585D82;--line:#E2E4F4;--edge:#0E1030;--primary:#2B44FF;--pink:#FF5FA2;--tag:#FFE14D;--card:#fff;--shadow:4px 4px 0 var(--edge)}
@media (prefers-color-scheme:dark){:root{--bg:#0B0D26;--alt:#14173A;--ink:#F4F5FF;--muted:#A8ADD6;--line:#262A55;--edge:#000;--card:#14173A}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "Plus Jakarta Sans",system-ui,sans-serif}
a{color:inherit}img{max-width:100%;display:block}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
header.top{border-bottom:2px solid var(--edge);background:var(--bg);position:sticky;top:0;z-index:5}
header.top .wrap{display:flex;align-items:center;gap:20px;height:68px}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none;font-weight:800;font-size:24px;letter-spacing:-.5px}
nav.links{display:flex;gap:22px;margin-left:auto;font-weight:600;font-size:15px}
nav.links a{text-decoration:none}nav.links a:hover{color:var(--primary)}
.btn{display:inline-block;background:var(--primary);color:#fff;font-weight:700;text-decoration:none;padding:11px 20px;border:2px solid var(--edge);border-radius:999px;box-shadow:var(--shadow);transition:transform .12s,box-shadow .12s}
.btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--edge)}
.btn.pink{background:var(--pink);color:#0E1030}
@media (max-width:720px){nav.links{display:none}header.top .btn{margin-left:auto;padding:9px 14px;font-size:14px}}
.crumbs{font-size:14px;color:var(--muted);margin:22px 0 8px}.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
h1{font-size:clamp(34px,6vw,58px);line-height:1.05;letter-spacing:-1.5px;margin:6px 0 14px;font-weight:800}
h1 em,h2 em{font-family:"Instrument Serif",serif;font-weight:400;color:var(--primary)}
h2{font-size:clamp(26px,4vw,34px);letter-spacing:-.8px;margin:44px 0 16px;line-height:1.15}
.lead{font-size:19px;color:var(--muted);max-width:720px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.tag{border:2px solid var(--edge);border-radius:999px;padding:3px 12px;font-size:14px;font-weight:600;background:var(--card)}
.tag.y{background:var(--tag);color:#0E1030}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:start}
@media (max-width:860px){.hero{grid-template-columns:1fr}}
.photo{border:2px solid var(--edge);border-radius:22px;overflow:hidden;box-shadow:8px 8px 0 var(--edge);aspect-ratio:4/3;background:var(--alt)}
.photo img{width:100%;height:100%;object-fit:cover}
.noimg{display:grid;place-items:center;height:100%;font-size:64px}
.box{border:2px solid var(--edge);border-radius:20px;background:var(--card);box-shadow:var(--shadow);padding:22px}
.prices{list-style:none;margin:0;padding:0}
.prices li{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}
.prices li:last-child{border:0}
.prices img{width:64px;height:26px;object-fit:contain;background:#fff;border-radius:6px;padding:2px 4px}
.prices .p{margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums}
.prices .best .p{background:var(--tag);color:#0E1030;border:2px solid var(--edge);border-radius:8px;padding:0 8px}
.est{font-size:12px;color:var(--muted);font-weight:500}
.note{font-size:14px;color:var(--muted);margin-top:10px}
.cols{display:grid;grid-template-columns:.8fr 1.2fr;gap:36px}
@media (max-width:860px){.cols{grid-template-columns:1fr}}
ul.ing{padding-left:20px}ul.ing li{margin:6px 0}
ol.steps{counter-reset:s;list-style:none;padding:0}
ol.steps li{counter-increment:s;position:relative;padding:0 0 18px 52px}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:-2px;width:36px;height:36px;border:2px solid var(--edge);border-radius:50%;background:var(--tag);color:#0E1030;display:grid;place-items:center;font-weight:800}
.cta{margin:48px 0;background:var(--primary);color:#fff;border:2px solid var(--edge);border-radius:24px;box-shadow:8px 8px 0 var(--edge);padding:30px;display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}
.cta h2{margin:0;color:#fff}.cta h2 em{color:var(--tag)}.cta p{margin:6px 0 0;color:#DDE2FF}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}
.card{border:2px solid var(--edge);border-radius:18px;overflow:hidden;background:var(--card);text-decoration:none;box-shadow:var(--shadow);transition:transform .12s,box-shadow .12s;display:flex;flex-direction:column}
.card:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--edge)}
.card .im{aspect-ratio:4/3;background:var(--alt);border-bottom:2px solid var(--edge)}
.card .im img{width:100%;height:100%;object-fit:cover}
.card .tx{padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
.card b{font-size:16px;line-height:1.3}.card small{color:var(--muted);font-size:13px}
.card .pr{margin-top:auto;font-size:14px;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 8px}
.chips a{border:2px solid var(--edge);border-radius:999px;padding:6px 14px;text-decoration:none;font-weight:600;font-size:15px;background:var(--card)}
.chips a:hover,.chips a.on{background:var(--tag);color:#0E1030}
.more{display:inline-block;margin-top:16px;font-weight:700;color:var(--primary)}
footer.bottom{border-top:2px solid var(--edge);margin-top:70px;padding:30px 0 40px;font-size:14px;color:var(--muted)}
footer.bottom nav{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:12px;font-weight:600;color:var(--ink)}
footer.bottom a{text-decoration:none}
`;

function layout({ title, description, canonical, body, jsonld, image }) {
  return `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${esc(canonical)}">
<meta name="theme-color" content="#2B44FF">
<meta property="og:site_name" content="Gusto">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${esc(canonical)}">
<meta property="og:image" content="${esc(image || `${SITE}/og.png`)}">
<meta name="google-adsense-account" content="ca-pub-2727710137498918">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">${LOGO}gusto</a>
  <nav class="links"><a href="/recettes">Recettes</a><a href="/#comment">Comment ça marche</a><a href="/guides">Guides</a><a href="/cuisines">Cuisines</a></nav>
  <a class="btn" href="/">Créer mon menu</a>
</div></header>
<main class="wrap">${body}</main>
<footer class="bottom"><div class="wrap">
  <nav><a href="/recettes">Recettes</a><a href="/guides">Guides</a><a href="/cuisines">Cuisines</a><a href="/a-propos">À propos</a><a href="/confidentialite">Confidentialité</a></nav>
  Prix fournis par épiceries.ca, à titre indicatif : ils peuvent varier selon la succursale. Logos des épiceries : marques de leurs propriétaires. © Gusto
</div></footer>
</body>
</html>`;
}

function card(r) {
  return `<a class="card" href="/recettes/${esc(r.id)}">
  <div class="im">${r.image ? `<img src="${esc(r.image)}" alt="${esc(r.name)}" loading="lazy" width="400" height="300">` : `<div class="noimg">🍽️</div>`}</div>
  <div class="tx"><b>${esc(r.name)}</b><small>${esc(r.cuisineLabel)} · ${esc(r.mealLabel)}</small>
  <span class="pr">${money(r.from.perPortion)} / portion chez ${esc(r.from.label)}</span></div>
</a>`;
}

const chips = (list, on) =>
  `<nav class="chips" aria-label="Cuisines">${list.cuisines
    .filter((c) => c.count)
    .map((c) => `<a href="/recettes/${c.id}"${c.id === on ? ' class="on" aria-current="page"' : ""}>${esc(c.label)} <small>(${c.count})</small></a>`)
    .join("")}</nav>`;

const cta = (title = "Planifie toute ta <em>semaine</em>") => `<section class="cta">
  <div><h2>${title}</h2><p>Gusto choisit tes repas, fait ta liste d’épicerie et respecte ton budget, au prix de ton épicerie.</p></div>
  <a class="btn pink" href="/">Créer mon menu gratuit</a>
</section>`;

function indexPage(list) {
  const total = list.recipes.length;
  const sections = list.cuisines
    .filter((c) => c.count)
    .map((c) => {
      const items = list.recipes.filter((r) => r.cuisine === c.id).slice(0, 8);
      return `<section><h2>${esc(c.label)}</h2><div class="grid">${items.map(card).join("")}</div>
<a class="more" href="/recettes/${c.id}">Voir les ${c.count} recettes ${esc(ofCuisine(c.id, c.label))} →</a></section>`;
    })
    .join("");
  return layout({
    title: "Recettes économiques et leur coût par portion · Gusto",
    description: `${total} recettes pour 4 personnes, de 16 cuisines, avec leur coût réel par portion chez Maxi, Super C, IGA, Metro, Provigo et Walmart.`,
    canonical: "/recettes",
    body: `<p class="crumbs"><a href="/">Accueil</a> › Recettes</p>
<h1>Des recettes qui <em>respectent</em> ton budget</h1>
<p class="lead">${total} recettes pour 4 personnes, de 16 cuisines. Pour chacune, le coût par portion selon ton épicerie, calculé avec les prix de la semaine.</p>
${chips(list)}${sections}${cta()}`,
  });
}

function cuisinePage(list, c) {
  const items = list.recipes.filter((r) => r.cuisine === c.id);
  const byMeal = ["dejeuner", "diner", "souper"]
    .map((m) => [m, items.filter((r) => r.meal === m)])
    .filter(([, l]) => l.length)
    .map(([, l]) => `<h2>${esc(l[0].mealLabel)}s</h2><div class="grid">${l.map(card).join("")}</div>`)
    .join("");
  const cheapest = [...items].sort((a, b) => a.from.perPortion - b.from.perPortion)[0];
  return layout({
    title: `${c.count} recettes ${ofCuisine(c.id, c.label)} économiques · Gusto`,
    description: `Recettes ${ofCuisine(c.id, c.label)} pour 4 personnes${cheapest ? `, dès ${money(cheapest.from.perPortion)} par portion` : ""}. Ingrédients, étapes et coût selon ton épicerie au Québec.`,
    canonical: `/recettes/${c.id}`,
    body: `<p class="crumbs"><a href="/">Accueil</a> › <a href="/recettes">Recettes</a> › ${esc(c.label)}</p>
<h1>Recettes <em>${esc(ofCuisine(c.id, c.label))}</em></h1>
<p class="lead">${c.count} recettes pour 4 personnes, avec leur coût par portion dans les épiceries du Québec.</p>
${chips(list, c.id)}${byMeal}${cta(`Des menus ${esc(c.id === "mexicaine" ? "d’Amérique centrale" : c.label.toLowerCase() + "s")} pour <em>toute la semaine</em>`)}`,
  });
}

function recipePage(r) {
  const best = r.costs.find((x) => !x.estimated) ?? r.costs[0];
  const anyEstimated = r.costs.some((x) => x.estimated);
  const prices = r.costs
    .map((x) => `<li${x.store === r.costs[0].store ? ' class="best"' : ""}><img src="/epiceries/${LOGOS[x.store]}" alt="${esc(x.label)}" width="64" height="26" loading="lazy"><span>${esc(x.label)}${x.estimated ? ' <span class="est">prix estimé</span>' : ""}</span><span class="p">${money(x.perPortion)}</span></li>`)
    .join("");
  const extras = [
    ...r.homemade.map((h) => `<p class="note"><b>${esc(h.name)} maison :</b> ${esc(h.ingredients.join(", "))}. ${esc(h.steps.join(" "))}</p>`),
    ...r.specialty.map((s) => `<p class="note"><b>${esc(s.name)}</b> : ${esc(s.where)}.</p>`),
  ].join("");
  const description = `${r.name} : recette ${r.cuisine === "mexicaine" ? "d’Amérique centrale" : r.cuisineLabel.toLowerCase()} pour ${r.servings} personnes, environ ${money(best.perPortion)} par portion chez ${best.label}. Ingrédients, étapes et coût dans 6 épiceries du Québec.`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: r.name,
    description,
    ...(r.image ? { image: [r.image] } : {}),
    recipeCuisine: r.cuisineLabel,
    recipeCategory: r.mealLabel,
    recipeYield: `${r.servings} portions`,
    recipeIngredient: r.ingredients,
    recipeInstructions: r.steps.map((text) => ({ "@type": "HowToStep", text })),
    nutrition: { "@type": "NutritionInformation", calories: `${Math.round(r.kcal)} calories`, proteinContent: `${Math.round(r.protein)} g` },
    ...(r.diets.length ? { keywords: r.diets.join(", ") } : {}),
    publisher: { "@type": "Organization", name: "Gusto", url: SITE },
  };
  return layout({
    title: `${r.name} : recette et coût par portion · Gusto`,
    description,
    canonical: `/recettes/${r.id}`,
    image: r.image,
    jsonld,
    body: `<p class="crumbs"><a href="/">Accueil</a> › <a href="/recettes">Recettes</a> › <a href="/recettes/${r.cuisine}">${esc(r.cuisineLabel)}</a></p>
<div class="hero">
  <div>
    <h1>${esc(r.name)}</h1>
    <div class="tags"><span class="tag y">${money(best.perPortion)} / portion</span><span class="tag">${esc(r.cuisineLabel)}</span><span class="tag">${esc(r.mealLabel)}</span><span class="tag">${r.servings} portions</span><span class="tag">${Math.round(r.kcal)} kcal</span><span class="tag">${Math.round(r.protein)} g de protéines</span>${r.diets.map((d) => `<span class="tag">${esc(d)}</span>`).join("")}</div>
    <div class="photo">${r.image ? `<img src="${esc(r.image)}" alt="${esc(r.name)}" width="800" height="600">` : `<div class="noimg">🍽️</div>`}</div>
  </div>
  <aside class="box" aria-labelledby="cout">
    <h2 id="cout" style="margin:0 0 6px;font-size:24px">Coût par portion</h2>
    <p class="note" style="margin:0 0 8px">Prix de la semaine, pour ${r.servings} portions.</p>
    <ul class="prices">${prices}</ul>
    ${anyEstimated ? `<p class="note">« Prix estimé » : un ingrédient n’est pas suivi dans cette bannière ; on utilise le prix le plus élevé relevé ailleurs, majoré de 10 %.</p>` : ""}
    <p class="note">Le coût compte la quantité utilisée. Dans un menu de la semaine, Gusto compte les emballages entiers et réutilise les restes d’une recette à l’autre.</p>
  </aside>
</div>
<div class="cols">
  <section><h2>Ingrédients</h2><ul class="ing">${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>${extras}</section>
  <section><h2>Préparation</h2><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
</div>
${cta(`Mets ce plat dans ton <em>menu de la semaine</em>`)}
${r.related.length ? `<h2>Autres recettes ${esc(ofCuisine(r.cuisine, r.cuisineLabel))}</h2><div class="grid">${r.related
      .map((x) => `<a class="card" href="/recettes/${esc(x.id)}"><div class="im">${x.image ? `<img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy" width="400" height="300">` : `<div class="noimg">🍽️</div>`}</div><div class="tx"><b>${esc(x.name)}</b></div></a>`)
      .join("")}</div>` : ""}`,
  });
}
