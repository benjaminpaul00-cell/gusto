// Importe les recettes externes dans la section Recettes :
// data/externes.mjs (34 recettes structurées à la main) + data/externes-plus.json (recettes ajoutées et notes de départ).
// Usage : node scripts/importer-externes.mjs            → API en ligne, jeton de worker/.admin-token
//         API_URL=http://localhost:8787 ADMIN_TOKEN=... node scripts/importer-externes.mjs   → API locale
import { existsSync, readFileSync } from "node:fs";
import { EXTERNES } from "../data/externes.mjs";

const plusFile = new URL("../data/externes-plus.json", import.meta.url);
const plus = existsSync(plusFile) ? JSON.parse(readFileSync(plusFile, "utf8")) : { notes: {}, recipes: [] };
const all = [
  ...EXTERNES.map((r) => ({ ...r, ...(plus.notes[r.sourceUrl] ?? {}) })), // note de départ du site source
  ...plus.recipes,
];

const API = process.env.API_URL ?? "https://api.mongusto.ca";
const token = process.env.ADMIN_TOKEN ?? readFileSync(new URL("../.admin-token", import.meta.url), "utf8").trim();
let imported = 0;
for (let i = 0; i < all.length; i += 40) {
  const res = await fetch(`${API}/admin/import-externes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipes: all.slice(i, i + 40) }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  imported += (await res.json()).imported;
}
console.log(`${imported} recettes importées sur ${all.length}.`);
