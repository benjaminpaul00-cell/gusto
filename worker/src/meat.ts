// Viande, volaille, poisson et fruits de mer : chaque repas doit en contenir (sauf menu végétarien).
// Les œufs ne comptent pas ; un bouillon, une sauce ou un assaisonnement (bouillon de poulet, sauce de poisson) non plus.

import { normalize } from "./epiceries";

const MEAT = new RegExp(
  "\\b(" +
    [
      "boeuf", "bœuf", "porc", "veau", "agneau", "mouton", "chevreau", "cabri", "lapin", "canard", "poulet", "dinde", "volaille", "pintade", "caille",
      "jambon", "bacon", "lardons?", "saucisses?", "saucisson", "chorizo", "pancetta", "prosciutto", "salami", "pepperoni", "merguez", "boudin",
      "smoked meat", "viande", "steak", "bifteck", "cotelettes?", "cotes levees", "filet mignon", "haut de cuisse", "hauts de cuisse",
      "pilons?", "ailes", "poitrines?", "cuisses?", "rosbif", "macreuse", "palette", "surlonge", "bavette", "jarret", "osso buco",
      "carne", "griot", "tasso", "chicharron", "carnitas", "cretons", "tourtiere",
      "thons?", "cabillaud", "saumon", "truite", "morue", "aiglefin", "tilapia", "sole", "plie", "flétan", "fletan", "goberge", "maquereau", "sardines?",
      "poisson", "hareng", "perche", "bar", "vivaneau", "mahi", "espadon", "lotte", "merlu",
      "crevettes?", "petoncles?", "moules?", "homard", "crabe", "calmars?", "seiche", "palourdes?", "huitres?", "mactres?", "langoustines?", "fruits de mer",
    ].join("|") +
    ")\\b",
);
// Ce qui ne fait pas d'un plat un plat de viande : bouillons, sauces, assaisonnements, substituts végétaux
const NOT_MEAT = /\b(bouillon|fond|consomme|sauce|base|cube|assaisonnement|epices?|graisse|saindoux|gelatine|vegetal|vegetalienne?|vegane?|simili|tofu|soya|seitan|tempeh|vegan|beyond|sans viande|haricots?|lentilles?)\b/;

/** L'ingrédient est-il une viande, une volaille, un poisson ou des fruits de mer ? */
export function isMeat(name: string): boolean {
  const n = normalize(name);
  if (NOT_MEAT.test(n)) return false;
  return MEAT.test(n);
}

/** La recette contient-elle de la viande, de la volaille, du poisson ou des fruits de mer ? */
export const hasMeat = (ingredients: { name: string }[]) => ingredients.some((i) => isMeat(i.name));
