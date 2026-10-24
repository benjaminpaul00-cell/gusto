// Fournisseurs d'IA en cascade. L'IA n'est appelée que par les tâches d'arrière-plan,
// jamais pendant la requête d'un visiteur : un quota épuisé ne peut pas faire tomber le site.

import type { Env } from "./db";

export class AllProvidersFailed extends Error {}

function extractJson(text: string): unknown {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.search(/[[{]/);
  return JSON.parse(start > 0 ? clean.slice(start) : clean);
}

async function gemini(env: Env, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
}

async function openAiCompatible(url: string, key: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
      // Longueur maximale explicite : sans elle, Groq réserve le maximum du modèle et dépasse le quota par minute.
      max_tokens: 3500,
      // Modèles qui « réfléchissent » (gpt-oss) : réflexion courte, moins de jetons consommés.
      ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status} ${(await res.text()).replace(/org_\w+/g, "org").slice(0, 260)}`);
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Réessaie après une limite par seconde (429), deux fois au plus, avec une attente croissante. */
async function withRetry(call: () => Promise<string>): Promise<string> {
  for (let i = 0; ; i++) {
    try {
      return await call();
    } catch (e) {
      if (i >= 2 || !/ 429 /.test((e as Error).message)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

async function workersAiText(env: Env, prompt: string): Promise<string> {
  const out: any = await env.AI.run(env.WORKERS_AI_TEXT_MODEL as any, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
  });
  return typeof out?.response === "string" ? out.response : JSON.stringify(out?.response ?? out);
}

/** Demande du JSON à l'IA en essayant chaque fournisseur configuré, dans l'ordre. */
export async function generateJson<T>(env: Env, prompt: string, validate: (x: any) => x is T): Promise<T> {
  const providers: [string, () => Promise<string>][] = [];
  if (env.GEMINI_API_KEY) providers.push(["gemini", () => gemini(env, prompt)]);
  // MISTRAL_MODEL peut contenir plusieurs modèles séparés par des virgules. Le forfait gratuit limite
  // le nombre de requêtes par seconde : en cas de 429, on attend un peu et on réessaie avant de passer au suivant.
  if (env.MISTRAL_API_KEY)
    for (const model of env.MISTRAL_MODEL.split(",").map((m) => m.trim()).filter(Boolean))
      providers.push([`mistral:${model}`, () => withRetry(() => openAiCompatible("https://api.mistral.ai/v1/chat/completions", env.MISTRAL_API_KEY!, model, prompt))]);
  // GROQ_MODEL peut contenir plusieurs modèles séparés par des virgules : essayés dans l'ordre.
  if (env.GROQ_API_KEY)
    for (const model of env.GROQ_MODEL.split(",").map((m) => m.trim()).filter(Boolean))
      providers.push([`groq:${model}`, () => openAiCompatible("https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY!, model, prompt)]);
  // L'IA de Cloudflare ne sert de secours que si aucun autre fournisseur n'est configuré :
  // son quota gratuit quotidien est réservé aux photos des plats.
  if (!providers.length) providers.push(["workers-ai", () => workersAiText(env, prompt)]);

  const errors: string[] = [];
  for (const [name, call] of providers) {
    try {
      const parsed = extractJson(await call());
      if (validate(parsed)) return parsed;
      errors.push(`${name}: format invalide`);
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }
  throw new AllProvidersFailed(errors.join(" | "));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Image par Mistral (outil « image_generation » de l'API des agents). L'agent est créé une fois et gardé dans KV. */
export async function mistralImage(env: Env, prompt: string): Promise<{ bytes: Uint8Array; type: string }> {
  const key = env.MISTRAL_API_KEY!;
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(`https://api.mistral.ai/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`mistral-image ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res;
  };
  let agentId = await env.IMAGES_KV?.get("mistral-image-agent");
  if (!agentId) {
    const a: any = await (await call("/agents", {
      method: "POST",
      body: JSON.stringify({
        model: "mistral-medium-latest",
        name: "Gusto photos",
        instructions: "Generate exactly one realistic food photograph matching the request. Do not answer with text only.",
        tools: [{ type: "image_generation" }],
      }),
    })).json();
    agentId = a.id as string;
    await env.IMAGES_KV?.put("mistral-image-agent", agentId);
  }
  const conv: any = await (await call("/conversations", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, inputs: prompt, store: false }),
  })).json();
  const chunks = (conv.outputs ?? []).flatMap((o: any) => (Array.isArray(o.content) ? o.content : []));
  const file = chunks.find((c: any) => c.type === "tool_file" && c.file_id);
  if (file) {
    const img = await call(`/files/${file.file_id}/content`);
    return { bytes: new Uint8Array(await img.arrayBuffer()), type: file.file_type === "jpeg" || file.file_type === "jpg" ? "image/jpeg" : "image/png" };
  }
  // Autre forme de réponse : un lien Markdown vers l'image (valide une heure)
  const text = (conv.outputs ?? []).map((o: any) => (typeof o.content === "string" ? o.content : "")).join(" ");
  const link = text.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)?.[1];
  if (!link) throw new Error(`mistral-image: aucune image ${text.slice(0, 200)}`);
  const img = await fetch(link);
  if (!img.ok) throw new Error(`mistral-image: téléchargement ${img.status}`);
  return { bytes: new Uint8Array(await img.arrayBuffer()), type: (img.headers.get("content-type") ?? "").startsWith("image/") ? img.headers.get("content-type")! : "image/jpeg" };
}

/** Génère une image de plat. Cloudflare Workers AI d'abord, puis Gemini si une clé est configurée. */
export async function generateImage(env: Env, prompt: string): Promise<{ bytes: Uint8Array; type: string }> {
  const errors: string[] = [];
  // Mistral d'abord (FLUX Ultra, bien plus beau). Limite atteinte : on réessaie plus tard plutôt que de
  // mélanger les styles de photos. Autre panne : l'IA de Cloudflare prend le relais.
  if (env.MISTRAL_API_KEY) {
    try {
      return await mistralImage(env, prompt);
    } catch (e) {
      const msg = (e as Error).message;
      if (/ 429 /.test(msg)) throw new AllProvidersFailed(`mistral: ${msg}`);
      errors.push(`mistral: ${msg}`);
    }
  }

  try {
    const out: any = await env.AI.run(env.WORKERS_AI_IMAGE_MODEL as any, { prompt, steps: 4 });
    if (out?.image) return { bytes: base64ToBytes(out.image), type: "image/jpeg" };
    errors.push("workers-ai: aucune image");
  } catch (e) {
    errors.push(`workers-ai: ${(e as Error).message}`);
  }

  if (env.GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: any = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part) return { bytes: base64ToBytes(part.inlineData.data), type: part.inlineData.mimeType ?? "image/png" };
      errors.push("gemini: aucune image");
    } catch (e) {
      errors.push(`gemini: ${(e as Error).message}`);
    }
  }
  throw new AllProvidersFailed(errors.join(" | "));
}

export const imagePrompt = (dish: string, cuisine: string) =>
  `Professional overhead food photograph of ${dish}, homemade ${cuisine} dish, served on a simple plate on a wooden kitchen table, natural daylight, appetizing, realistic, no text, no people, no hands.`;
