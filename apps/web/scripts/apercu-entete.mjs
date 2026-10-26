// Aperçu en haute définition du logo et du drapeau, avec les mêmes proportions que SiteHeader.tsx.
// Usage : node scripts/apercu-entete.mjs <fichier.png>
import sharp from "sharp";

const asset = (p) => new URL(`../assets/${p}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const out = process.argv[2] ?? "apercu-entete.png";
// Unités du logo d'origine (600 × 387). En-tête : LOGO_SIZE 46 → hauteur 64,4 px ; drapeau 60 px de large.
const LOGO_H_PX = 46 * 1.4, U = 387 / LOGO_H_PX; // unités par pixel affiché
const { width: fw, height: fh } = await sharp(asset("drapeau-mat.png")).metadata();
const FLAG_W = Math.round(60 * U), FLAG_H = Math.round(60 * (fh / fw) * U);
const left = Math.round(600 * 0.65), top = Math.round(387 * 0.43 - FLAG_H);
const M = 60, OX = M, OY = M - top; // marges pour que tout entre dans l'image
const flag = await sharp(asset("drapeau-mat.png")).resize(FLAG_W, FLAG_H).toBuffer();
const W = Math.max(600, left + FLAG_W) + M * 2, H = 387 + OY + M;
await sharp({ create: { width: W, height: H, channels: 4, background: "#FFFFFF" } })
  .composite([{ input: flag, left: OX + left, top: OY + top }, { input: asset("logo.png"), left: OX, top: OY }])
  .png().toFile(out);
console.log(out);
