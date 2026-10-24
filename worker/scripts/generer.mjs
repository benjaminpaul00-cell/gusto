// Lance et accélère la génération de la banque (recettes, prix, photos), puis affiche la progression.
// Usage : node scripts/generer.mjs            (demande l'ADMIN_TOKEN, sans l'afficher)
//         node scripts/generer.mjs --tours 30 (nombre de lots, 20 par défaut)
// Les lots continuent seuls toutes les 10 minutes même sans ce programme.
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const API = process.env.GUSTO_API ?? "https://gusto-api.benjaminpaul00.workers.dev";
const tours = Number(process.argv[process.argv.indexOf("--tours") + 1]) || 20;
const PAUSE = 5_000; // courte pause entre deux lots (chaque lot traite 2 tâches)

// Saisie masquée : lit les touches une à une (comme Wrangler) et affiche une étoile par caractère.
function askHidden(question) {
  process.stdout.write(question);
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    // Entrée redirigée (tests) : lecture simple d'une ligne
    return new Promise((resolve) => {
      const rl = createInterface({ input: stdin });
      rl.once("line", (a) => { rl.close(); process.stdout.write("\n"); resolve(a.trim()); });
    });
  }
  return new Promise((resolve) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    const onData = (chunk) => {
      // Retire les codes de « collage encadré » (ESC [200~ … ESC [201~) et autres séquences de touches
      chunk = chunk.replace(/\u001b\[[0-9;]*[~A-Za-z]/g, "");
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (ch === "\u0003") { process.stdout.write("\n"); process.exit(130); } // Ctrl+C
        if (ch === "\u007f" || ch === "\b") { if (value) { value = value.slice(0, -1); process.stdout.write("\b \b"); } continue; }
        if (ch < " ") continue; // séquences de collage et touches spéciales
        value += ch;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

// Jeton lu dans worker/.admin-token (créé par scripts/nouveau-jeton.mjs), sinon demandé.
const tokenFile = new URL("../.admin-token", import.meta.url);
const token = existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : await askHidden("ADMIN_TOKEN (collez-le puis Entrée) : ");
const call = async (method, path) => {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (res.status === 401) throw new Error("ADMIN_TOKEN refusé : vérifiez la valeur collée.");
  try { return JSON.parse(text); } catch { throw new Error(`${res.status} ${text.slice(0, 200)}`); }
};

const sum = (rows, f = () => true) => rows.filter(f).reduce((n, r) => n + Number(r.n ?? 0), 0);
function show(st, done = []) {
  const recettes = sum(st.recipes);
  const photos = st.recipes.reduce((n, r) => n + Number(r.images ?? 0), 0);
  const ingr = sum(st.ingredients, (r) => r.status === "resolved");
  const ingrTotal = sum(st.ingredients);
  const attente = sum(st.jobs, (j) => j.status === "queued");
  const echecs = sum(st.jobs, (j) => j.status === "failed");
  const prix = st.priced.map((p) => `${p.store} ${p.n}`).join(", ") || "aucun";
  const t = new Date().toLocaleTimeString("fr-CA");
  console.log(`[${t}] recettes ${recettes} · photos ${photos} · ingrédients avec infos ${ingr}/${ingrTotal} · tâches en attente ${attente} · échecs ${echecs}`);
  console.log(`          produits avec prix par épicerie : ${prix}${done.length ? `\n          ce lot : ${done.join(", ")}` : ""}`);
  for (const e of st.errors ?? []) console.log(`          ⚠ ${e.kind} (essai ${e.attempts}) : ${String(e.last_error).slice(0, 160)}`);
}

try {
  let st = await call("GET", "/admin/status");
  if (sum(st.jobs) === 0 && sum(st.recipes) === 0) {
    const r = await call("POST", "/admin/seed");
    console.log(`Banque de départ mise en file : ${r.queued} lots de recettes.`);
    st = await call("GET", "/admin/status");
  }
  show(st);
  for (let i = 1; i <= tours; i++) {
    const r = await call("POST", "/admin/run");
    st = await call("GET", "/admin/status");
    console.log(`\nLot ${i}/${tours}`);
    show(st, r.done ?? []);
    if (i < tours) await new Promise((ok) => setTimeout(ok, PAUSE));
  }
  console.log("\nTerminé. La génération continue seule toutes les 10 minutes.");
} catch (e) {
  console.error(`\nErreur : ${e.message}`);
  process.exitCode = 1;
}
