import { Utensils } from "lucide-react-native";
import { LinkList, Page } from "../../src/components/ArticleView";
import { CUISINE_PAGES } from "../../src/content/cuisines";

export default function Cuisines() {
  return (
    <Page wide eyebrow="Cuisines" title="Douze cuisines, pensées pour les épiceries d’ici." description="De la québécoise à la thaïlandaise : des plats économiques et où trouver les ingrédients au Québec.">
      <LinkList icon={Utensils} items={CUISINE_PAGES.map((c) => ({ href: `/cuisines/${c.id}`, title: c.title, description: c.description }))} />
    </Page>
  );
}
