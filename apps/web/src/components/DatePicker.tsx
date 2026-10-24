// Calendrier mensuel (lundi en premier) pour choisir une date. Les jours passés ne sont pas sélectionnables.
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { font, radius, space, useTheme } from "../theme";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** « lundi 27 octobre » */
export const longDate = (d: Date) => `${WEEKDAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

export function DatePicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const t = useTheme();
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => { const d = value ?? today; return new Date(d.getFullYear(), d.getMonth(), 1); });
  const canGoBack = month > new Date(today.getFullYear(), today.getMonth(), 1);

  // Cases du mois : décalage pour commencer un lundi, puis les jours
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const navBtn = (disabled: boolean): ViewStyle => ({ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1, backgroundColor: t.surface });

  return (
    <View style={{ borderWidth: 2, borderColor: t.edge, borderRadius: radius.lg, padding: space(4), backgroundColor: t.surface, gap: space(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => canGoBack && shift(-1)} disabled={!canGoBack} accessibilityLabel="Mois précédent" accessibilityRole="button" style={navBtn(!canGoBack)}>
          <ChevronLeft size={18} color={t.ink} strokeWidth={2.5} />
        </Pressable>
        <Text style={{ fontFamily: font.display, fontSize: 17, color: t.ink, textTransform: "capitalize" }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
        <Pressable onPress={() => shift(1)} accessibilityLabel="Mois suivant" accessibilityRole="button" style={navBtn(false)}>
          <ChevronRight size={18} color={t.ink} strokeWidth={2.5} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: 12, color: t.muted }}>{w}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 40 }} />;
          const past = d < today;
          const on = !!value && sameDay(d, value);
          const isToday = sameDay(d, today);
          return (
            <View key={i} style={{ width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Pressable onPress={() => !past && onChange(d)} disabled={past} accessibilityRole="button" accessibilityLabel={longDate(d)} accessibilityState={{ selected: on, disabled: past }}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.primary : "transparent", borderWidth: isToday && !on ? 2 : on ? 2 : 0, borderColor: t.edge }}>
                <Text style={{ fontFamily: on ? font.bold : font.medium, fontSize: 14, color: on ? "#FFFFFF" : past ? t.line : t.ink }}>{d.getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
