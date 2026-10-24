import { Text, View } from "react-native";
import { Blocks, Page } from "../src/components/ArticleView";
import { Button } from "../src/components/ui";
import type { Block } from "../src/content/types";
import { useConsent } from "../src/consent";
import { font, radius, space, useTheme } from "../src/theme";

// ─── Personne responsable ───────────────────────────────────────────────────
// Loi 25 : le titre et les coordonnées de la personne responsable de la protection des
// renseignements personnels doivent être publiés ; le nom n'est pas obligatoire.
// Remplissez « nom » pour l'afficher aussi.
const RESPONSABLE = {
  nom: "",
  titre: "Responsable de la protection des renseignements personnels",
  courriel: "info@mongusto.ca",
};
const MISE_A_JOUR = "24 octobre 2026";
// Faites relire ce texte par une personne qualifiée avant le lancement.
// ────────────────────────────────────────────────────────────────────────────

const BEFORE: Block[] = [
  { p: `Dernière mise à jour : ${MISE_A_JOUR}. Cette politique explique quels renseignements Gusto utilise, pourquoi, et quels sont tes droits, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé du Québec (Loi 25).` },
  { h: "En bref" },
  { ul: [
    "Aucun compte : Gusto ne demande ni nom, ni courriel, ni mot de passe.",
    "Tes choix et ton dernier menu restent sur ton appareil.",
    "Les annonces Google ne sont chargées que si tu acceptes les témoins publicitaires. Par défaut, elles sont désactivées.",
  ] },
  { h: "Ce qui reste sur ton appareil" },
  { p: "Tes choix (épicerie, repas, nombre de personnes, cuisines, budget), ton dernier menu et ton choix de témoins sont enregistrés dans le stockage local de ton navigateur. Ils ne sont pas envoyés à Gusto, sauf au moment de créer un menu (voir plus bas). Tu peux les effacer en tout temps en vidant les données du site dans ton navigateur." },
  { h: "Ce que le serveur reçoit" },
  { p: "Pour créer un menu, tes choix sont envoyés au serveur de Gusto, qui calcule le menu et le renvoie. Ces choix ne sont pas conservés. Ils ne permettent pas de t’identifier." },
  { p: "Pour éviter les abus, le serveur compte le nombre de menus créés par jour à partir d’une empreinte chiffrée (hachage) de ton adresse IP et de la date. L’adresse IP elle-même n’est jamais enregistrée par Gusto, et ces compteurs sont effacés chaque jour." },
  { h: "Hébergement et fournisseurs" },
  { ul: [
    "Cloudflare héberge le site et le serveur. Comme tout hébergeur, Cloudflare traite techniquement ton adresse IP pour acheminer les pages et protéger le site contre les attaques. Ses serveurs peuvent être situés à l’extérieur du Québec.",
    "Google AdSense affiche les annonces, seulement si tu les acceptes. Google peut alors utiliser des témoins et des identifiants pour afficher et mesurer des annonces, y compris des annonces personnalisées. Ces données sont traitées par Google, à l’extérieur du Québec, selon ses propres règles.",
    "épiceries.ca fournit les prix. Le serveur de Gusto interroge épiceries.ca ; ton navigateur ne communique pas avec ce site et aucun renseignement à ton sujet ne lui est transmis.",
  ] },
  { p: "Gusto ne vend aucun renseignement personnel et n’en communique à aucun autre tiers." },
  { h: "Témoins et technologies de profilage" },
  { p: "Gusto n’utilise pas de témoins pour son propre fonctionnement : le stockage local sert seulement à garder tes choix sur ton appareil. Les témoins publicitaires de Google, qui peuvent servir au profilage publicitaire, sont désactivés par défaut et ne sont activés que si tu cliques sur « Accepter »." },
];

const AFTER: Block[] = [
  { h: "Tes droits" },
  { p: "Tu peux en tout temps retirer ton consentement aux témoins publicitaires avec le bouton ci-dessus. Comme Gusto ne conserve aucun renseignement qui permet de t’identifier, il n’y a généralement rien à consulter, corriger ou supprimer de notre côté ; tes données locales s’effacent depuis ton navigateur. Pour toute question ou demande, écris à la personne responsable ci-dessous. Une réponse te sera donnée dans un délai de 30 jours." },
  { p: "Si tu n’es pas satisfait de la réponse, tu peux t’adresser à la Commission d’accès à l’information du Québec (cai.gouv.qc.ca)." },
  { h: "Incidents de confidentialité" },
  { p: "En cas d’incident pouvant causer un préjudice sérieux, Gusto avisera la Commission d’accès à l’information et les personnes concernées, comme la loi l’exige." },
  { h: "Sources du contenu" },
  { p: "Les prix proviennent d’épiceries.ca et sont indicatifs ; vérifie toujours en magasin. Les recettes et les images des plats sont générées par intelligence artificielle et les valeurs nutritives sont des estimations." },
  { h: "Changements" },
  { p: "Si cette politique change, la date de mise à jour en haut de la page sera modifiée. Un changement important sera signalé sur le site." },
];

export default function Privacy() {
  const t = useTheme();
  const { consent, choose } = useConsent();
  return (
    <Page eyebrow="Loi 25" title="Confidentialité et témoins" description="Comment Gusto protège tes renseignements personnels : aucun compte, données gardées sur ton appareil, annonces seulement avec ton consentement.">
      <Blocks blocks={BEFORE} cta={false} ads={false} />
      <View style={{ marginTop: space(8), padding: space(6), borderRadius: radius.lg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, gap: space(4) }}>
        <Text style={{ fontFamily: font.semibold, color: t.ink, fontSize: 16.5 }}>
          {`Ton choix actuel : ${consent === "all" ? "témoins publicitaires acceptés" : consent === "essential" ? "témoins publicitaires refusés" : "aucun choix (annonces désactivées)"}.`}
        </Text>
        <View style={{ flexDirection: "row", gap: space(3), flexWrap: "wrap" }}>
          <Button label="Refuser les témoins publicitaires" variant="secondary" size="sm" onPress={() => choose("essential")} />
          <Button label="Accepter" size="sm" onPress={() => choose("all")} />
        </View>
      </View>
      <Blocks blocks={AFTER} cta={false} ads={false} />
      <Text role="heading" aria-level={2} style={{ fontFamily: font.display, fontSize: 30, lineHeight: 36, color: t.ink, marginTop: space(12) }}>Personne responsable</Text>
      <Text style={{ fontFamily: font.body, color: t.ink, fontSize: 18, lineHeight: 31, marginTop: space(4) }}>
        {`${RESPONSABLE.nom ? `${RESPONSABLE.nom}, ` : ""}${RESPONSABLE.titre} de Gusto\nCourriel : ${RESPONSABLE.courriel}`}
      </Text>
    </Page>
  );
}
