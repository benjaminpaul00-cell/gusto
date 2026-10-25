// Recettes et ingrédients ajoutés depuis la section Recettes, affichés dans « Mon menu ».
import { Link } from "expo-router";
import { BookOpen, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { STORES } from "../../../../shared/options";
import { loadAdditions, saveAdditions, type Addition } from "../sectionApi";
import { font, money, r, radius, space, useTheme } from "../theme";
import { dealText } from "../deal";

export function useAdditions() {
  const [list, setList] = useState<Addition[]>([]);
  useEffect(() => { loadAdditions().then(setList); }, []);
  const remove = (key: string) => { const next = list.filter((a) => a.key !== key); setList(next); saveAdditions(next); };
  return { list, remove };
}

/** Onglet Menu : les recettes ajoutées (avec leur fiche). */
export function AddedRecipes({ list, remove }: { list: Addition[]; remove: (key: string) => void }) {
  const t = useTheme();
  const recipes = list.filter((a) => a.withRecipe);
  if (!recipes.length) return null;
  return (
    <View style={{ gap: space(3) }}>
      <Text style={{ fontFamily: font.display, fontSize: 22, color: t.ink }}>Ajoutées depuis Recettes</Text>
      {recipes.map((a) => (
        <View key={a.key} style={{ flexDirection: "row", alignItems: "center", gap: space(4), padding: space(4), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surface, boxShadow: `4px 4px 0 ${t.edge}` } as any}>
          <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: t.tag, borderWidth: 2, borderColor: t.edge, alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={22} color="#0E1030" strokeWidth={2.25} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Link href={{ pathname: "/recette", params: { id: a.recipeId } }} asChild>
              <Pressable {...r("dim")} accessibilityRole="link"><Text style={{ fontFamily: font.display, fontSize: 17, color: t.ink }}>{a.title}</Text></Pressable>
            </Link>
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: t.muted }}>{a.people} portions · {money(a.total)} · {a.storesLabel}</Text>
          </View>
          <RemoveButton onPress={() => remove(a.key)} />
        </View>
      ))}
    </View>
  );
}

/** Onglet Liste : les ingrédients ajoutés, séparés par épicerie. */
export function AddedGroceries({ list, remove }: { list: Addition[]; remove: (key: string) => void }) {
  const t = useTheme();
  if (!list.length) return null;
  const total = list.reduce((n, a) => n + a.total, 0);
  return (
    <View style={{ gap: space(4), marginTop: space(8) }}>
      <View style={{ gap: space(1) }}>
        <Text style={{ fontFamily: font.display, fontSize: 22, color: t.ink }}>Ajouts depuis Recettes · {money(total)}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: t.muted }}>En plus du total de ton menu. Chaque article est indiqué avec l’épicerie où l’acheter.</Text>
      </View>
      {list.map((a) => (
        <View key={a.key} style={{ gap: space(1), padding: space(4), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: t.ink }}>{a.title} · {a.people} portions</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.ink }}>{money(a.total)}</Text>
            <RemoveButton onPress={() => remove(a.key)} />
          </View>
          {a.items.map((i) => (
            <View key={`${i.ingredient}-${i.product}`} style={{ flexDirection: "row", gap: space(3), paddingVertical: space(1.5), borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14.5, color: t.ink }}>
                {i.packages} × {i.product}
                <Text style={{ color: t.muted }}>{i.store ? ` · chez ${STORES.find((s) => s.id === i.store)?.label}` : ""}{i.discounted ? ` · ${dealText(i)}` : ""}</Text>
              </Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 14.5, color: t.ink }}>{money(i.total)}</Text>
            </View>
          ))}
          {a.pantry.length ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted, marginTop: space(1) }}>Garde-manger à vérifier : {a.pantry.map((p) => p.ingredient).join(", ")}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Retirer cet ajout" {...r("dim")} style={{ padding: space(2) }}>
      <Trash2 size={18} color={t.muted} strokeWidth={2.25} />
    </Pressable>
  );
}
