// Diète par macros : bilan de la semaine (moyenne par jour contre la cible), alcool, shake et noix.
import { Beer, Store, Target, Zap } from "lucide-react-native";
import { Text, View, type ViewStyle } from "react-native";
import type { Nutrition } from "../../../../shared/options";
import { font, money, r, radius, space, type Theme } from "../theme";

const nf = (n: number) => Math.round(n).toLocaleString("fr-CA");
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function Bar({ label, value, target, unit, color, t }: { label: string; value: number; target: number; unit: string; color: string; t: Theme }) {
  const pct = target > 0 ? value / target : 0;
  return (
    <View style={{ gap: space(1.5) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space(2) }}>
        <Text style={{ fontFamily: font.bold, fontSize: 14.5, color: t.ink }}>{label}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.muted, fontVariant: ["tabular-nums"] }}>{nf(value)} / {nf(target)} {unit}</Text>
      </View>
      <View style={{ height: 14, borderRadius: 7, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surface, overflow: "hidden" }}>
        <View {...r("bar")} style={{ width: `${Math.min(100, pct * 100)}%`, height: "100%", backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Bilan nutritionnel de la semaine affichée. `week` : numéro de semaine. */
export function NutritionPanel({ n, week, t }: { n: Nutrition; week: number; t: Theme }) {
  const days = n.days.filter((d) => d.week === week);
  const avg = (k: "kcal" | "protein" | "carbs" | "fat") => (days.length ? days.reduce((s, d) => s + d[k], 0) / days.length : 0);
  // Cible des repas planifiés + extras + alcool (le reste de la journée va aux repas non planifiés et aux collations)
  const extrasKcal = n.extras.reduce((s, e) => s + e.kcalPerDay, 0);
  const planned = (k: "kcal" | "protein" | "carbs" | "fat") => (k === "kcal" ? n.target.kcal : n.target[k]);
  return (
    <View {...r("reveal")} style={{ padding: space(6), borderRadius: radius.xl, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surface, boxShadow: `6px 6px 0 #FF5FA2`, gap: space(5) } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#FF5FA2", borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
          <Target size={22} color="#0E1030" strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.display, fontSize: 22, color: t.ink }}>Tes macros</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: t.muted }}>Moyenne par jour, par personne · cible de {nf(n.target.kcal)} calories</Text>
        </View>
      </View>

      <View style={{ gap: space(3.5) }}>
        <Bar label="Calories" value={avg("kcal")} target={planned("kcal")} unit="cal" color="#0E1030" t={t} />
        <Bar label="Protéines" value={avg("protein")} target={planned("protein")} unit="g" color="#2B44FF" t={t} />
        <Bar label="Glucides" value={avg("carbs")} target={planned("carbs")} unit="g" color="#FFE14D" t={t} />
        <Bar label="Lipides" value={avg("fat")} target={planned("fat")} unit="g" color="#FF5FA2" t={t} />
      </View>
      {n.share < 0.99 ? (
        <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: t.muted }}>
          Ton menu planifie environ {Math.round(n.share * 100)} % de tes repas de la journée : il reste environ {nf(n.target.kcal - avg("kcal"))} calories pour tes autres repas et tes collations.
        </Text>
      ) : null}

      {/* Calories jour par jour */}
      <View style={{ flexDirection: "row", gap: space(1.5) }}>
        {days.map((d) => (
          <View key={d.day} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View style={{ width: "100%", height: 56, justifyContent: "flex-end", borderRadius: 8, backgroundColor: t.surfaceAlt, overflow: "hidden", borderWidth: 1.5, borderColor: t.line }}>
              <View {...r("rise")} style={{ height: `${Math.min(100, (d.kcal / n.target.kcal) * 100)}%`, backgroundColor: t.primary }} />
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: t.ink }}>{DAYS[d.day - 1]}</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 10.5, color: t.muted, fontVariant: ["tabular-nums"] }}>{nf(d.kcal)}</Text>
          </View>
        ))}
      </View>

      {n.complements?.length ? (
        <View style={{ gap: space(2), paddingTop: space(4), borderTopWidth: 1.5, borderTopColor: t.line }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Compléments pour atteindre ta cible</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: t.muted }}>
            En moyenne par jour : {n.complements.map((c) => `${nf(c.gramsPerDay)} g de ${c.label.toLowerCase()}`).join(", ")}. À ajouter à tes repas ou en collation ; déjà dans ta liste d’épicerie et ton budget.
          </Text>
          {days.some((d) => d.complements) ? (
            <View style={{ gap: 2 }}>
              {days.filter((d) => d.complements).map((d) => (
                <Text key={d.day} style={{ fontFamily: font.medium, fontSize: 12.5, color: t.muted }}>
                  <Text style={{ fontFamily: font.bold, color: t.ink }}>{DAYS[d.day - 1]}</Text> · {d.complements}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {n.alcohol.length || n.extras.length ? (
        <View style={{ gap: space(2.5), paddingTop: space(4), borderTopWidth: 1.5, borderTopColor: t.line }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>Compté dans ta journée</Text>
          {n.alcohol.map((a) => (
            <View key={a.id} style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start" }}>
              <Beer size={18} color={t.ink} strokeWidth={2.25} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 14.5, color: t.ink }}>{a.label} · {a.perWeek} par semaine ({nf(a.kcalPerWeek / 7)} cal par jour)</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: a.grocery ? t.muted : t.sale }}>
                  {a.grocery
                    ? `À ton épicerie : ${a.buy}. Environ ${money(a.costPerWeek)} par semaine, compté dans ton budget.`
                    : a.mixer
                      ? `${a.buy}. Le ${a.mixer} (environ ${money(a.costPerWeek)} par semaine) est compté dans ton budget ; l’alcool vient de la SAQ, en plus.`
                      : `À la SAQ seulement (pas vendu en épicerie) : ${a.buy}. En plus de ton budget.`}
                </Text>
              </View>
            </View>
          ))}
          {n.extras.map((e) => (
            <View key={e.id} style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start" }}>
              {e.id === "shake" ? <Zap size={18} color={t.ink} strokeWidth={2.25} /> : <Store size={18} color={t.ink} strokeWidth={2.25} />}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 14.5, color: t.ink }}>{e.label} · {e.perDay} {e.unit} par jour ({nf(e.kcalPerDay)} cal)</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted }}>
                  {e.priced ? "Dans ta liste d’épicerie de la semaine 1, pour toute la période." : "Prix non suivi par les épiceries : à prévoir en plus de ton budget."}
                </Text>
              </View>
            </View>
          ))}
          {extrasKcal || n.alcoholKcalPerDay ? (
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: t.muted }}>
              Ces {nf(extrasKcal + n.alcoholKcalPerDay)} calories par jour sont retirées de ce que tes repas doivent fournir.
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={{ fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: t.muted }}>
        Valeurs nutritives estimées. Ce menu ne remplace pas les conseils d’un professionnel de la santé.
      </Text>
    </View>
  );
}
