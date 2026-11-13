// Section Recettes : recherche, palmarès des mieux notées et liste animée des recettes de sites québécois et de la communauté.
import { router } from "expo-router";
import { ArrowRight, PenLine, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View, type ViewStyle } from "react-native";
import { Page } from "../../src/components/ArticleView";
import { AdSlot } from "../../src/components/AdSlot";
import { Chip } from "../../src/components/Chip";
import { RecipeRow, TopList } from "../../src/components/RecipeBits";
import { Button } from "../../src/components/ui";
import { isError, listRecipes, searchRecipe, type SectionSummary } from "../../src/sectionApi";
import { font, r, radius, space, useTheme } from "../../src/theme";

const SOURCES = [{ id: "", label: "Toutes" }, { id: "externe", label: "Sites québécois" }, { id: "communaute", label: "Communauté" }];
const SORTS = [{ id: "", label: "Mieux notées" }, { id: "recentes", label: "Plus récentes" }];

export default function Recettes() {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [tri, setTri] = useState("");
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState<SectionSummary[] | null>(null);
  const [top, setTop] = useState<SectionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async (offset = 0) => {
    const res = await listRecipes({ source, tri, q: filter, offset });
    if (isError(res)) { setError(res.message); setItems((x) => x ?? []); return; }
    setError(null);
    setTotal(res.total);
    setItems((prev) => (offset ? [...(prev ?? []), ...res.items] : res.items));
  };
  useEffect(() => { setItems(null); load(0); }, [source, tri, filter]);
  // Palmarès : les 5 mieux notées, toutes sources confondues
  useEffect(() => { listRecipes({}).then((res) => { if (!isError(res)) setTop(res.items.filter((i) => i.rating.count).slice(0, 5)); }); }, []);

  async function search() {
    if (q.trim().length < 3 || searching) return;
    setSearching(true);
    setSearchError(null);
    const res = await searchRecipe(q.trim());
    setSearching(false);
    if (isError(res) || !res.ok || !res.id) { setSearchError((res as any).message ?? "Recherche impossible pour l’instant."); return; }
    router.push({ pathname: "/recette", params: { id: res.id } });
  }

  return (
    <Page wide eyebrow="Recettes" title="Trouve ta prochaine recette"
      description="Cherche n’importe quel plat, découvre les recettes préférées des Québécois et vois combien elles coûtent à ton épicerie.">
      {/* Recherche */}
      <View {...r("card-pad", "reveal")} style={{ backgroundColor: t.primary, borderWidth: 2, borderColor: t.edge, borderRadius: radius.xl, boxShadow: `8px 8px 0 ${t.edge}`, padding: space(8), gap: space(4) } as ViewStyle}>
        <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 32, lineHeight: 38, color: "#FFFFFF" }}>
          Quel plat te fait <Text style={{ fontFamily: font.serif, color: "#FFE14D" }}>envie</Text> ?
        </Text>
        <View {...r("stack-sm")} style={{ flexDirection: "row", gap: space(3) }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space(2), backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: t.edge, borderRadius: 999, paddingHorizontal: space(5), minHeight: 56 }}>
            <Search size={18} color="#585D82" strokeWidth={2.25} />
            <TextInput value={q} onChangeText={(v) => { setQ(v); setSearchError(null); }} onSubmitEditing={search} placeholder="ex. pâté chinois, poulet au beurre, pad thaï…"
              placeholderTextColor="#8A8FB5" returnKeyType="search" maxLength={80} accessibilityLabel="Plat à rechercher"
              style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: "#0E1030", paddingVertical: space(3), outlineStyle: "none" } as any} />
          </View>
          <Button label="Trouver la recette" variant="accent" icon={ArrowRight} onPress={search} loading={searching} disabled={q.trim().length < 3} />
        </View>
        {searching ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: "#DDE2FF" }}>Recherche de ta recette et calcul des prix…</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: "#DDE2FF" }}>Avec les quantités, les étapes et le prix à ton épicerie.</Text>
        )}
        {searchError ? <Text accessibilityRole="alert" style={{ fontFamily: font.semibold, fontSize: 15, color: "#FFFFFF", backgroundColor: "rgba(255,95,162,.35)", padding: space(3), borderRadius: radius.md }}>{searchError}</Text> : null}
      </View>

      <AdSlot consent={null} kind="vertical" />

      {/* Palmarès et partage */}
      <View {...r("stack-md")} style={{ flexDirection: "row", gap: space(8), marginTop: space(12), alignItems: "stretch" }}>
        <View style={{ flex: 1.5 }}><TopList items={top} /></View>
        <View {...r("reveal", "d2")} style={{ flex: 1, padding: space(7), borderWidth: 2, borderColor: t.edge, borderRadius: radius.xl, backgroundColor: t.tagSoft, gap: space(4), justifyContent: "center" }}>
          <Text style={{ fontFamily: font.bold, fontSize: 13, letterSpacing: 1.4, textTransform: "uppercase", color: t.pink }}>Communauté</Text>
          <Text style={{ fontFamily: font.display, fontSize: 26, lineHeight: 32, color: t.ink }}>Ta recette mérite d’être <Text style={{ fontFamily: font.serif, color: t.primary }}>goûtée</Text>.</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 15, lineHeight: 23, color: t.muted }}>Partage-la avec ton pseudo. Elle sera publiée après une vérification rapide, et les autres pourront la noter.</Text>
          <Button label="Partager ma recette" icon={PenLine} variant="pink" href="/recettes/partager" />
        </View>
      </View>

      {/* Liste */}
      <View style={{ marginTop: space(14), gap: space(5) }}>
        <View {...r("stack-sm")} style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space(4) }}>
          <View style={{ gap: space(1) }}>
            <Text role="heading" aria-level={2} {...r("reveal")} style={{ fontFamily: font.display, fontSize: 34, letterSpacing: -1, color: t.ink }}>Toutes les recettes</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.muted }}>{items ? `${total} recette${total > 1 ? "s" : ""}` : " "}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), borderWidth: 2, borderColor: t.edge, borderRadius: 999, paddingHorizontal: space(4), minHeight: 46, backgroundColor: t.surface, minWidth: 260 }}>
            <Search size={16} color={t.muted} strokeWidth={2.25} />
            <TextInput value={filter} onChangeText={setFilter} placeholder="Filtrer par nom" placeholderTextColor={t.muted} accessibilityLabel="Filtrer les recettes par nom"
              style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: t.ink, outlineStyle: "none" } as any} />
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), alignItems: "center" }}>
          {SOURCES.map((s) => <Chip key={s.id} radio label={s.label} selected={source === s.id} onPress={() => setSource(s.id)} />)}
          <View style={{ width: 2, height: 28, backgroundColor: t.line, marginHorizontal: space(2) }} />
          {SORTS.map((s) => <Chip key={s.id} radio label={s.label} selected={tri === s.id} onPress={() => setTri(s.id)} />)}
        </View>

        {items && items.length > 0 ? <AdSlot consent={null} kind="native" /> : null}
        {error ? <Text accessibilityRole="alert" style={{ fontFamily: font.semibold, fontSize: 15, color: t.danger }}>{error}</Text> : null}
        {items === null ? <ActivityIndicator color={t.primary} style={{ marginVertical: space(10) }} /> : items.length === 0 ? (
          <Text style={{ fontFamily: font.medium, fontSize: 16, color: t.muted, marginVertical: space(8) }}>
            {filter ? "Aucune recette ne porte ce nom. Essaie la recherche plus haut." : "Aucune recette ici pour l’instant."}
          </Text>
        ) : (
          <View style={{ borderWidth: 2, borderColor: t.edge, borderRadius: radius.xl, backgroundColor: t.surface, boxShadow: `6px 6px 0 ${t.edge}`, overflow: "hidden" } as ViewStyle}>
            {items.map((it, k) => <RecipeRow key={it.id} item={it} index={k} />)}
          </View>
        )}
        {items && items.length < total ? (
          <View style={{ alignItems: "center", marginTop: space(2) }}>
            <Button label={`Voir plus de recettes (${total - items.length})`} variant="secondary" onPress={() => load(items.length)} />
          </View>
        ) : null}
        <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: t.muted, marginTop: space(4) }}>
          Les recettes de sites québécois sont résumées dans nos mots, avec l’auteur et un lien vers la recette originale. Les notes combinent les avis du site d’origine et ceux de Gusto; le classement tient compte du nombre d’avis.
        </Text>
      </View>
    </Page>
  );
}
