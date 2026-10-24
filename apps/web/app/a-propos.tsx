import { Blocks, Page } from "../src/components/ArticleView";
import type { Block } from "../src/content/types";

const BLOCKS: Block[] = [
  { p: "Gusto est un planificateur de menus gratuit, conçu pour le Québec. Tu choisis ton épicerie, les repas à planifier, le nombre de personnes, les cuisines qui te plaisent et ton budget. Gusto prépare un menu pour une à quatre semaines, avec une liste d’épicerie au prix de ta bannière." },
  { h: "Ton budget d’abord" },
  { p: "Gusto ne dépasse jamais le budget que tu entres. Le menu vise environ 95 % du montant, pour absorber les écarts de prix entre les succursales. Le coût est calculé au nombre d’emballages à acheter, comme à la caisse, et non aux grammes utilisés." },
  { ul: [
    "Semaine 1 : les prix de la semaine, rabais compris.",
    "Semaines 2 à 4 : les prix réguliers, plus prudents. Si d’autres rabais arrivent, tu paieras moins.",
    "Le garde-manger (sel, huile, épices) est inclus, mais acheté une seule fois.",
    "Si un ingrédient ne se trouve pas à ton épicerie, Gusto propose une version maison quand c’est possible, ou indique une épicerie spécialisée au prix maximal estimé.",
  ] },
  { h: "D’où viennent les prix" },
  { p: "Les prix proviennent d’épiceries.ca, un comparateur indépendant qui suit les prix de Maxi, Super C, IGA, Metro, Provigo et Walmart. Les prix sont relevés par bannière : ils peuvent varier un peu selon ta succursale. Vérifie toujours en magasin." },
  { h: "D’où viennent les recettes" },
  { p: "Les recettes et les photos des plats sont générées par intelligence artificielle, puis vérifiées automatiquement (ingrédients, quantités, unités). Les valeurs nutritives sont des estimations : elles servent à classer les recettes « Protéiné » ou « Léger », pas à suivre une diète médicale." },
  { h: "Sans compte" },
  { p: "Gusto ne demande ni nom, ni courriel, ni mot de passe. Tes choix et ton dernier menu restent sur ton appareil. Tu peux exporter ton menu en PDF ou l’ajouter à ton calendrier." },
  { h: "Gratuit grâce à la publicité" },
  { p: "Gusto est financé par des annonces Google AdSense, affichées seulement si tu acceptes les témoins publicitaires. Tu peux changer d’idée en tout temps dans la page Confidentialité." },
];

export default function About() {
  return (
    <Page eyebrow="À propos" title="À propos de Gusto" description="Gusto est un planificateur de menus gratuit pour le Québec : un menu et une liste d’épicerie au prix de ton épicerie, sans jamais dépasser ton budget.">
      <Blocks blocks={BLOCKS} />
    </Page>
  );
}
