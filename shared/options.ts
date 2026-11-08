// Options et types partagés entre l'app (Expo) et l'API (Cloudflare Worker).

export const STORES = [
  { id: "maxi", label: "Maxi" },
  { id: "superc", label: "Super C" },
  { id: "iga", label: "IGA" },
  { id: "metro", label: "Metro" },
  { id: "provigo", label: "Provigo" },
  { id: "walmart", label: "Walmart" },
] as const;

export const MEALS = [
  { id: "dejeuner", label: "Déjeuner" },
  { id: "diner", label: "Dîner" },
  { id: "souper", label: "Souper" },
] as const;

export const CUISINES = [
  { id: "quebecoise", label: "Québécoise" },
  { id: "haitienne", label: "Haïtienne" },
  { id: "chinoise", label: "Chinoise" },
  { id: "vietnamienne", label: "Vietnamienne" },
  { id: "grecque", label: "Grecque" },
  { id: "libanaise", label: "Libanaise" },
  { id: "italienne", label: "Italienne" },
  { id: "mexicaine", label: "Amérique centrale" }, // Mexique, Guatemala, Salvador…
  { id: "indienne", label: "Indienne" },
  { id: "marocaine", label: "Marocaine" },
  { id: "thailandaise", label: "Thaïlandaise" },
  { id: "portugaise", label: "Portugaise" },
  { id: "venezuelienne", label: "Vénézuélienne" },
  { id: "colombienne", label: "Colombienne" },
  { id: "peruvienne", label: "Péruvienne" },
  { id: "dominicaine", label: "Dominicaine" },
] as const;

export const STYLES = [
  { id: "normal", label: "Normal" },
  { id: "proteine", label: "Protéiné" },
  { id: "leger", label: "Léger" },
  { id: "gourmand", label: "Gourmand" },
] as const;

export const DIETS = [
  { id: "vegetarien", label: "Végétarien" },
  { id: "sans_gluten", label: "Sans gluten" },
  { id: "sans_noix", label: "Sans noix" },
  { id: "sans_lactose", label: "Sans lactose" },
  { id: "diabetique", label: "Diabétique" }, // peu de sucres ajoutés, glucides modérés (ne remplace pas un avis médical)
] as const;

// Diète par macros : habitudes caloriques difficiles à laisser (alcool). Calories moyennes par consommation.
// Au Québec, les épiceries vendent bière, vin, cidre et prêts-à-boire ; les spiritueux se vendent seulement à la SAQ.
// price : prix estimé par consommation à l'épicerie (épiceries.ca ne suit pas l'alcool), compté dans le budget.
// mixer : pour un cocktail, la boisson de mélange (achetée à l'épicerie, comptée dans le budget) ; l'alcool vient de la SAQ.
export const ALCOHOLS = [
  { id: "biere", label: "Bière", serving: "canette de 355 ml", kcal: 150, grocery: true, price: 2.5 },
  { id: "biere_legere", label: "Bière légère", serving: "canette de 355 ml", kcal: 100, grocery: true, price: 2.3 },
  { id: "vin", label: "Vin", serving: "verre de 150 ml", kcal: 125, grocery: true, price: 3 },
  { id: "cidre", label: "Cidre", serving: "canette de 355 ml", kcal: 170, grocery: true, price: 3 },
  { id: "pret_a_boire", label: "Prêt-à-boire", serving: "canette de 355 ml", kcal: 110, grocery: true, price: 3.5 },
  { id: "sangria", label: "Sangria", serving: "verre de 180 ml", kcal: 170, grocery: true, price: 3 },
  { id: "rhum_cola", label: "Rhum et cola", serving: "45 ml de rhum et 250 ml de cola", kcal: 205, grocery: false, mixer: "cola", mixerPrice: 0.6 },
  { id: "whisky_cola", label: "Whisky et cola", serving: "45 ml de whisky et 250 ml de cola", kcal: 205, grocery: false, mixer: "cola", mixerPrice: 0.6 },
  { id: "vodka_canneberge", label: "Vodka canneberge", serving: "45 ml de vodka et 180 ml de jus", kcal: 190, grocery: false, mixer: "jus de canneberge", mixerPrice: 0.7 },
  { id: "vodka_soda", label: "Vodka soda", serving: "45 ml de vodka et eau gazeuse", kcal: 100, grocery: false, mixer: "eau gazeuse", mixerPrice: 0.4 },
  { id: "gin_tonic", label: "Gin tonic", serving: "45 ml de gin et 180 ml de tonic", kcal: 170, grocery: false, mixer: "soda tonique", mixerPrice: 0.6 },
  { id: "cesar", label: "César", serving: "45 ml de vodka et 180 ml de Clamato", kcal: 130, grocery: false, mixer: "jus de tomate et palourdes", mixerPrice: 0.8 },
  { id: "margarita", label: "Margarita", serving: "un verre", kcal: 275, grocery: false, mixer: "jus de lime", mixerPrice: 0.5 },
  { id: "mojito", label: "Mojito", serving: "un verre", kcal: 240, grocery: false, mixer: "lime, menthe et soda", mixerPrice: 0.8 },
  { id: "whisky", label: "Whisky (sec)", serving: "verre de 45 ml", kcal: 100, grocery: false },
  { id: "rhum", label: "Rhum (sec)", serving: "verre de 45 ml", kcal: 100, grocery: false },
  { id: "vodka", label: "Vodka (sec)", serving: "verre de 45 ml", kcal: 100, grocery: false },
  { id: "gin", label: "Gin (sec)", serving: "verre de 45 ml", kcal: 100, grocery: false },
  { id: "tequila", label: "Tequila (sec)", serving: "verre de 45 ml", kcal: 100, grocery: false },
  { id: "liqueur", label: "Liqueur ou crème", serving: "verre de 45 ml", kcal: 150, grocery: false },
] as const;

