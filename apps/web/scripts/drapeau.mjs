// Le fleurdelisé à plat (proportions 3:2, bleu Pantone 293), en SVG, utilisé par scripts/drapeau-mat.mjs.
// La fleur de lys est dessinée en deux moitiés symétriques.

export const BLUE = "#003DA5";
// Moitié droite d'une fleur de lys, dans une boîte de 100 × 100 (axe de symétrie à x = 50)
const HALF = `
  <path d="M50 0 C55 10 62 22 63 36 C64 47 59 56 54 63 L50 63 Z"/>
  <path d="M55 62 C58 52 64 41 74 35 C85 29 97 33 99 44 C101 55 92 62 84 58 C78 55 79 47 85 47 C88 47 90 49 90 52 C92 45 86 40 79 43 C70 47 64 56 61 64 Z"/>
  <path d="M54 74 C57 79 62 82 69 82 C75 82 78 79 77 75 C82 78 82 87 74 90 C66 93 58 88 54 80 Z"/>`;
export const LYS = `${HALF}<g transform="translate(100 0) scale(-1 1)">${HALF}</g><rect x="27" y="64" width="46" height="9" rx="2"/><path d="M45 74 L55 74 L50 91 Z"/>`;

export function flagSvg(W = 600) {
  const H = (W * 2) / 3, BAR = W / 9; // croix blanche centrée
  const q = (W - BAR) / 2, qh = (H - BAR) / 2;
  const s = (qh * 0.6) / 100;
  const at = (cx, cy) => `<g fill="#FFFFFF" transform="translate(${cx - 50 * s} ${cy - 47 * s}) scale(${s})">${LYS}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BLUE}"/>
  <rect x="${q}" width="${BAR}" height="${H}" fill="#FFFFFF"/><rect y="${qh}" width="${W}" height="${BAR}" fill="#FFFFFF"/>
  ${at(q / 2, qh / 2)}${at(q + BAR + q / 2, qh / 2)}${at(q / 2, qh + BAR + qh / 2)}${at(q + BAR + q / 2, qh + BAR + qh / 2)}
</svg>`;
}
