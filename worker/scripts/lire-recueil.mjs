// Découpe le texte d'un recueil de recettes (pdftotext -enc UTF-8) en recettes brutes, au format JSON.
// Usage : node scripts/lire-recueil.mjs recueil.txt sortie.json
import { readFileSync, writeFileSync } from "node:fs";

const [, , src, dest] = process.argv;
const CUISINE = {
  "québécoise": "quebecoise", "haïtienne": "haitienne", "chinoise": "chinoise", "vietnamienne": "vietnamienne",
  "grecque": "grecque", "libanaise": "libanaise", "italienne": "italienne", "amérique centrale et mexique": "mexicaine",
  "amérique centrale": "mexicaine", "mexicaine": "mexicaine", "indienne": "indienne", "marocaine": "marocaine",
  "thaïlandaise": "thailandaise", "portugaise": "portugaise", "vénézuélienne": "venezuelienne",
  "colombienne": "colombienne", "péruvienne": "peruvienne", "dominicaine": "dominicaine",
  // Pays d'Amérique centrale : regroupés sous « Amérique centrale »
  "bélizienne": "mexicaine", "costaricienne": "mexicaine", "guatémaltèque": "mexicaine", "hondurienne": "mexicaine",
  "nicaraguayenne": "mexicaine", "panaméenne": "mexicaine", "salvadorienne": "mexicaine",
};
const MEAL = { "déjeuner": "dejeuner", "dîner": "diner", "souper": "souper" };

// Lignes de mise en page à ignorer (en-têtes, pieds de page, numéros de page)
const noise = (l) =>
  /^BENJAMIN • RECUEIL/.test(l) || /^500 RECETTES \/ CUISINES DU MONDE/.test(l) || /^\d{1,3}$/.test(l) ||
  /^[A-ZÀ-ÖØ-Ý' ]{4,}$/.test(l) && !/^(INGRÉDIENTS|ÉTAPES)$/.test(l);
const lines = readFileSync(src, "utf8").replace(/\f/g, "\n").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !noise(l));

const recipes = [];
for (let i = 0; i < lines.length; i++) {
  const head = lines[i].match(/^(\d{3}) (.+)$/);
  const meta = lines[i + 1]?.match(/^Cuisine : (.+?) • Repas : (.+?) • (\d+) portions?(?: • (.+))?$/);
  if (!head || !meta) continue;
  const r = {
    no: Number(head[1]), name: head[2].trim(),
    cuisine: CUISINE[meta[1].toLowerCase()], meal: MEAL[meta[2].toLowerCase()], servings: Number(meta[3]),
    ingredients: [], steps: "",
  };
  if (!r.cuisine || !r.meal) throw new Error(`Cuisine ou repas inconnu : ${lines[i + 1]}`);
  let j = i + 2, part = "";
  for (; j < lines.length; j++) {
    const l = lines[j];
    if (/^\d{3} .+$/.test(l) && /^Cuisine : /.test(lines[j + 1] ?? "")) break; // recette suivante
    if (l === "INGRÉDIENTS") { part = "ing"; continue; }
    if (l === "ÉTAPES") { part = "steps"; continue; }
    if (/^D’après |^D'après /.test(l)) { part = "credit"; continue; } // attribution : retirée
    if (part === "ing") r.ingredients.push(...l.split("•").map((s) => s.trim()).filter(Boolean));
    else if (part === "steps") r.steps += (r.steps ? " " : "") + l;
  }
  i = j - 1;
  recipes.push(r);
}

const nums = new Set(recipes.map((r) => r.no));
const missing = [];
for (let n = 1; n <= 500; n++) if (!nums.has(n)) missing.push(n);
const thin = recipes.filter((r) => r.ingredients.length < 4 || r.steps.length < 60).map((r) => r.no);
writeFileSync(dest, JSON.stringify(recipes, null, 1));
console.log(`${recipes.length} recettes ; manquantes : ${missing.join(", ") || "aucune"} ; incomplètes : ${thin.join(", ") || "aucune"}`);
