// Publicité Google AdSense (web). Chargée seulement si l'utilisateur a accepté les témoins.
import { useEffect, useRef } from "react";
import { View } from "react-native";

const CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;
const SLOT = process.env.EXPO_PUBLIC_ADSENSE_SLOT;
let scriptLoaded = false;

export function AdSlot({ consent }: { consent: "all" | "essential" | null }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!CLIENT || !SLOT || consent !== "all") return;
    if (!scriptLoaded) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
      scriptLoaded = true;
    }
    const host: HTMLElement | null = ref.current;
    if (!host || host.childElementCount) return;
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", CLIENT);
    ins.setAttribute("data-ad-slot", SLOT);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    host.appendChild(ins);
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
  }, [consent]);
  if (!CLIENT || !SLOT || consent !== "all") return null;
  return <View ref={ref} style={{ minHeight: 90, marginVertical: 16 }} />;
}
