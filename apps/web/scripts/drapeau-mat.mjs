// Génère assets/drapeau-mat.png : le fleurdelisé hissé sur un mât (boule dorée), qui flotte au vent.
// Le pied du mât passe derrière la toque du logo dans l'en-tête (SiteHeader.tsx).
// Usage : node scripts/drapeau-mat.mjs
import sharp from "sharp";
import { flagSvg } from "./drapeau.mjs";

const out = (p) => new URL(`../assets/${p}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const W = 900, H = 600, AMP = 34, STRIP = 3, PAD = AMP + 6;
const INK = "#0E1030", GOLD = "#F2B705";

// 1) Drapeau à plat, puis découpé en bandes verticales décalées en vague (le côté du mât reste droit)
const flat = await sharp(Buffer.from(flagSvg(W))).png().toBuffer();
const lift = (x) => Math.pow(x / W, 0.85); // 0 au mât, 1 au bout
const wave = (x) => Math.sin((x / W) * Math.PI * 1.7 + 0.35) * AMP * lift(x) - AMP * 0.25 * lift(x);
const parts = [];
for (let x = 0; x < W; x += STRIP) {
  const w = Math.min(STRIP, W - x);
  const dy = Math.round(PAD + wave(x));
  parts.push({ input: await sharp(flat).extract({ left: x, top: 0, width: w, height: H }).toBuffer(), left: x, top: dy });
  // Plis : ombre quand le tissu s'éloigne, reflet quand il revient vers la lumière
  const slope = wave(x + 2) - wave(x - 2);
  const a = Math.min(0.34, Math.abs(slope) * 0.09);
  const fill = slope > 0 ? `rgba(0,0,30,${a.toFixed(3)})` : `rgba(255,255,255,${(a * 0.75).toFixed(3)})`;
  parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}"><rect width="${w}" height="${H}" fill="${fill}"/></svg>`), left: x, top: dy });
}
const cloth = await sharp({ create: { width: W, height: H + PAD * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(parts).png().toBuffer();

// 2) Mât et boule dorée, drapeau accroché sous la boule
const POLE = 16, TOP = 40, POLE_X = 22, CW = POLE_X + POLE + W + 10;
const POLE_LEN = 600; // longueur du mât : plus court = drapeau plus bas dans l'en-tête (pied caché derrière la toque)
const CH = Math.max(TOP + POLE_LEN, TOP + 20 + H + PAD * 2);
const mast = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
  <defs>
    <linearGradient id="p" x1="0" x2="1"><stop offset="0" stop-color="#3A3F6B"/><stop offset=".45" stop-color="${INK}"/><stop offset="1" stop-color="${INK}"/></linearGradient>
    <radialGradient id="g" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#FFE48A"/><stop offset=".6" stop-color="${GOLD}"/><stop offset="1" stop-color="#B98700"/></radialGradient>
  </defs>
  <rect x="${POLE_X}" y="${TOP}" width="${POLE}" height="${POLE_LEN}" rx="${POLE / 2}" fill="url(#p)"/>
  <circle cx="${POLE_X + POLE / 2}" cy="${TOP - 4}" r="22" fill="url(#g)" stroke="${INK}" stroke-width="5"/>
</svg>`;
const raw = await sharp(Buffer.from(mast)).composite([{ input: cloth, left: POLE_X + POLE - 2, top: TOP + 20 - PAD }]).png().toBuffer();

// 3) Inclinaison vers la droite : un drapeau planté, fier
await sharp(raw).rotate(13, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).trim().resize({ width: 520 }).png().toFile(out("drapeau-mat.png"));
const m = await sharp(out("drapeau-mat.png")).metadata();
console.log("assets/drapeau-mat.png créé", m.width, "×", m.height);