// Diète par macros : extras de tous les jours (shake protéiné, noix). Valeurs pour 100 g.
// Les huiles de cuisson ne sont pas demandées : elles sont déjà comptées dans les recettes.
// `ingredient` : produit suivi en épicerie (prix et liste d'épicerie) ; null = prix non suivi (épiceries.ca ne le relève pas).
export const EXTRAS = [
  { id: "shake", group: "shake", label: "Poudre de protéines", unit: "g", preset: 30, per100: { kcal: 400, protein: 80, carbs: 8, fat: 6 }, ingredient: null },
  { id: "amandes", group: "noix", label: "Amandes", unit: "g", preset: 30, per100: { kcal: 579, protein: 21, carbs: 22, fat: 50 }, ingredient: "amandes crues" },
  { id: "cajou", group: "noix", label: "Noix de cajou", unit: "g", preset: 30, per100: { kcal: 553, protein: 18, carbs: 30, fat: 44 }, ingredient: "noix de cajou non salées" },
  { id: "grenoble", group: "noix", label: "Noix de Grenoble", unit: "g", preset: 30, per100: { kcal: 654, protein: 15, carbs: 14, fat: 65 }, ingredient: "noix de grenoble" },
  { id: "arachides", group: "noix", label: "Arachides", unit: "g", preset: 30, per100: { kcal: 567, protein: 26, carbs: 16, fat: 49 }, ingredient: "arachides" },
  { id: "pistaches", group: "noix", label: "Pistaches", unit: "g", preset: 30, per100: { kcal: 560, protein: 20, carbs: 28, fat: 45 }, ingredient: "pistaches" },
  { id: "pacanes", group: "noix", label: "Pacanes", unit: "g", preset: 30, per100: { kcal: 691, protein: 9, carbs: 14, fat: 72 }, ingredient: "noix de pécan" },
  { id: "beurre_arachide", group: "noix", label: "Beurre d’arachide", unit: "g", preset: 30, per100: { kcal: 588, protein: 25, carbs: 20, fat: 50 }, ingredient: "beurre d'arachide" },
  { id: "beurre_amande", group: "noix", label: "Beurre d’amande", unit: "g", preset: 30, per100: { kcal: 614, protein: 21, carbs: 19, fat: 56 }, ingredient: "beurre d'amande" },
] as const;

// Part des calories de la journée prévue pour chaque repas (le reste : collations).
export const MEAL_SHARE = { dejeuner: 0.25, diner: 0.35, souper: 0.4 } as const;

// Seuils des étiquettes nutritionnelles (par portion). Ajustables.
export const STYLE_RULES = {
  proteineMinProteinG: 30,
  legerMaxKcal: 500,
};

// Le menu vise ce pourcentage du budget pour absorber les écarts entre succursales.
export const BUDGET_SAFETY = 0.95;

export const LIMITS = { maxPeople: 20, maxWeeks: 4 };

export type StoreId = (typeof STORES)[number]["id"];
export type MealId = (typeof MEALS)[number]["id"];
export type CuisineId = (typeof CUISINES)[number]["id"];
export type StyleId = (typeof STYLES)[number]["id"];
export type DietId = (typeof DIETS)[number]["id"];
export type AlcoholId = (typeof ALCOHOLS)[number]["id"];
export type ExtraId = (typeof EXTRAS)[number]["id"];

/** Diète par macros : calories par jour (par personne) et répartition en % des calories (total de 100). */
export interface MacroTarget { kcal: number; protein: number; carbs: number; fat: number }
/** Habitudes caloriques : nombre de consommations par semaine, par type d'alcool. */
export interface Habits {
  alcohol: { id: AlcoholId; perWeek: number }[];
  extras?: { id: ExtraId; perDay: number }[]; // shake, noix : quantité par jour (g)
}

