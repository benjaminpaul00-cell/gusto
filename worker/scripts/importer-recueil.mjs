// Envoie un recueil découpé par lire-recueil.mjs à l'API, qui met chaque recette au format de Gusto en arrière-plan.
// Usage : node scripts/importer-recueil.mjs recueil.json
import { readFileSync } from "node:fs";

const API = process.env.API_URL ?? "https://gusto-api.benjaminpaul00.workers.dev";
const token = readFileSync(new URL("../.admin-token", import.meta.url), "utf8").trim();
const recipes = JSON.parse(readFileSync(process.argv[2], "utf8"));

let received = 0, jobs = 0;
for (let i = 0; i < recipes.length; i += 100) {
  const res = await fetch(`${API}/admin/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipes: recipes.slice(i, i + 100) }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const out = await res.json();
  received += out.received; jobs += out.jobs;
}
console.log(`${received} recettes reçues sur ${recipes.length}, ${jobs} tâches en file.`);
