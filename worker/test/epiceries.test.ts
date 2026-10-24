import assert from "node:assert/strict";
import { effectiveSize, matches, parseSize, relevance, sizeFromName } from "../src/epiceries";

assert.deepEqual(parseSize("2 L"), { qty: 2000, unit: "ml" });
assert.deepEqual(parseSize("900 g"), { qty: 900, unit: "g" });
assert.deepEqual(parseSize("1,36 kg"), { qty: 1360, unit: "g" });
assert.deepEqual(parseSize("12 x 355 ml"), { qty: 4260, unit: "ml" });
assert.deepEqual(parseSize("1 dz"), { qty: 12, unit: "unite" });
assert.deepEqual(parseSize("3 lb"), { qty: 1361, unit: "g" });
assert.equal(parseSize("format familial"), null);
assert.ok(matches("Oignons jaunes, sac de 3 lb", "oignon jaune"));
assert.ok(matches("Poitrines de poulet désossées", "poitrine poulet"));
assert.ok(!matches("Bouillon de poulet", "poitrine de poulet"));
// Singulier et pluriel (l'IA propose souvent « oignons jaunes »)
assert.ok(matches("Oignon jaune", "oignons jaunes"));
assert.ok(matches("Oignon jaunes mon marché fraîcheur sac de", "oignon jaune"));
// Format déduit du prix unitaire (réponses réelles d'épiceries.ca, octobre 2026)
assert.deepEqual(effectiveSize("78g", 2.99), { qty: 78, unit: "g" });
assert.deepEqual(effectiveSize(null, 3.97, { value: 5.09, unit: "100 g", raw: "5.09/100g" }), { qty: 78, unit: "g" });
assert.deepEqual(effectiveSize(null, 1.23, { value: 0.22, unit: "100 g", raw: "0.44/100g" }), { qty: 280, unit: "g" });
assert.deepEqual(effectiveSize(null, 4.99, { value: 0.25, unit: "100 ml" }), { qty: 1996, unit: "ml" });
assert.deepEqual(effectiveSize(null, 3, { value: 0.5, unit: "unité", raw: "0.50/unité" }), { qty: 6, unit: "unite" });
assert.equal(effectiveSize(null, 3, null), null);
assert.equal(effectiveSize(null, 3, { value: null, unit: "100 g" }), null);
// Pertinence : le vrai produit passe devant les produits transformés
assert.ok(relevance("Bleuets sauvages, 12oz", "bleuets") > relevance("Muffins protéinés aux bleuets", "bleuets"));
assert.ok(relevance("Avocat hass 1un", "avocat") > relevance("Croustilles de patate douce huile d'avocat", "avocat"));
assert.ok(relevance("Lovo gros oeufs blancs ultra 12", "oeufs") > relevance("Oeufs de Pâques à la crème", "oeufs"));
assert.deepEqual(sizeFromName("Lovo gros oeufs blancs ultra 12"), { qty: 12, unit: "unite" });
assert.deepEqual(sizeFromName("Oeufs frais, douzaine"), { qty: 12, unit: "unite" });
console.log("✔ parseSize, effectiveSize, matches, relevance et sizeFromName");
