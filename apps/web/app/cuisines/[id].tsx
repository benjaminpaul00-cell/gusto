import { useLocalSearchParams } from "expo-router";
import { Blocks, Page } from "../../src/components/ArticleView";
import { CUISINE_PAGES, cuisineById } from "../../src/content/cuisines";
import NotFound from "../+not-found";

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
    </Page>
  );
}
