import type { PlanRequest, PlanResponse } from "../../../shared/options";

const API = (process.env.EXPO_PUBLIC_API_URL?.trim() || "https://api.mongusto.ca").replace(/\/$/, "");

/** Budget minimum vérifié par le serveur pour ces choix (null si inconnu). */
export async function requestMinimum(req: PlanRequest, signal?: AbortSignal): Promise<{ min: number; full: number } | null> {
  try {
    const res = await fetch(`${API}/api/plan/minimum`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
    const j = (await res.json()) as { ok: boolean; minBudget?: number; fullBudget?: number };
    return j.ok && j.minBudget ? { min: j.minBudget, full: Math.max(j.minBudget, j.fullBudget ?? j.minBudget) } : null;
  } catch {
    return null;
  }
}

export async function requestPlan(req: PlanRequest): Promise<PlanResponse> {
  try {
    const res = await fetch(`${API}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return (await res.json()) as PlanResponse;
  } catch {
    return { ok: false, reason: "invalid", message: "Connexion impossible. Vérifiez votre connexion Internet et réessayez." };
  }
}
