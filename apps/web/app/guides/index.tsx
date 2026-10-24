import { BookOpen } from "lucide-react-native";
import { LinkList, Page } from "../../src/components/ArticleView";
import { GUIDES } from "../../src/content/guides";

export default function Guides() {
  return (
    <Page wide eyebrow="Guides" title="L’épicerie, en plus malin." description="Des conseils concrets pour bien manger sans dépasser ton budget : planifier tes repas, lire les circulaires, comparer les prix et gaspiller moins.">
      <LinkList icon={BookOpen} items={GUIDES.map((g) => ({ href: `/guides/${g.slug}`, title: g.title, description: g.description }))} />
    </Page>
  );
}
