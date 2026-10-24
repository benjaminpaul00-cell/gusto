// Stockage des photos des plats.
// R2 si le bucket est branché (recommandé en production), sinon Workers KV : gratuit, sans carte
// de crédit, assez grand pour la banque de départ (1 Go, 1 000 écritures par jour).
import type { Env } from "./db";

export interface StoredImage { body: ReadableStream | ArrayBuffer; type: string }

export async function putImage(env: Env, key: string, bytes: Uint8Array, type: string): Promise<void> {
  if (env.IMAGES) { await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: type } }); return; }
  if (env.IMAGES_KV) { await env.IMAGES_KV.put(key, bytes, { metadata: { type } }); return; }
  throw new Error("Aucun stockage d'images : brancher R2 (IMAGES) ou KV (IMAGES_KV) dans wrangler.toml");
}

export async function getImage(env: Env, key: string): Promise<StoredImage | null> {
  if (env.IMAGES) {
    const obj = await env.IMAGES.get(key);
    return obj ? { body: obj.body, type: obj.httpMetadata?.contentType ?? "image/jpeg" } : null;
  }
  if (env.IMAGES_KV) {
    const { value, metadata } = await env.IMAGES_KV.getWithMetadata<{ type: string }>(key, "arrayBuffer");
    return value ? { body: value, type: metadata?.type ?? "image/jpeg" } : null;
  }
  return null;
}

export async function deleteImage(env: Env, key: string): Promise<void> {
  if (env.IMAGES) await env.IMAGES.delete(key);
  else if (env.IMAGES_KV) await env.IMAGES_KV.delete(key);
}
