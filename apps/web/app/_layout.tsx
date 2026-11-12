import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { ConsentProvider } from "../src/consent";
import { useTheme } from "../src/theme";

function Shell() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, InstrumentSerif_400Regular_Italic,
  });
  // Sur le web, on affiche le texte tout de suite (la police arrive ensuite) : les pages
  // générées à l'avance contiennent ainsi leur contenu, ce qui compte pour Google et AdSense.
  if (!loaded && Platform.OS !== "web") return null;
  return (
    <ConsentProvider>
      <Shell />
    </ConsentProvider>
  );
}
