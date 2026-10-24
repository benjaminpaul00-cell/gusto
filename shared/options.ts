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
  image: string | null; // URL de l'image, ou null → illustration de secours
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

export type PlanResponse =
  | {
      ok: true;
      request: PlanRequest;
      weeks: WeekPlan[];
      recipes: Record<string, RecipeView>;
      total: number;
      target: number;
      generatedAt: string;
      notices?: string[]; // ajustements expliqués à l'utilisateur (budget serré, recettes à venir…)
    }
  | {
      ok: false;
      reason: "budget" | "not_enough_recipes" | "invalid" | "rate_limited";
      message: string;
      minBudget?: number;
    };
