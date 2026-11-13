// Comparer le prix d'un ingrédient : l'utilisateur écrit un ingrédient, on affiche le meilleur prix de chaque épicerie.
import Head from "expo-router/head";
import { ArrowRight, Search, Tag } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, type ViewStyle } from "react-native";
import type { StoreId } from "../../../shared/options";
import { Page } from "../src/components/ArticleView";
import { AdSlot } from "../src/components/AdSlot";
import { Button } from "../src/components/ui";
import { StoreLogo } from "../src/stores";
import { font, money, r, radius, space, useTheme } from "../src/theme";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const IDEAS = ["lait", "œufs", "beurre", "poitrine de poulet", "bœuf haché", "pommes de terre", "fromage cheddar", "bananes"];

interface Offer { store: StoreId; label: string; product: string; size: string; price: number; unitPrice: number; unitLabel: string; discounted: boolean; updatedAt: number; regularPrice: number | null; deal: "vrai" | "plancher" | "faux" | null }
interface Result { ok: boolean; query?: string; ingredient?: string | null; offers?: Offer[]; message?: string }

const unitMoney = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });
const day = (t: number) => new Date(t > 1e12 ? t : t * 1000).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

export default function Prix() {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function look(value = q) {
    const v = value.trim();
    if (v.length < 2 || busy) return;
    setQ(v);
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/prix-ingredient?q=${encodeURIComponent(v)}`);
      setRes((await r.json()) as Result);
    } catch {
      setRes({ ok: false, message: "Connexion impossible pour l’instant. Réessaie dans un moment." });
    }
    setBusy(false);
  }

  const offers = res?.offers ?? [];
  const best = offers[0];
  const worst = offers[offers.length - 1];

  return (
    <Page wide eyebrow="Prix" title="Combien ça coûte, et où ?"
      description="Écris un ingrédient : on compare son prix dans chaque épicerie, au kilo, au litre ou à l’unité.">
      <Head><title>Comparer le prix d’un ingrédient · Gusto</title></Head>

      <View {...r("card-pad", "reveal")} style={{ backgroundColor: t.primary, borderWidth: 2, borderColor: t.edge, borderRadius: radius.xl, boxShadow: `8px 8px 0 ${t.edge}`, padding: space(8), gap: space(4) } as ViewStyle}>
        <View {...r("stack-sm")} style={{ flexDirection: "row", gap: space(3) }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space(2), backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: t.edge, borderRadius: 999, paddingHorizontal: space(5), minHeight: 56 }}>
            <Search size={18} color="#585D82" strokeWidth={2.25} />
            <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => look()} placeholder="ex. beurre, lait 2 %, poitrine de poulet…"
              placeholderTextColor="#8A8FB5" returnKeyType="search" maxLength={60} accessibilityLabel="Ingrédient à comparer"
              style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: "#0E1030", paddingVertical: space(3), outlineStyle: "none" } as any} />
          </View>
          <Button label="Comparer les prix" variant="accent" icon={ArrowRight} onPress={() => look()} loading={busy} disabled={q.trim().length < 2} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), alignItems: "center" }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 14, color: "#C9D0FF" }}>Idées :</Text>
          {IDEAS.map((i) => (
            <Pressable key={i} onPress={() => look(i)} {...r("dim")} accessibilityRole="button"
              style={{ paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: 999, borderWidth: 1.5, borderColor: "#C9D0FF" }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: "#FFFFFF" }}>{i}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <AdSlot consent={null} kind="vertical" />

      {busy && !res ? <ActivityIndicator color={t.primary} style={{ marginTop: space(10) }} /> : null}

      {res && !busy ? (
        !res.ok || !offers.length ? (
          <View {...r("rise")} style={{ marginTop: space(8), padding: space(6), borderRadius: radius.lg, borderWidth: 2, borderStyle: "dashed", borderColor: t.edge, backgroundColor: t.surfaceAlt }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 24, color: t.ink }}>{res.message ?? "Aucun prix trouvé pour cet ingrédient."}</Text>
          </View>
        ) : (
          <View style={{ marginTop: space(10), gap: space(5) }}>
            <View {...r("rise")} style={{ gap: space(1) }}>
              <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 30, color: t.ink }}>
                {res.ingredient ? res.ingredient.charAt(0).toUpperCase() + res.ingredient.slice(1) : res.query}
              </Text>
              {best && worst && offers.length > 1 && worst.unitPrice > best.unitPrice ? (
                <Text style={{ fontFamily: font.medium, fontSize: 15.5, color: t.muted }}>
                  Jusqu’à {Math.round((1 - best.unitPrice / worst.unitPrice) * 100)} % moins cher chez {best.label} que chez {worst.label}, à quantité égale.
                </Text>
              ) : null}
            </View>
            <View style={{ borderTopWidth: 2, borderColor: t.edge }}>
              {offers.map((o, k) => (
                <View key={o.store} {...r("reveal", `d${Math.min(k + 1, 6)}`, "row", "stack-sm")}
                  style={{ flexDirection: "row", alignItems: "center", gap: space(5), paddingVertical: space(5), paddingHorizontal: space(3), borderBottomWidth: 1, borderBottomColor: t.line }}>
                  <View style={{ width: 120, alignItems: "flex-start" }}><StoreLogo id={o.store} label={o.label} maxW={110} maxH={34} /></View>
                  <View style={{ flex: 1, gap: space(1) }}>
                    <View style={{ flexDirection: "row", gap: space(2), flexWrap: "wrap" }}>
                      {k === 0 ? (
                        <View {...r("pop-in")} style={{ paddingHorizontal: space(2.5), paddingVertical: 3, borderRadius: 999, backgroundColor: t.tag, borderWidth: 1.5, borderColor: t.edge }}>
                          <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#0E1030" }}>Le moins cher</Text>
                        </View>
                      ) : null}
                      {o.discounted ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space(2.5), paddingVertical: 3, borderRadius: 999, backgroundColor: t.pink, borderWidth: 1.5, borderColor: t.edge }}>
                          <Tag size={12} color="#0E1030" strokeWidth={2.5} />
                          <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#0E1030" }}>{o.regularPrice ? `−${Math.round((1 - o.price / o.regularPrice) * 100)} %` : "En rabais"}</Text>
                        </View>
                      ) : null}
                      {o.deal === "plancher" ? (
                        <View style={{ paddingHorizontal: space(2.5), paddingVertical: 3, borderRadius: 999, backgroundColor: t.primary, borderWidth: 1.5, borderColor: t.edge }}>
                          <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#FFFFFF" }}>Plus bas prix de l’année</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: font.semibold, fontSize: 15.5, color: t.ink }}>{o.product}</Text>
                    <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.muted }}>
                      {o.size} · prix relevé le {day(o.updatedAt)}
                      {o.regularPrice ? ` · prix régulier ${money(o.regularPrice)}` : ""}
                      {o.deal === "faux" ? " · annoncé en rabais, mais c’est son prix habituel" : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", minWidth: 120 }}>
                    <Text style={{ fontFamily: font.display, fontSize: 28, color: k === 0 ? t.primary : t.ink }}>{money(o.price)}</Text>
                    <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.muted }}>{unitMoney(o.unitPrice)} {o.unitLabel}</Text>
                  </View>
                </View>
              ))}
            </View>
            <AdSlot consent={null} kind="native" />
            <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: t.muted }}>
              Prix relevés chaque semaine dans les grandes épiceries du Québec. Ils peuvent varier selon la succursale. Une épicerie absente n’a pas de prix connu pour ce produit.
            </Text>
          </View>
        )
      ) : null}
    </Page>
  );
}
