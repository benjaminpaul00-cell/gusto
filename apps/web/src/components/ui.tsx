// Briques visuelles « pop » : boutons, sections, titres, cartes.
import { Link } from "expo-router";
import type { ComponentType, ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { font, r, radius, space, useTheme, WIDE } from "../theme";

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function Button({
  label, onPress, href, variant = "primary", size = "md", icon: IconC, loading, disabled, full, a11y,
}: {
  label: string; onPress?: () => void; href?: string; variant?: "primary" | "secondary" | "ghost" | "accent" | "pink" | "inverse";
  size?: "sm" | "md" | "lg"; icon?: Icon; loading?: boolean; disabled?: boolean; full?: boolean; a11y?: string;
}) {
  const t = useTheme();
  const pal = {
    primary: { bg: t.primary, fg: "#FFFFFF" },
    secondary: { bg: t.surface, fg: t.ink },
    ghost: { bg: "transparent", fg: t.ink },
    accent: { bg: t.tag, fg: "#0E1030" },
    pink: { bg: t.pink, fg: "#0E1030" },
    inverse: { bg: "#FFFFFF", fg: "#0E1030" },
  }[variant];
  const h = { sm: 42, md: 50, lg: 62 }[size];
  const fs = { sm: 14.5, md: 16, lg: 18 }[size];
  const flat = variant === "ghost" || disabled;
  const content = (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={a11y}
      {...(flat ? {} : r("press"))}
      // Style fixe (pas une fonction) : un lien « asChild » ne transmet pas les styles calculés.
      style={{
        height: h, paddingHorizontal: size === "sm" ? space(4.5) : space(7), borderRadius: 999,
        backgroundColor: pal.bg, borderWidth: variant === "ghost" ? 0 : 2, borderColor: t.edge,
        boxShadow: flat ? undefined : `${size === "sm" ? 3 : 4}px ${size === "sm" ? 3 : 4}px 0 ${t.edge}`,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2),
        alignSelf: full ? "stretch" : "flex-start", opacity: disabled ? 0.4 : 1,
      } as ViewStyle}
    >
      {loading ? <ActivityIndicator color={pal.fg} /> : (
        <>
          <Text style={{ fontFamily: font.bold, fontSize: fs, color: pal.fg }}>{label}</Text>
          {IconC ? <IconC size={fs + 3} color={pal.fg} strokeWidth={2.5} /> : null}
        </>
      )}
    </Pressable>
  );
  return href ? <Link href={href as any} asChild>{content}</Link> : content;
}

/** Bande pleine largeur avec contenu centré. */
export function Section({ children, bg, style, id, narrow, tight }: { children: ReactNode; bg?: string; style?: StyleProp<ViewStyle>; id?: string; narrow?: boolean; tight?: boolean }) {
  return (
    <View nativeID={id} {...r("section")} style={[{ backgroundColor: bg, paddingVertical: tight ? space(16) : space(28) }, style]}>
      <View {...r("gutter")} style={{ width: "100%", maxWidth: narrow ? 820 : WIDE, alignSelf: "center", paddingHorizontal: space(8) }}>
        {children}
      </View>
    </View>
  );
}

/** Petite étiquette au-dessus des titres. */
export function Eyebrow({ children, tone = "pink" }: { children: string; tone?: "pink" | "lemon" | "cobalt" | "white" }) {
  const t = useTheme();
  const bg = { pink: t.pink, lemon: t.tag, cobalt: t.primary, white: "#FFFFFF" }[tone];
  const fg = tone === "cobalt" ? "#FFFFFF" : "#0E1030";
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, borderWidth: 2, borderColor: "#0E1030", paddingHorizontal: space(3.5), paddingVertical: 5, transform: [{ rotate: "-2deg" }] }}>
      <Text style={{ fontFamily: font.bold, fontSize: 13, letterSpacing: 0.4, color: fg }}>{children}</Text>
    </View>
  );
}

/** Titre de section ; `accent` est affiché en serif italique, en couleur. */
export function H2({ children, accent, after, color, accentColor, center }: { children: string; accent?: string; after?: string; color?: string; accentColor?: string; center?: boolean }) {
  const t = useTheme();
  return (
    <Text role="heading" aria-level={2} {...r("h2")} style={{ fontFamily: font.display, fontSize: 56, lineHeight: 60, letterSpacing: -2, color: color ?? t.ink, marginTop: space(5), textAlign: center ? "center" : "left" }}>
      {children}
      {accent ? <Text style={{ fontFamily: font.serif, fontSize: 64, letterSpacing: -0.5, color: accentColor ?? t.primary }}>{accent}</Text> : null}
      {after ?? ""}
    </Text>
  );
}

export function Lead({ children, color, center, max = 620 }: { children: string; color?: string; center?: boolean; max?: number }) {
  const t = useTheme();
  return <Text style={{ fontFamily: font.medium, fontSize: 19, lineHeight: 30, color: color ?? t.muted, marginTop: space(5), maxWidth: max, textAlign: center ? "center" : "left", alignSelf: center ? "center" : "auto" }}>{children}</Text>;
}

/** Pastille carrée contenant une icône. */
export function IconBadge({ icon: IconC, tone = "cobalt", size = 52 }: { icon: Icon; tone?: "cobalt" | "pink" | "lemon" | "white"; size?: number }) {
  const t = useTheme();
  const bg = { cobalt: t.primary, pink: t.pink, lemon: t.tag, white: "#FFFFFF" }[tone];
  const fg = tone === "cobalt" ? "#FFFFFF" : "#0E1030";
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, borderWidth: 2, borderColor: "#0E1030", alignItems: "center", justifyContent: "center", boxShadow: "3px 3px 0 #0E1030" } as ViewStyle}>
      <IconC size={size * 0.46} color={fg} strokeWidth={2.25} />
    </View>
  );
}

export function Card({ children, style, pad = 8, bg }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number; bg?: string }) {
  const t = useTheme();
  return (
    <View {...r("card-pad")} style={[{ backgroundColor: bg ?? t.surface, borderRadius: radius.xl, padding: space(pad), borderWidth: 2, borderColor: t.edge, boxShadow: t.shadowLg } as ViewStyle, style]}>
      {children}
    </View>
  );
}
