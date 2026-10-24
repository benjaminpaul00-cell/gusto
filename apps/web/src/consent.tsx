import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadConsent, saveConsent, type Consent } from "./storage";

const Ctx = createContext<{ consent: Consent | null; ready: boolean; choose: (c: Consent) => void }>({
  consent: null,
  ready: false,
  choose: () => {},
});

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadConsent().then((c) => {
      setConsent(c);
      setReady(true);
    });
  }, []);
  const choose = (c: Consent) => {
    setConsent(c);
    saveConsent(c);
  };
  return <Ctx.Provider value={{ consent, ready, choose }}>{children}</Ctx.Provider>;
}

export const useConsent = () => useContext(Ctx);
