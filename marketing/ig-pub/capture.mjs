// Captures du vrai site (mongusto.ca) en format téléphone, par Chrome sans fenêtre et le protocole DevTools.
// Bannière des témoins masquée (choix « essentiels » déjà fait) ; un vrai menu est calculé pour la page Menu.
// Usage : node capture.mjs
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const W = 390, H = 844, SCALE = 3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Un vrai menu, calculé par l'API en ligne
const req = { store: "maxi", stores: ["maxi"], weeks: 1, budget: 150, people: 2, meals: ["souper"], diets: [], styles: ["normal"], cuisines: ["quebecoise", "italienne", "mexicaine", "asiatique", "indienne"], onlyStore: true };
const plan = await (await fetch("https://api.mongusto.ca/api/plan", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://mongusto.ca" }, body: JSON.stringify(req) })).json();
if (!plan.ok) throw new Error("menu : " + plan.message);
console.log("menu :", plan.total, "$ sur", req.budget, "$");

const profile = mkdtempSync(join(tmpdir(), "gusto-cap-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
let tabs;
for (let i = 0; i < 40 && !tabs; i++) { await wait(250); tabs = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });
await cdp("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
// Préférences enregistrées avant le chargement : témoins essentiels et menu calculé
await cdp("Page.navigate", { url: "https://mongusto.ca/a-propos" });
await wait(3000);
await cdp("Runtime.evaluate", { expression: `localStorage.setItem("gusto:consent", JSON.stringify("essential")); localStorage.setItem("gusto:plan", ${JSON.stringify(JSON.stringify(plan))}); true` });

async function shot(url, file, scrollY = 0) {
  await cdp("Page.navigate", { url });
  await wait(6000); // polices, photos et animations d'entrée
  if (scrollY) { await cdp("Runtime.evaluate", { expression: `window.scrollTo(0, ${scrollY})` }); await wait(1500); }
  const { result } = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(result.data, "base64"));
  console.log("capture :", file);
}
await shot("https://mongusto.ca/", "site-accueil.png");
await shot("https://mongusto.ca/menu", "site-menu.png");
ws.close();
chrome.kill();
