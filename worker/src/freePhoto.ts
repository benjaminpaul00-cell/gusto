// Photos libres de droits pour les recettes du menu : on cherche d'abord une vraie photo du plat
// (domaine public ou CC0 seulement, sur Openverse et Wikimedia Commons), avec son crédit.
// Chaque photo est vérifiée (bon plat, photo propre) avant d'être gardée ; sinon on génère une image.

import { generateJson } from "./ai";
import type { Env } from "./db";

export interface PhotoCredit { creator: string | null; license: "cc0" | "pdm"; source: string; landing: string }
export interface FreePhoto { bytes: Uint8Array; type: string; credit: PhotoCredit }
interface Candidate { title: string; url: string; credit: PhotoCredit }

const UA = "GustoRecettes/1.0 (+https://mongusto.ca; info@mongusto.ca)";
const MAX_BYTES = 4_000_000;
// Mots qui trahissent une photo qui n'est pas un plat (emballage, restaurant, menu, personnes, dessin)
const BAD = /\b(menu|sign|logo|restaurant|store|shop|package|box|label|people|man|woman|girl|boy|kid|child|drawing|illustration|clipart|vector|icon|recipe card|cookbook|advert|poster|map)\b/i;
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function openverse(q: string): Promise<Candidate[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&category=photograph&mature=false&page_size=12`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) return [];
  const data: any = await res.json();
  return (data.results ?? [])
    .filter((r: any) => (r.license === "cc0" || r.license === "pdm") && !BAD.test(`${r.title ?? ""} ${(r.tags ?? []).map((t: any) => t.name).join(" ")}`))
    .filter((r: any) => !r.width || (r.width >= 800 && r.width / Math.max(1, r.height) <= 2.2))
    .map((r: any) => ({ title: String(r.title ?? ""), url: String(r.url), credit: { creator: r.creator ? String(r.creator).slice(0, 120) : null, license: r.license, source: String(r.source ?? "openverse").slice(0, 60), landing: String(r.foreign_landing_url ?? "").slice(0, 400) } }));
}

async function commons(q: string): Promise<Candidate[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) return [];
  const data: any = await res.json();
  const out: Candidate[] = [];
  for (const p of Object.values<any>(data.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0];
    const m = ii?.extmetadata ?? {};
    const lic = String(m.LicenseShortName?.value ?? m.License?.value ?? "");
    const license = /^cc0/i.test(lic) || /^cc-zero/i.test(lic) ? "cc0" : /public domain|^pd/i.test(lic) ? "pdm" : null;
    if (!ii || !license || !ii.thumburl || ii.width < 800 || ii.width / Math.max(1, ii.height) > 2.2) continue;
    if (BAD.test(`${p.title} ${stripHtml(String(m.ImageDescription?.value ?? ""))}`)) continue;
    out.push({ title: String(p.title), url: ii.thumburl, credit: { creator: m.Artist?.value ? stripHtml(String(m.Artist.value)).slice(0, 120) || null : null, license, source: "wikimedia", landing: String(ii.descriptionurl ?? "").slice(0, 400) } });
  }
  return out;
}

async function download(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  const type = (res.headers.get("content-type") ?? "").split(";")[0];
  if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length > 20_000 && bytes.length <= MAX_BYTES ? { bytes, type } : null;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

interface Verdict { sameDish: boolean; score: number; clean: boolean }
const isVerdict = (x: any): x is Verdict => typeof x?.sameDish === "boolean" && typeof x?.score === "number" && typeof x?.clean === "boolean";

/** Vérifie la photo : le même plat, appétissant, sans texte, filigrane, emballage ni personne. null = vérification impossible. */
async function verify(env: Env, img: { bytes: Uint8Array; type: string }, dish: string): Promise<Verdict | null> {
  const question = `Recipe: "${dish}". Look at the photo. Answer only in JSON: {"sameDish": true if the photo clearly shows this exact dish (not a different dish, not raw ingredients), "score": 0-10 how well it would illustrate this recipe on a cooking website, "clean": true if there is no visible text, watermark, logo, packaging or person}.`;
  const dataUrl = `data:${img.type};base64,${toBase64(img.bytes)}`;
  const parse = (text: string) => {
    try { const j = JSON.parse(text.replace(/```json|```/g, "").trim().replace(/^[^{]*/, "")); return isVerdict(j) ? j : null; } catch { return null; }
  };
  if (env.MISTRAL_API_KEY) {
    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.MISTRAL_API_KEY}` },
        body: JSON.stringify({ model: "mistral-medium-latest", temperature: 0, response_format: { type: "json_object" }, max_tokens: 200,
          messages: [{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: dataUrl }] }] }),
      });
      if (res.ok) { const v = parse((await res.json() as any).choices?.[0]?.message?.content ?? ""); if (v) return v; }
    } catch { /* on essaie le suivant */ }
  }
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: question }, { inline_data: { mime_type: img.type, data: toBase64(img.bytes) } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
      });
      if (res.ok) { const v = parse((await res.json() as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? ""); if (v) return v; }
    } catch { /* aucune vérification possible */ }
  }
  return null;
}

/** Cherche une photo libre du plat et la vérifie. null : rien de convenable, on générera une image. */
export async function findFreePhoto(env: Env, name: string, description?: string | null, log?: unknown[]): Promise<FreePhoto | null> {
  // Recherches en anglais (bien plus de photos libres), du plus précis au plus général
  let queries: string[] = [];
  try {
    const out = await generateJson(env, `Dish: "${name}"${description ? ` (${description.slice(0, 300)})` : ""}.
Give 2 short English image-search queries (2 to 4 words) to find a photo of this exact cooked dish, most specific first.
Answer only in JSON: {"queries":["",""]}`, (x: any): x is { queries: string[] } => Array.isArray(x?.queries) && x.queries.every((q: any) => typeof q === "string"));
    queries = out.queries.map((q) => q.trim()).filter(Boolean).slice(0, 2);
  } catch { /* on cherche avec le nom seulement */ }
  if (!queries.length) queries = [name];
  log?.push({ queries });

  const seen = new Set<string>();
  let tried = 0;
  for (const q of queries) {
    const found = [...(await commons(q).catch(() => [])), ...(await openverse(q).catch(() => []))];
    for (const c of found) {
      if (seen.has(c.url) || tried >= 5) continue;
      seen.add(c.url);
      tried++;
      const img = await download(c.url).catch(() => null);
      if (!img) { log?.push({ title: c.title, skipped: "téléchargement" }); continue; }
      const v = await verify(env, img, name);
      log?.push({ title: c.title, url: c.url, verdict: v });
      if (!v) return null; // vérification impossible : on ne prend pas de risque
      if (v.sameDish && v.clean && v.score >= 7) return { ...img, credit: c.credit };
    }
  }
  return null;
}
