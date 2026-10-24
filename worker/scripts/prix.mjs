// Récupère les prix d'épiceries.ca depuis cet ordinateur et les envoie à l'API Gusto.
// Pourquoi : épiceries.ca bloque (captcha) les requêtes qui viennent des serveurs Cloudflare,
// mais répond normalement à un ordinateur ordinaire.
// Usage : node scripts/prix.mjs   (lit le jeton dans worker/.admin-token)
// Lancé automatiquement chaque jour par le Planificateur de tâches de Windows (tâche « Gusto - prix »).
import { appendFileSync, readFileSync } from "node:fs";
import { isFree, matchIngredient } from "../src/epiceries.ts";

const API = process.env.GUSTO_API ?? "https://api.mongusto.ca";
const token = readFileSync(new URL("../.admin-token", import.meta.url), "utf8").trim();
const LOG = new URL("../prix.log", import.meta.url);
const MAX_ROUNDS = Number(process.env.GUSTO_MAX_ROUNDS) || 40; // 40 × 25 ingrédients au plus par exécution

const log = (msg) => {
  const line = `[${new Date().toLocaleString("fr-CA")}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch {}
};

// Usage raisonnable d'épiceries.ca : au plus ~3 requêtes par seconde.
const realFetch = globalThis.fetch;
let last = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://epiceries.ca/")) {
    const wait = Math.max(0, last + 350 - Date.now());
    if (wait) await new Promise((ok) => setTimeout(ok, wait));
    last = Date.now();
  }
  return realFetch(url, init);
};

const api = async (method, path, body) => {
  const res = await realFetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

let total = 0, found = 0;
const tried = new Set(); // ingrédients déjà essayés pendant cette exécution
try {
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const { items } = await api("GET", "/admin/prices/pending?limit=25");
    const fresh = items.filter((it) => !tried.has(it.name));
    if (!fresh.length) break;
    const batch = [];
    for (const it of fresh) {
      tried.add(it.name);
      if (isFree(it.name)) { batch.push({ ingredient: it.name, matches: [] }); continue; } // eau : rien à acheter
      let matches = [];
      try {
        matches = await matchIngredient([...it.terms, it.name], it.categories ?? []);
      } catch (e) {
        log(`  ${it.name} : ${e.message}`);
        if (String(e.message).includes("JSON")) throw new Error("épiceries.ca refuse aussi cet ordinateur (captcha). Arrêt.");
        continue; // erreur passagère : on réessaiera au prochain passage, sans effacer les prix connus
      }
      batch.push({ ingredient: it.name, matches });
      total++;
      if (matches.length) found++;
    }
    if (!batch.length) continue;
    const r = await api("POST", "/admin/prices", { items: batch });
    log(`Lot ${round} : ${batch.length} ingrédients, ${r.saved} produits enregistrés (${batch.filter((b) => b.matches.length).length} trouvés)`);
  }
  log(`Terminé : ${total} ingrédients vérifiés, ${found} avec au moins un prix.`);
} catch (e) {
  log(`Erreur : ${e.message}`);
  process.exitCode = 1;
}
