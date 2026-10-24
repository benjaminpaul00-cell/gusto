// Tout reste sur l'appareil : aucun compte, aucune donnée personnelle envoyée au serveur.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PlanRequest, PlanResponse } from "../../../shared/options";

const KEYS = { form: "gusto:form", plan: "gusto:plan", consent: "gusto:consent" } as const;

async function read<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
async function write(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou désactivé : l'outil fonctionne quand même */
  }
}

export const loadForm = () => read<PlanRequest>(KEYS.form);
export const saveForm = (f: PlanRequest) => write(KEYS.form, f);
export const loadPlan = () => read<Extract<PlanResponse, { ok: true }>>(KEYS.plan);
export const savePlan = (p: Extract<PlanResponse, { ok: true }>) => write(KEYS.plan, p);

export type Consent = "all" | "essential";
export const loadConsent = () => read<Consent>(KEYS.consent);
export const saveConsent = (c: Consent) => write(KEYS.consent, c);
