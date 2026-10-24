import { useLocalSearchParams } from "expo-router";
import { Blocks, Page } from "../../src/components/ArticleView";
import { CUISINE_PAGES, cuisineById } from "../../src/content/cuisines";
import NotFound from "../+not-found";
import { View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { Button } from "../../src/components/ui";
import { RECIPES_URL } from "../../src/recipesUrl";

// Pages générées à l'avance, une par cuisine.
export async function generateStaticParams() {
  return CUISINE_PAGES.map((c) => ({ id: c.id }));
}

export default function Cuisine() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = cuisineById(String(id));
  if (!c) return <NotFound />;
  return (
    <Page eyebrow="Cuisine" title={c.title} description={c.description} back={{ href: "/cuisines", label: "Toutes les cuisines" }}>
      <Blocks blocks={c.blocks} />
      <View style={{ marginTop: 28, alignItems: "flex-start" }}>
        <Button label="Voir toutes les recettes de cette cuisine" icon={ArrowRight} href={`${RECIPES_URL}/${c.id}`} />
      </View>
    </Page>
  );
}
