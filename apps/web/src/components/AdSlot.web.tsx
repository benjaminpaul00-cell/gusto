// Adsterra : emplacements publicitaires web visibles sans condition de consentement.
// Les applications natives continuent d'utiliser AdSlot.tsx (AdMob à venir).
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

type Consent = "all" | "essential" | null;
type Kind = "horizontal" | "vertical" | "native";

const BANNERS = {
  mobile: { key: "c07038e23aec4c879d29cb1abf93053d", width: 320, height: 50 },
  rectangle: { key: "42b137dddd518207ec3e360ccb3f4280", width: 300, height: 250 },
  desktop: { key: "ccf48721e75697e89265b869169c858b", width: 728, height: 90 },
} as const;
const NATIVE_KEY = "3a4c50f3b209fbd10a81d3b65abded2b";

export function AdSlot({ consent, kind = "horizontal" }: { consent: Consent; kind?: Kind }) {
  const host = useRef<any>(null);
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 0);

  useEffect(() => {
    if (kind === "native") return;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [kind]);

  const format = kind === "vertical" ? BANNERS.rectangle : width >= 760 ? BANNERS.desktop : BANNERS.mobile;

  useEffect(() => {
    const element: HTMLElement | null = host.current;
    if (!element) return;
    element.replaceChildren();

    if (kind === "native") {
      const container = document.createElement("div");
      container.id = `container-${NATIVE_KEY}`;
      element.appendChild(container);
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = `https://bauval.org/21/${NATIVE_KEY}`;
      element.insertBefore(script, container);
    } else {
      // L'annonceur lit atOptions lors de l'exécution du script.
      // L'iframe isole les variables globales des autres publicités.
      const frame = document.createElement("iframe");
      frame.title = "Publicité";
      frame.width = String(format.width);
      frame.height = String(format.height);
      frame.setAttribute("scrolling", "no");
      frame.setAttribute("frameborder", "0");
      frame.style.border = "0";
      frame.style.maxWidth = "100%";
      const doc = `<!doctype html><html><body style="margin:0"><script>var atOptions={key:'${format.key}',format:'iframe',height:${format.height},width:${format.width},params:{}};<\/script><script src="https://bauval.org/22/${format.key}"><\/script></body></html>`;
      frame.srcdoc = doc;
      element.appendChild(frame);
    }
    return () => element.replaceChildren();
  }, [kind, format.key]);

  return (
    <View accessibilityLabel="Emplacement publicitaire" style={{ alignSelf: "center", width: kind === "native" ? "100%" : format.width, maxWidth: "100%", minHeight: kind === "native" ? 170 : format.height + 22, marginVertical: 16, backgroundColor: "#F5F6FA", overflow: "hidden" }}>
      <Text style={{ textAlign: "center", color: "#777777", fontSize: 11, height: 22 }}>Publicité</Text>
      <View ref={host} style={{ width: "100%", minHeight: kind === "native" ? 148 : format.height }} />
    </View>
  );
}
