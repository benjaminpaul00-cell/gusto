import Head from "expo-router/head";
import { BookOpen } from "lucide-react-native";
import { LinkList, Page } from "../src/components/ArticleView";

export default function NotFound() {
  return (
    <Page eyebrow="Erreur 404" title="Cette page s’est perdue en chemin." description="Elle n’existe pas ou a été déplacée. Voici où aller ensuite.">
      <Head><meta name="robots" content="noindex" /></Head>
      <LinkList icon={BookOpen} items={[
        { href: "/", title: "Créer un menu", description: "Un menu et une liste d’épicerie au prix de ton épicerie." },
        { href: "/guides", title: "Guides", description: "Conseils pour faire l’épicerie à petit prix." },
      ]} />
    </Page>
  );
}