export type Unit = "g" | "ml" | "unite";

export interface PlanRequest {
  store: StoreId; // première épicerie choisie (affichage, compatibilité)
  stores?: StoreId[]; // toutes les épiceries choisies ; chaque article est acheté là où il coûte le moins
  specialsOnly?: boolean; // menu bâti avec les produits en spécial cette semaine
  meals: MealId[];
  weeks: number;
  people: number;
  cuisines: CuisineId[];
  styles: StyleId[];
  diets: DietId[];
  budget: number; // total pour toute la période, en $
  onlyStore: boolean; // exclure les recettes qui demandent une épicerie spécialisée
  macros?: MacroTarget; // diète par macros : 1 personne, déjeuner, dîner et souper ; portions et recettes selon la cible
  habits?: Habits; // alcool : calories comptées chaque jour, achats listés à part
}

export interface RecipeIngredient {
  name: string; // nom canonique, minuscules
  qty: number; // pour `servings` portions
  unit: Unit;
  display?: string; // ex. « 2 gousses d'ail »
}

export interface HomemadeRecipe {
  yieldQty: number;
  yieldUnit: Unit;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface RecipeView {
  id: string;
  name: string;
  cuisine: CuisineId;
  meal: MealId;
  styles: StyleId[];
  servings: number; // portions préparées (= nombre de personnes)
  ingredients: { display: string; name: string }[];
  steps: string[];
  homemade: { name: string; steps: string[]; ingredients: string[] }[];
  specialty: { name: string; where: string; priceMax: number }[];
  kcal: number;
  protein: number;
  carbs?: number; // glucides par portion (g), estimés
  fat?: number; // lipides par portion (g), estimés
  portion?: number; // diète par macros : portion ajustée (1 = portion de la recette)
  image: string | null; // URL de l'image, ou null → illustration de secours
  imageCredit?: { creator: string | null; license: "cc0" | "pdm"; source: string; landing: string }; // photo libre ; absent = image générée
  costPerPortion: number;
}

export interface ListItem {
  ingredient: string;
  product: string;
  size: string;
  packages: number;
  unitPrice: number;
  total: number;
  discounted: boolean;
  regularPrice?: number; // prix régulier de l'emballage, quand le rabais est réel (historique des prix)
  deal?: "vrai" | "plancher"; // plancher : plus bas prix de l'année
  estimated?: boolean; // prix d'une autre bannière (le plus élevé), faute de relevé dans celle-ci
  store?: StoreId; // épicerie où acheter cet article (plusieurs épiceries choisies)
  section: string;
}

export interface WeekPlan {
  week: number;
  estimated: boolean; // true = prix réguliers (semaines 2+)
  days: { day: number; meals: { meal: MealId; recipeId: string }[] }[];
  list: ListItem[];
  pantry: ListItem[];
  specialty: ListItem[];
  total: number;
  pantryIncluded?: boolean; // false = garde-manger listé mais pas compté (budget très serré)
}

/** Diète par macros : cible et apport prévu, par personne. */
export interface Nutrition {
  target: { kcal: number; protein: number; carbs: number; fat: number }; // par jour (grammes)
  share: number; // part de la journée couverte par les repas planifiés (ex. 0,75)
  alcohol: { id: AlcoholId; label: string; serving: string; perWeek: number; kcalPerWeek: number; grocery: boolean; buy: string; mixer?: string; costPerWeek: number }[];
  complements: { label: string; gramsPerDay: number }[]; // poulet, thon, riz… ajoutés pour atteindre la cible (moyenne par jour)
  alcoholKcalPerDay: number;
  extras: { id: ExtraId; label: string; perDay: number; unit: string; kcalPerDay: number; priced: boolean }[]; // shake, noix
  days: { week: number; day: number; kcal: number; protein: number; carbs: number; fat: number; complements?: string }[]; // repas, compléments, extras et alcool
}

export type PlanResponse =
  | {
      ok: true;
      request: PlanRequest;
      weeks: WeekPlan[];
      recipes: Record<string, RecipeView>;
      total: number;
      target: number;
      fullBudget?: number; // diète par macros : budget qu'il faudrait pour atteindre la cible à 100 %
      generatedAt: string;
      notices?: string[]; // ajustements expliqués à l'utilisateur (budget serré, recettes à venir…)
      nutrition?: Nutrition; // diète par macros
    }
  | {
      ok: false;
      reason: "budget" | "not_enough_recipes" | "invalid" | "rate_limited";
      message: string;
      minBudget?: number;
    };
