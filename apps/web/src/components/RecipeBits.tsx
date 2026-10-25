// Morceaux de la section Recettes : étoiles, ligne de recette, palmarès.
import { Image } from "expo-image";
import { Link } from "expo-router";
import { ArrowRight, Clock, Star, Users } from "lucide-react-native";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { duration, ratingText, SOURCE_LABEL, type SectionSummary, type Source } from "../sectionApi";
import { font, r, radius, space, useTheme } from "../theme";

const TONES = [{ bg: "#2B44FF", fg: "#FFFFFF" }, { bg: "#FF5FA2", fg: "#0E1030" }, { bg: "#FFE14D", fg: "#0E1030" }];
const tone = (s: string) => TONES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % 3];

export function SourceBadge({ source }: { source: Source }) {
  const t = useTheme();
  const c = source === "communaute" ? TONES[1] : source === "externe" ? TONES[2] : TONES[0];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: c.bg, borderWidth: 2, borderColor: t.edge, borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: 2 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.fg }}>{SOURCE_LABEL[source]}</Text>
    </View>
  );
}

/** Étoiles en lecture seule, ou cliquables si `onRate` est fourni. */
export function Stars({ value, size = 16, onRate, mine, light }: { value: number | null; size?: number; onRate?: (n: number) => void; mine?: number | null; light?: boolean }) {
  const t = useTheme();
  const shown = mine ?? value ?? 0;
  return (
    <View style={{ flexDirection: "row", gap: onRate ? space(1) : 1 }} accessibilityRole={onRate ? "radiogroup" : "image"}
      accessibilityLabel={onRate ? "Ta note" : `${(value ?? 0).toFixed(1)} étoiles sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = shown >= n - 0.25;
        const star = <Star size={size} color={filled ? "#E8B400" : light ? "rgba(255,255,255,.35)" : t.line} fill={filled ? "#FFE14D" : "transparent"} strokeWidth={2} />;
        return onRate ? (
          <Pressable key={n} onPress={() => onRate(n)} accessibilityRole="radio" accessibilityState={{ selected: mine === n }} accessibilityLabel={`${n} étoile${n > 1 ? "s" : ""}`}
            style={{ padding: 2 }}>{star}</Pressable>
        ) : <View key={n}>{star}</View>;
      })}
    </View>
  );
}

export function RatingLine({ rating, light }: { rating: SectionSummary["rating"]; light?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
      <Stars value={rating.avg} size={14} light={light} />
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: light ? "#C9D0FF" : t.muted }}>{ratingText(rating)}</Text>
    </View>
  );
}

const byLine = (item: SectionSummary) =>
  item.source === "externe"
    ? (!item.author || /cuisinez|télé-québec/i.test(item.author) ? `${item.sourceName}` : `${item.author} · ${item.sourceName}`)
    :item.source === "communaute" ? `Par ${item.author}` : "Recette Gusto";

/** Une ligne de la liste : monogramme coloré, titre, auteur, temps, portions, note. */
export function RecipeRow({ item, index }: { item: SectionSummary; index: number }) {
  const t = useTheme();
  const c = tone(item.title);
  const time = duration((item.prepMin ?? 0) + (item.cookMin ?? 0) || null);
  return (
    <View {...r("reveal", `d${(index % 6) + 1}`)}>
      <Link href={{ pathname: "/recette", params: { id: item.id } }} asChild>
        <Pressable {...r("row")} accessibilityRole="link" accessibilityLabel={`${item.title}, ${byLine(item)}`}
          style={{ flexDirection: "row", alignItems: "center", gap: space(4), paddingVertical: space(4), paddingHorizontal: space(5), borderTopWidth: index ? 1.5 : 0, borderTopColor: t.line }}>
          {item.photo ? (
            <View style={{ width: 112, height: 84, borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, overflow: "hidden", backgroundColor: t.surfaceAlt }}>
              <Image {...r("zoom")} source={{ uri: item.photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
            </View>
          ) : (
            <View {...r("rank")} style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.bg, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: font.display, fontSize: 22, color: c.fg }}>{item.title.trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: font.display, fontSize: 17.5, lineHeight: 22, color: t.ink }}>{item.title}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13.5, color: t.muted }}>{byLine(item)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(3), marginTop: 2 }}>
              <View {...r("only-sm")}><RatingLine rating={item.rating} /></View>
              {time ? <Meta icon={Clock} text={time} /> : null}
              <Meta icon={Users} text={`${item.servings} portions`} />
            </View>
          </View>
          <View {...r("hide-sm")} style={{ alignItems: "flex-end", gap: 4, minWidth: 150 }}>
            <RatingLine rating={item.rating} />
          </View>
          <View {...r("arrow")}><ArrowRight size={20} color={t.primary} strokeWidth={2.5} /></View>
        </Pressable>
      </Link>
    </View>
  );
}

/** Palmarès : les 5 recettes les mieux notées, numérotées. */
export function TopList({ items }: { items: SectionSummary[] }) {
  const t = useTheme();
  if (!items.length) return null;
  return (
    <View {...r("card-pad")} style={{ backgroundColor: "#0E1030", borderRadius: radius.xl, borderWidth: 2, borderColor: t.edge, boxShadow: `8px 8px 0 #FF5FA2`, padding: space(8), gap: space(2) } as ViewStyle}>
      <Text style={{ fontFamily: font.bold, fontSize: 13, letterSpacing: 1.4, textTransform: "uppercase", color: "#FFE14D" }}>Le palmarès</Text>
      <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 30, lineHeight: 36, color: "#FFFFFF", marginBottom: space(3) }}>Les recettes les plus aimées</Text>
      {items.map((it, k) => (
        <View key={it.id} {...r("reveal-left", `d${k + 1}`)}>
          <Link href={{ pathname: "/recette", params: { id: it.id } }} asChild>
            <Pressable {...r("row")} accessibilityRole="link" accessibilityLabel={`Numéro ${k + 1} : ${it.title}`}
              style={{ flexDirection: "row", alignItems: "center", gap: space(5), paddingVertical: space(3.5), paddingHorizontal: space(3), borderRadius: radius.md, borderTopWidth: k ? 1 : 0, borderTopColor: "rgba(255,255,255,.12)" }}>
              <Text {...r("rank")} style={{ fontFamily: font.serif, fontSize: 44, lineHeight: 46, color: k === 0 ? "#FFE14D" : "#FF5FA2", width: 52, textAlign: "center" }}>{k + 1}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: font.display, fontSize: 18, lineHeight: 23, color: "#FFFFFF" }}>{it.title}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13, color: "#B9BEE6" }}>{byLine(it)}</Text>
                <RatingLine rating={it.rating} light />
              </View>
              <View {...r("arrow")}><ArrowRight size={20} color="#FFE14D" strokeWidth={2.5} /></View>
            </Pressable>
          </Link>
        </View>
      ))}
    </View>
  );
}

function Meta({ icon: IconC, text }: { icon: typeof Clock; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
      <IconC size={14} color={t.muted} strokeWidth={2.25} />
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: t.muted }}>{text}</Text>
    </View>
  );
}
