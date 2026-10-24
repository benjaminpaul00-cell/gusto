// Exécution : npm test (dans /worker)
import assert from "node:assert/strict";
import { planMenu, type PlannerData, type PlannerRecipe, type StoreProduct, type IngredientInfo } from "../src/planner";
import type { PlanRequest } from "../../shared/options";

const products = new Map<string, StoreProduct[]>();
const ingredients = new Map<string, IngredientInfo>();
const addProduct = (name: string, price: number, sizeQty: number, sizeUnit: "g" | "ml" | "unite", section: string, opts: Partial<IngredientInfo> = {}, regular?: number) => {
  products.set(name, [...(products.get(name) ?? []), { ingredient: name, productName: name.toUpperCase(), sizeQty, sizeUnit, price, regularPrice: regular ?? price, discounted: regular !== undefined }]);
  ingredients.set(name, { name, section, pantry: false, unitWeightG: null, homemade: null, specialty: null, ...opts });
};

addProduct("riz", 4, 2000, "g", "Épicerie");
addProduct("poulet", 12, 1000, "g", "Viandes", {}, 16);
addProduct("oignon", 3, 1360, "g", "Fruits et légumes", { unitWeightG: 150 });
addProduct("persil", 1.5, 1, "unite", "Fruits et légumes", { unitWeightG: 60 });
addProduct("ail", 2, 200, "g", "Fruits et légumes");
addProduct("huile", 6, 1000, "ml", "Épicerie", { pantry: true });
addProduct("lentilles", 3, 900, "g", "Épicerie");
ingredients.set("épis", {
  name: "épis", section: "Épicerie", pantry: false, unitWeightG: null, specialty: null,
  homemade: { yieldQty: 250, yieldUnit: "ml", steps: ["Mixer."], ingredients: [
    { name: "persil", qty: 1, unit: "unite" }, { name: "ail", qty: 30, unit: "g" }, { name: "huile", qty: 60, unit: "ml" },
  ] },
});
ingredients.set("djon djon", { name: "djon djon", section: "Épicerie", pantry: false, unitWeightG: null, homemade: null, specialty: { where: "épicerie haïtienne", priceMax: 9, sizeQty: 30, sizeUnit: "g" } });

const R = (id: string, cuisine: string, ings: PlannerRecipe["ingredients"]): PlannerRecipe => ({
  id, name: id, cuisine, meal: "souper", styles: ["normal"], diets: [], servings: 4, ingredients: ings, steps: ["Cuire."], kcal: 600, protein: 25, image: null,
});
const recipes = [
  R("poulet-riz", "quebecoise", [{ name: "poulet", qty: 600, unit: "g" }, { name: "riz", qty: 300, unit: "g" }, { name: "oignon", qty: 1, unit: "unite" }, { name: "huile", qty: 30, unit: "ml" }]),
  R("lentilles", "quebecoise", [{ name: "lentilles", qty: 400, unit: "g" }, { name: "oignon", qty: 2, unit: "unite" }, { name: "huile", qty: 15, unit: "ml" }]),
  R("poulet-epis", "haitienne", [{ name: "poulet", qty: 800, unit: "g" }, { name: "épis", qty: 60, unit: "ml" }, { name: "riz", qty: 300, unit: "g" }]),
  R("riz-djon", "haitienne", [{ name: "riz", qty: 400, unit: "g" }, { name: "djon djon", qty: 20, unit: "g" }]),
];
const data: PlannerData = { recipes, ingredients, products };
const base: PlanRequest = { store: "maxi", meals: ["souper"], weeks: 2, people: 4, cuisines: ["quebecoise", "haitienne"], styles: ["normal"], diets: [], budget: 300, onlyStore: false };

// 1. Budget confortable : plan valide, jamais au-dessus de la cible
let res = planMenu(base, data, () => null);
assert.equal(res.ok, true);
if (res.ok) {
  assert.ok(res.total <= res.target, `total ${res.total} > cible ${res.target}`);
  assert.equal(res.weeks.length, 2);
  assert.equal(res.weeks[0].days.length, 7);
  assert.ok(res.weeks[0].pantry.some((p) => p.ingredient === "huile"), "huile au garde-manger en semaine 1");
  assert.ok(Object.values(res.recipes).some((r) => r.homemade.length > 0), "épis fait maison");
  console.log("✔ plan valide :", res.total, "$ pour une cible de", res.target, "$");
}

