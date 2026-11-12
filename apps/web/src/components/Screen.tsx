// Coquille des pages : en-tête fixe, contenu défilant, pied de page.
import { forwardRef, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useTheme } from "../theme";
import { AdSlot } from "./AdSlot";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export const Screen = forwardRef<ScrollView, { children: ReactNode; onCta?: () => void; footer?: boolean }>(function Screen({ children, onCta, footer = true }, ref) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <SiteHeader onCta={onCta} />
      <ScrollView ref={ref} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <AdSlot consent={null} kind="horizontal" />
        <View role="main">{children}</View>
        <AdSlot consent={null} kind="horizontal" />
        {footer ? <SiteFooter /> : null}
      </ScrollView>
    </View>
  );
});
