import { Check } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";
import { font, space, useTheme } from "../theme";

export function Chip({ label, selected, onPress, radio }: { label: string; selected: boolean; onPress: () => void; radio?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={radio ? "radio" : "checkbox"}
      accessibilityState={radio ? { selected } : { checked: selected }}
      style={({ pressed, focused }: any) => [
        styles.chip,
        { borderColor: t.edge, backgroundColor: selected ? t.primary : t.surface, boxShadow: selected ? `3px 3px 0 ${t.edge}` : "none" },
        pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: "none" },
        focused && { outlineColor: t.pink, outlineWidth: 3, outlineStyle: "solid", outlineOffset: 3 },
      ]}
    >
      {selected ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
      <Text style={[styles.label, { color: selected ? "#FFFFFF" : t.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: space(1.5), height: 44, borderWidth: 2, borderRadius: 999, paddingHorizontal: space(4.5) },
  label: { fontSize: 15, fontFamily: font.semibold },
});
