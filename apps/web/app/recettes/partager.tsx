// Formulaire « Partager ma recette » : ingrédients structurés, étapes, photo facultative, pseudo.
// La recette est publiée seulement après modération.
import { Image } from "expo-image";
import { Camera, Check, Plus, Send, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { Page } from "../../src/components/ArticleView";
import { Button } from "../../src/components/ui";
import { isError, shareRecipe } from "../../src/sectionApi";
import { font, r, radius, space, useTheme } from "../../src/theme";

const UNITS = [
  { id: "unite", label: "unité(s)" }, { id: "g", label: "g" }, { id: "kg", label: "kg" }, { id: "ml", label: "ml" }, { id: "l", label: "L" },
  { id: "cat", label: "c. à thé" }, { id: "cas", label: "c. à soupe" }, { id: "tasse", label: "tasse" }, { id: "pincee", label: "pincée" },
];
interface Row { qty: string; unit: string; name: string }

export default function Partager() {
  const t = useTheme();
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("4");
  const [prep, setPrep] = useState("");
  const [cook, setCook] = useState("");
  const [rows, setRows] = useState<Row[]>([{ qty: "", unit: "unite", name: "" }, { qty: "", unit: "g", name: "" }, { qty: "", unit: "ml", name: "" }]);
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [author, setAuthor] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [openUnit, setOpenUnit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setRow = (k: number, patch: Partial<Row>) => setRows(rows.map((x, i) => (i === k ? { ...x, ...patch } : x)));

  function pickPhoto() {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const img = new window.Image();
      img.onload = () => {
        // Réduite à 1600 px au plus (photo de téléphone trop lourde sinon)
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        setPhoto(c.toDataURL("image/jpeg", 0.85));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  }

  async function submit() {
    setMsg(null);
    if (!rights) { setMsg({ ok: false, text: "Coche la case qui confirme que tu as le droit de partager cette recette et cette photo." }); return; }
    setBusy(true);
    const res = await shareRecipe({
      title, servings: Number(servings), prepMin: prep ? Number(prep) : null, cookMin: cook ? Number(cook) : null,
      ingredients: rows.filter((x) => x.name.trim()), steps: steps.filter((s) => s.trim()), author, photo, rights,
    });
    setBusy(false);
    if (isError(res) || !res.ok) { setMsg({ ok: false, text: (res as any).message ?? "Envoi impossible pour l’instant." }); return; }
    setMsg({ ok: true, text: "Merci! Ta recette a été reçue. Elle sera publiée après une vérification rapide." });
    setTitle(""); setRows([{ qty: "", unit: "unite", name: "" }]); setSteps([""]); setPhoto(null); setRights(false);
  }

  const label = (text: string, hint?: string) => (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: t.ink }}>{text}</Text>
      {hint ? <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: t.muted }}>{hint}</Text> : null}
    </View>
  );

  return (
    <Page eyebrow="Recettes" title="Partager ma recette" description="Ta recette sera publiée dans la section Recettes après une vérification rapide, avec ton pseudo.">
      {msg?.ok ? (
        <View accessibilityRole="alert" style={{ padding: space(6), borderRadius: radius.lg, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tagSoft, gap: space(4) }}>
          <Text style={{ fontFamily: font.display, fontSize: 24, color: t.ink }}>Recette envoyée!</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 16, lineHeight: 24, color: t.ink }}>{msg.text}</Text>
          <View style={{ flexDirection: "row", gap: space(3), flexWrap: "wrap" }}>
            <Button label="Voir les recettes" href="/recettes" />
            <Button label="En partager une autre" variant="secondary" onPress={() => setMsg(null)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space(8) }}>
          <View style={{ gap: space(2) }}>
            {label("Titre de la recette")}
            <Field value={title} onChangeText={setTitle} placeholder="ex. Pâté chinois de ma grand-mère" maxLength={120} />
          </View>

          <View {...r("stack-sm")} style={{ flexDirection: "row", gap: space(4) }}>
            <View style={{ flex: 1, gap: space(2) }}>{label("Portions")}<Field value={servings} onChangeText={(v) => setServings(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={2} /></View>
            <View style={{ flex: 1, gap: space(2) }}>{label("Préparation (min)")}<Field value={prep} onChangeText={(v) => setPrep(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="20" maxLength={4} /></View>
            <View style={{ flex: 1, gap: space(2) }}>{label("Cuisson (min)")}<Field value={cook} onChangeText={(v) => setCook(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="45" maxLength={4} /></View>
          </View>

          <View style={{ gap: space(3) }}>
            {label("Ingrédients", "Une ligne par ingrédient : quantité, unité et nom (ex. 500 · g · bœuf haché).")}
            {rows.map((row, k) => (
              <View key={k} style={{ gap: space(2) }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), alignItems: "center" }}>
                  <Field value={row.qty} onChangeText={(v) => setRow(k, { qty: v.replace(/[^0-9.,/]/g, "") })} placeholder="Qté" keyboardType="decimal-pad" style={{ width: 72 }} accessibilityLabel={`Quantité, ingrédient ${k + 1}`} />
                  <Pressable onPress={() => setOpenUnit(openUnit === k ? null : k)} accessibilityRole="button" accessibilityLabel={`Unité : ${UNITS.find((u) => u.id === row.unit)?.label}`}
                    style={{ height: 48, minWidth: 104, paddingHorizontal: space(3), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 14.5, color: t.ink }}>{UNITS.find((u) => u.id === row.unit)?.label} ▾</Text>
                  </Pressable>
                  <Field value={row.name} onChangeText={(v) => setRow(k, { name: v })} placeholder="Ingrédient" style={{ flexGrow: 1, flexBasis: 160, minWidth: 140 }} maxLength={80} accessibilityLabel={`Nom, ingrédient ${k + 1}`} />
                  <Pressable onPress={() => setRows(rows.filter((_, i) => i !== k))} disabled={rows.length <= 1} accessibilityRole="button" accessibilityLabel="Retirer cet ingrédient" style={{ padding: space(2), opacity: rows.length <= 1 ? 0.3 : 1 }}>
                    <Trash2 size={18} color={t.muted} strokeWidth={2.25} />
                  </Pressable>
                </View>
                {openUnit === k ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
                    {UNITS.map((u) => (
                      <Pressable key={u.id} onPress={() => { setRow(k, { unit: u.id }); setOpenUnit(null); }} accessibilityRole="radio" accessibilityState={{ selected: row.unit === u.id }}
                        style={{ paddingHorizontal: space(3), height: 36, justifyContent: "center", borderRadius: 999, borderWidth: 2, borderColor: t.edge, backgroundColor: row.unit === u.id ? t.tag : t.surface }}>
                        <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: t.ink }}>{u.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
            <Button label="Ajouter un ingrédient" icon={Plus} variant="secondary" size="sm" onPress={() => setRows([...rows, { qty: "", unit: "unite", name: "" }])} disabled={rows.length >= 40} />
          </View>

          <View style={{ gap: space(3) }}>
            {label("Étapes")}
            {steps.map((st, k) => (
              <View key={k} style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start" }}>
                <View style={{ width: 32, height: 32, marginTop: 8, borderRadius: 16, borderWidth: 2, borderColor: t.edge, backgroundColor: t.tag, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.display, fontSize: 14, color: "#0E1030" }}>{k + 1}</Text>
                </View>
                <Field value={st} onChangeText={(v) => setSteps(steps.map((x, i) => (i === k ? v : x)))} placeholder="Décris l’étape" multiline style={{ flex: 1, minHeight: 72, paddingTop: space(3) }} maxLength={1000} accessibilityLabel={`Étape ${k + 1}`} />
                <Pressable onPress={() => setSteps(steps.filter((_, i) => i !== k))} disabled={steps.length <= 1} accessibilityRole="button" accessibilityLabel="Retirer cette étape" style={{ padding: space(2), marginTop: 6, opacity: steps.length <= 1 ? 0.3 : 1 }}>
                  <Trash2 size={18} color={t.muted} strokeWidth={2.25} />
                </Pressable>
              </View>
            ))}
            <Button label="Ajouter une étape" icon={Plus} variant="secondary" size="sm" onPress={() => setSteps([...steps, ""])} disabled={steps.length >= 30} />
          </View>

          <View style={{ gap: space(3) }}>
            {label("Photo (facultatif)", "JPEG, PNG ou WebP. Seulement une photo que tu as prise toi-même.")}
            {photo ? (
              <View style={{ gap: space(2) }}>
                <Image source={{ uri: photo }} style={{ width: 260, aspectRatio: 4 / 3, borderRadius: radius.md, borderWidth: 2, borderColor: t.edge }} contentFit="cover" />
                <Button label="Retirer la photo" variant="ghost" size="sm" onPress={() => setPhoto(null)} />
              </View>
            ) : <Button label="Choisir une photo" icon={Camera} variant="secondary" size="sm" onPress={pickPhoto} />}
          </View>

          <View style={{ gap: space(2) }}>
            {label("Ton pseudo", "Affiché avec ta recette. Évite ton nom complet.")}
            <Field value={author} onChangeText={setAuthor} placeholder="ex. MarieDeLaval" maxLength={40} />
          </View>

          <Pressable onPress={() => setRights(!rights)} accessibilityRole="checkbox" accessibilityState={{ checked: rights }}
            style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start", padding: space(4), borderRadius: radius.md, borderWidth: 2, borderColor: t.edge, backgroundColor: rights ? t.tagSoft : t.surface }}>
            <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: t.edge, backgroundColor: rights ? t.primary : t.surface, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {rights ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, lineHeight: 22, color: t.ink }}>
              Je confirme que cette recette et cette photo m’appartiennent ou que j’ai le droit de les partager.
            </Text>
          </Pressable>

          {msg && !msg.ok ? <Text accessibilityRole="alert" style={{ fontFamily: font.semibold, fontSize: 15, color: t.danger }}>{msg.text}</Text> : null}
          <Button label="Envoyer ma recette" icon={Send} size="lg" variant="pink" onPress={submit} loading={busy} />
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: t.muted }}>
            Les recettes sont vérifiées avant d’être publiées. Gusto peut refuser une recette incomplète, copiée d’un livre ou d’un site, ou dont la photo ne t’appartient pas.
          </Text>
        </View>
      )}
    </Page>
  );
}

function Field(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput placeholderTextColor={t.muted} {...props}
      style={[{ minHeight: 48, borderWidth: 2, borderColor: t.edge, borderRadius: radius.md, paddingHorizontal: space(3.5), fontFamily: font.medium, fontSize: 16, color: t.ink, backgroundColor: t.surface } as ViewStyle, props.style as any]} />
  );
}
