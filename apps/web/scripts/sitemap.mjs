// Après « expo export » : écrit dist/sitemap.xml et dist/robots.txt pour Google.
// Adresse du site : variable EXPO_PUBLIC_SITE_URL (fichier .env), par défaut https://mongusto.ca.
import { copyFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
try { process.loadEnvFile(".env"); } catch { /* pas de fichier .env : variables du système */ }
const site = (process.env.EXPO_PUBLIC_SITE_URL || "https://mongusto.ca").replace(/\/$/, "");
const SKIP = new Set(["menu", "_sitemap", "+not-found"]); // pages personnelles ou techniques

// Page de débogage d'Expo Router : inutile en production.
rmSync(join(dist, "_sitemap.html"), { force: true });
// Cloudflare Pages sert 404.html pour les adresses inconnues (sinon il renverrait l'accueil).
copyFileSync(join(dist, "+not-found.html"), join(dist, "404.html"));
SKIP.add("404");

const pages = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "_expo" && f !== "assets") walk(p); continue; }
    if (!f.endsWith(".html")) continue;
    // Gabarits des routes dynamiques ([id].html, [slug].html) : pas de vraies pages.
    if (f.startsWith("[")) { rmSync(p); continue; }
    const route = relative(dist, p).replace(/\\/g, "/").replace(/\.html$/, "").replace(/(^|\/)index$/, "");
    if (!SKIP.has(route)) pages.push(route);
  }
})(dist);

pages.sort();
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((r) => `  <url><loc>${site}/${r}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(dist, "sitemap.xml"), xml);
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nDisallow: /menu\nSitemap: ${site}/sitemap.xml\n`);
console.log(`sitemap.xml : ${pages.length} pages (${site})`);
