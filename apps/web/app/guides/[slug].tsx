import { useLocalSearchParams } from "expo-router";
import { Blocks, Page } from "../../src/components/ArticleView";
import { GUIDES, guideBySlug } from "../../src/content/guides";
import NotFound from "../+not-found";

// Pages générées à l'avance, une par guide.
export async function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default function Guide() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const g = guideBySlug(String(slug));
  if (!g) return <NotFound />;
  return (
    <Page eyebrow="Guide" title={g.title} description={g.description} back={{ href: "/guides", label: "Tous les guides" }}>
      <Blocks blocks={g.blocks} />
    </Page>
  );
}
