// Analyse l'historique des prix d'épiceries.ca pour les produits annoncés en rabais :
// vrai prix régulier, plus bas prix de l'année et faux rabais. Envoie le résultat à l'API Gusto.
// Lancé depuis cet ordinateur (épiceries.ca bloque les serveurs Cloudflare), après scripts/prix.mjs.
// Usage : node scripts/historique.mjs   (jeton dans worker/.admin-token ; GUSTO_API pour une autre adresse)
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { analyzeHistory, getHistory } from "../src/epiceries.ts";

const API = process.env.GUSTO_API ?? "https://api.mongusto.ca";
const tokenFile = new URL("../.admin-token", import.meta.url);
const token = process.env.ADMIN_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "");
if (!token) throw new Error("Jeton d'administration introuvable (worker/.admin-token ou ADMIN_TOKEN).");
const LOG = new URL("../prix.log", import.meta.url);
const log = (msg) => { const line = `[${new Date().toLocaleString("fr-CA")}] historique : ${msg}`; console.log(line); try { appendFileSync(LOG, line + "\n"); } catch {} };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

let done = 0, real = 0, fake = 0, unknown = 0;
const seen = new Set();
for (let round = 0; round < 40; round++) {
  const { items } = await api("GET", "/admin/prices/discounted?limit=50");
  const fresh = items.filter((it) => !seen.has(`${it.productId}:${it.store}`));
  if (!fresh.length) break;
  const out = [];
  for (const it of fresh) {
    seen.add(`${it.productId}:${it.store}`);
    try {
      const h = analyzeHistory(await getHistory(it.productId, it.store), { price: it.price, discounted: true });
      out.push({ ...it, ...h });
      if (h.deal === "faux") fake++; else if (h.regularPrice === null) unknown++; else real++;
    } catch (e) {
      log(`${it.productId} (${it.store}) : ${e.message}`);
      if (String(e.message).includes("JSON")) throw new Error("épiceries.ca refuse cet ordinateur (captcha). Arrêt.");
    }
    await wait(400); // usage raisonnable : moins de 3 requêtes par seconde
  }
  if (out.length) await api("POST", "/admin/prices/history", { items: out });
  done += out.length;
}
log(`${done} produits analysés : ${real} vrais rabais, ${fake} faux rabais, ${unknown} sans prix régulier connu.`);
