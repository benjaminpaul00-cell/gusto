// Crée un nouvel ADMIN_TOKEN au hasard, l'enregistre sur l'API (wrangler secret put)
// et le garde dans worker/.admin-token (fichier privé, exclu de Git). Le jeton n'est jamais affiché.
// Usage : node scripts/nouveau-jeton.mjs
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("..", import.meta.url));
const token = randomBytes(32).toString("hex");

const res = spawnSync("npx", ["wrangler", "secret", "put", "ADMIN_TOKEN"], { cwd: dir, input: token, shell: true, encoding: "utf8" });
if (res.status !== 0) {
  console.error("Échec de l'enregistrement du jeton sur Cloudflare :\n" + (res.stderr || res.stdout));
  process.exit(1);
}
writeFileSync(new URL("../.admin-token", import.meta.url), token + "\n", { mode: 0o600 });
console.log("Nouvel ADMIN_TOKEN enregistré sur l'API et gardé dans worker/.admin-token (ne le partagez pas).");
