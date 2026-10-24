// Formes décoratives « pop » (vectorielles, sans image).
import Svg, { Circle, Path } from "react-native-svg";

const NAVY = "#0E1030";

/** Étoile-sticker à 12 branches. */
export function Burst({ size = 120, color = "#FFE14D", stroke = NAVY }: { size?: number; color?: string; stroke?: string }) {
  const pts: string[] = [];
  for (let k = 0; k < 24; k++) {
    const a = (Math.PI * 2 * k) / 24 - Math.PI / 2;
    const rad = k % 2 ? 36 : 48;
    pts.push(`${(50 + rad * Math.cos(a)).toFixed(2)},${(50 + rad * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <Path d={`M${pts.join("L")}Z`} fill={color} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />
    </Svg>
  );
}

/** Trait ondulé (souligné dessiné à la main). */
export function Squiggle({ width = 220, color = "#FF5FA2", strokeWidth = 7 }: { width?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={width} height={width * 0.12} viewBox="0 0 200 24" aria-hidden>
      <Path d="M4 14 C 24 2, 40 2, 56 12 S 92 22, 108 12 S 144 2, 160 12 S 188 20, 196 8" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Demi-cercle. */
export function HalfMoon({ size = 90, color = "#2B44FF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size / 2} viewBox="0 0 100 50" aria-hidden>
      <Path d="M2 48 A48 48 0 0 1 98 48 Z" fill={color} stroke={NAVY} strokeWidth={2.5} />
    </Svg>
  );
}

/** Grille de points (texture). */
export function Dots({ cols = 8, rows = 5, gap = 18, color = "#0E1030", opacity = 0.18 }: { cols?: number; rows?: number; gap?: number; color?: string; opacity?: number }) {
  const w = cols * gap, h = rows * gap;
  const dots = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) dots.push(<Circle key={`${x}-${y}`} cx={x * gap + gap / 2} cy={y * gap + gap / 2} r={2.2} fill={color} opacity={opacity} />);
  return <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>{dots}</Svg>;
}
