// Texte d'un rabais dans la liste d'épicerie, d'après l'historique des prix d'épiceries.ca.
import type { ListItem } from "../../../shared/options";
import { money } from "./theme";

/** « −22 % (rég. 8,99 $) · plus bas prix de l'année », « en rabais » si le prix régulier est inconnu, sinon null. */
export function dealText(i: Pick<ListItem, "discounted" | "regularPrice" | "deal" | "unitPrice">): string | null {
  if (!i.discounted) return null;
  if (!i.regularPrice || i.regularPrice <= i.unitPrice) return "en rabais";
  const pct = Math.round((1 - i.unitPrice / i.regularPrice) * 100);
  return `−${pct} % (rég. ${money(i.regularPrice)})${i.deal === "plancher" ? " · plus bas prix de l’année" : ""}`;
}
