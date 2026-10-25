// Client de la section Recettes (API /api/section) et petites mémoires locales (votant, ajouts au menu).
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ListItem, StoreId } from "../../../shared/options";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const OFFLINE = "Connexion impossible. Vérifie ta connexion Internet et réessaie.";

export type Source = "ia" | "communaute" | "externe";
export const SOURCE_LABEL: Record<Source, string> = { externe: "Sites québécois", communaute: "Communauté", ia: "Recette Gusto" };

export interface SectionSummary {
  id: string; source: Source; title: string; servings: number; prepMin: number | null; cookMin: number | null;
  author: string | null; sourceName: string | null; photo: string | null; ingredientCount: number;
  rating: { avg: number | null; count: number; sourceCount?: number };
}
export interface SectionIngredient { qty: number; unit: "g" | "ml" | "unite"; name: string; display: string }
export interface SectionRecipe extends SectionSummary {
  temperature: string | null; sourceUrl: string | null; servingsEstimated: boolean;
  ingredients: SectionIngredient[]; steps: string[]; myStars: number | null;
  photoCredit?: { creator: string | null; license: string; source: string; landing: string } | null;
}
export interface PriceResult {
  people: number; stores: StoreId[]; missing: string[]; pantryMissing: string[];
  single: { store: StoreId; label: string; total: number; estimated: number }[];
  best: { store: StoreId; label: string; total: number; items: ListItem[]; pantry: ListItem[] } | null;
  multi: { total: number; savings: number; items: ListItem[]; pantry: ListItem[] } | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API}${path}`, init);
    return (await res.json()) as T;
  } catch {
    return { ok: false, message: OFFLINE };
  }
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const listRecipes = (p: { source?: string; tri?: string; q?: string; offset?: number }) =>
  call<{ total: number; items: SectionSummary[] }>(`/api/section?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))}`);
export const getRecipe = async (id: string) => call<SectionRecipe>(`/api/section/${encodeURIComponent(id)}?votant=${await voterId()}`);
export const searchRecipe = (q: string) => call<{ ok: boolean; id?: string; message?: string; cached?: boolean }>("/api/section/recherche", post({ q }));
export const priceRecipe = (id: string, people: number, stores: StoreId[]) => call<PriceResult>(`/api/section/${encodeURIComponent(id)}/prix`, post({ people, stores }));
export const rateRecipe = async (id: string, stars: number) =>
  call<{ ok: boolean; message?: string; rating?: { avg: number; count: number; sourceCount?: number }; myStars?: number }>(`/api/section/${encodeURIComponent(id)}/vote`, post({ stars, voter: await voterId() }));
export const shareRecipe = (body: unknown) => call<{ ok: boolean; message?: string; id?: string }>("/api/section/partager", post(body));

export const isError = (x: unknown): x is { ok: false; message: string } => !!x && typeof x === "object" && (x as any).ok === false;

/** Identifiant aléatoire du navigateur, pour un vote par personne sans compte. */
async function voterId(): Promise<string> {
  try {
    let v = await AsyncStorage.getItem("gusto:votant");
    if (!v) { v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; await AsyncStorage.setItem("gusto:votant", v); }
    return v;
  } catch {
    return "anonyme-sans-stockage";
  }
}

// ---------- Ajouts au menu et à la liste d'épicerie ----------

export interface Addition {
  key: string; recipeId: string; title: string; people: number; withRecipe: boolean;
  mode: "une" | "plusieurs"; storesLabel: string; total: number; items: ListItem[]; pantry: ListItem[]; addedAt: number;
}
const ADD_KEY = "gusto:ajouts";
export async function loadAdditions(): Promise<Addition[]> {
  try { return JSON.parse((await AsyncStorage.getItem(ADD_KEY)) ?? "[]"); } catch { return []; }
}
export async function saveAdditions(list: Addition[]) {
  try { await AsyncStorage.setItem(ADD_KEY, JSON.stringify(list)); } catch { /* stockage plein ou désactivé */ }
}
export async function addAddition(a: Omit<Addition, "key" | "addedAt">) {
  const list = await loadAdditions();
  list.push({ ...a, key: `${a.recipeId}-${Date.now().toString(36)}`, addedAt: Date.now() });
  await saveAdditions(list);
  return list.length;
}

/** Durée lisible : « 1 h 30 », « 45 min ». */
export const duration = (min: number | null) => (min == null ? null : min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}` : `${min} min`);
/** « ★ 4,6 (38 avis) » */
export const ratingText = (r: { avg: number | null; count: number }) =>
  r.count ? `${r.avg!.toFixed(1).replace(".", ",")} (${r.count} avis)` : "Aucun avis";
