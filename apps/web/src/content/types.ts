// Blocs de texte des pages de contenu (guides, cuisines, à propos).
export type Block =
  | { h: string } // intertitre
  | { p: string } // paragraphe
  | { ul: string[] } // liste à puces
  | { tip: string }; // encadré « Astuce »

export interface Article {
  slug: string;
  title: string;
  description: string; // phrase pour Google (balise meta description)
  blocks: Block[];
}
