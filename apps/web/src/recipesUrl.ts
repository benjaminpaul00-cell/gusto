// Pages de recettes : servies par le script du site (site-worker.js), pas par le routeur de l'app.
// Adresse complète pour forcer un vrai chargement de page.
export const RECIPES_URL = `${(process.env.EXPO_PUBLIC_SITE_URL || "https://mongusto.ca").replace(/\/$/, "")}/recettes`;