// 2. Budget serré : toujours un menu, jamais au-dessus de la cible
for (const budget of [150, 120, 100, 90, 80, 70, 60, 40, 20]) {
  res = planMenu({ ...base, budget }, data, () => null);
  assert.equal(res.ok, true, `budget ${budget} : un menu doit toujours être créé`);
  if (res.ok) {
    assert.ok(res.total <= res.target, `budget ${budget}: ${res.total} > ${res.target}`);
    const n = res.weeks.reduce((a, w) => a + w.days.reduce((b, d) => b + d.meals.length, 0), 0);
    console.log(`✔ budget ${budget} $ → ${res.total} $, ${n} repas${res.notices ? " (avis : " + res.notices.length + ")" : ""}`);
  }
}

// 3. Budget minuscule : menu quand même, avec repas laissés libres et un avis
res = planMenu({ ...base, budget: 10, people: 20 }, data, () => null);
assert.equal(res.ok, true);
if (res.ok) { assert.ok(res.total <= res.target); assert.ok(res.notices?.length); console.log("✔ budget minuscule → menu partiel dans le budget :", res.notices![res.notices!.length - 1]); }

// 4. « Seulement mon épicerie » exclut le djon djon
res = planMenu({ ...base, onlyStore: true }, data, () => null);
assert.equal(res.ok, true);
if (res.ok) { assert.ok(!res.recipes["riz-djon"]); assert.equal(res.weeks[0].specialty.length, 0); console.log("✔ seulement mon épicerie : aucune épicerie spécialisée"); }

// 5. Cuisine sans recettes encore : d'autres cuisines, avec un avis
res = planMenu({ ...base, cuisines: ["grecque"] }, data, () => null);
assert.equal(res.ok, true);
if (res.ok) { assert.ok(res.notices?.some((n) => n.includes("grecque"))); console.log("✔ cuisine pas encore prête → autres cuisines :", res.notices![0]); }

// 5b. Deux cuisines choisies : les deux sont présentes dans la semaine
res = planMenu({ ...base, weeks: 1, budget: 300 }, data, () => null);
if (res.ok) {
  const cs = new Set(res.weeks[0].days.flatMap((d) => d.meals.map((m) => res.ok && res.recipes[m.recipeId].cuisine)));
  assert.ok(cs.has("quebecoise") && cs.has("haitienne"), "les deux cuisines");
  console.log("✔ deux cuisines choisies → les deux au menu");
}

// 6. Les semaines 2+ utilisent le prix régulier (poulet 16 $ au lieu de 12 $)
res = planMenu({ ...base, budget: 1000 }, data, () => null);
if (res.ok) {
  const w1 = res.weeks[0].list.find((i) => i.ingredient === "poulet");
  const w2 = res.weeks[1].list.find((i) => i.ingredient === "poulet");
  if (w1 && w2) { assert.equal(w1.unitPrice, 12); assert.equal(w2.unitPrice, 16); console.log("✔ semaine 2 au prix régulier"); }
}
// 7. Plusieurs formats : pour une petite quantité, le petit format coûte moins cher que le gros sac
{
  const p2 = new Map(products);
  p2.set("ail", [
    { ingredient: "ail", productName: "AIL EN VRAC 1 KG", sizeQty: 1000, sizeUnit: "g", price: 30, regularPrice: 30, discounted: false },
    { ingredient: "ail", productName: "AIL 115 G", sizeQty: 115, sizeUnit: "g", price: 4.99, regularPrice: 4.99, discounted: false },
  ]);
  const one: PlannerRecipe = R("ail-seul", "grecque", [{ name: "ail", qty: 10, unit: "g" }, { name: "riz", qty: 300, unit: "g" }]);
  const r7 = planMenu({ ...base, cuisines: ["grecque"], weeks: 1, budget: 200 }, { ...data, recipes: [one], products: p2 }, () => null);
  assert.ok(r7.ok);
  if (r7.ok) {
    const ail = r7.weeks[0].list.find((i) => i.ingredient === "ail")!;
    assert.equal(ail.product, "AIL 115 G");
    assert.equal(ail.total, 4.99);
    console.log("✔ petit format choisi pour une petite quantité (4,99 $ au lieu de 30 $)");
  }
}
// 8. Variété : avec assez de recettes, aucune répétition sur la période (2 semaines → 14 plats différents)
{
  const many: PlannerRecipe[] = Array.from({ length: 16 }, (_, k) =>
    R(`plat-${k}`, k % 2 ? "quebecoise" : "haitienne", [{ name: "riz", qty: 200 + k * 10, unit: "g" }, { name: "oignon", qty: 1, unit: "unite" }]));
  const r8 = planMenu({ ...base, weeks: 2, budget: 400 }, { ...data, recipes: many }, () => null);
  assert.ok(r8.ok);
  if (r8.ok) {
    const names = r8.weeks.flatMap((w) => w.days.flatMap((d) => d.meals.map((m) => m.recipeId)));
    assert.equal(new Set(names).size, names.length, "aucune recette répétée");
    console.log("✔ 14 repas, 14 plats différents");
  }
}
console.log("Tous les tests passent.");
