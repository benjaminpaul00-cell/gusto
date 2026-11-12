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

type BannerOptions = { key: string; format: string; height: number; width: number; params: Record<string, never> };
let bannerQueue: Promise<void> = Promise.resolve();
function enqueueBanner(element: HTMLElement, options: BannerOptions) {
  const load = () => new Promise<void>((resolve) => {
    if (!element.isConnected) { resolve(); return; }
    (window as any).atOptions = options;
    const script = document.createElement("script");
    script.src = "https://bauval.org/22/" + options.key;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    element.appendChild(script);
  });
  bannerQueue = bannerQueue.then(load, load);
}


// Diffusion suspendue : Adsterra a affiché une annonce de rencontres inadaptée
// à un site familial. Réactiver après blocage des catégories sensibles côté régie.
export function AdSlot(_props: { consent: Consent; kind?: Kind }) {
  return null;
}
