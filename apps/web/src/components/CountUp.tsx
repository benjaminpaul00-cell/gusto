// Nombre qui défile jusqu'à sa valeur quand il apparaît à l'écran.
import { useEffect, useRef, useState } from "react";
import { Platform, Text, type StyleProp, type TextStyle } from "react-native";

export function CountUp({ to, format = (n) => String(Math.round(n)), duration = 1400, style }: { to: number; format?: (n: number) => string; duration?: number; style?: StyleProp<TextStyle> }) {
  // Le HTML statique affiche la valeur finale (lisible par Google) ; l'animation part de 0 au chargement.
  const [v, setV] = useState(to);
  const ref = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current as Element | null;
    if (!el) return;
    setV(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <Text ref={ref} style={style}>{format(v)}</Text>;
}
