import type { PlanRequest, PlanResponse } from "../../../shared/options";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

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
