# Gusto

Planificateur de menus pour le Québec : l’utilisateur choisit son épicerie, ses repas, la durée, le nombre de personnes, les cuisines, le genre de repas et son budget. Gusto produit un menu avec images, une liste d’épicerie au prix réel, et l’exporte en PDF ou dans le calendrier. Aucun compte, aucun abonnement.

**En ligne :** site https://gusto.benjaminpaul00.workers.dev · API https://gusto-api.benjaminpaul00.workers.dev

## Architecture

```
apps/web/      Site web en Expo (React Native), pages statiques servies par un Worker Cloudflare
               (wrangler.jsonc). Le même code servira plus tard aux apps iOS et Android.
worker/        API sur Cloudflare Workers
  src/planner.ts   Calcul du menu et du budget (code pur, sans IA)
  src/jobs.ts      Tâches d'arrière-plan : recettes, infos d'ingrédients, photos
  src/ai.ts        Fournisseurs d'IA en cascade (Gemini → Mistral → Groq → IA Cloudflare)
  src/epiceries.ts Recherche de produits sur épiceries.ca (catégories, pertinence, formats)
  src/images.ts    Stockage des photos : R2 si branché, sinon Workers KV (gratuit)
  scripts/prix.mjs        Récupère les prix depuis un ordinateur (voir « Prix »)
  scripts/generer.mjs     Accélère la génération (lots manuels) et affiche la progression
  scripts/nouveau-jeton.mjs Crée un nouvel ADMIN_TOKEN, gardé dans worker/.admin-token
shared/        Options et types communs (épiceries, cuisines, seuils…)
```

**Principe central : l’IA n’est jamais sur le chemin de l’utilisateur.** Quand un visiteur crée un menu, l’API pioche dans la banque de recettes déjà prêtes et calcule tout avec du code classique. L’IA travaille seulement en arrière-plan (toutes les 10 minutes) pour enrichir la banque. Quota épuisé : la tâche est reportée (15 min pour une limite par minute, 6 h pour un quota du jour) et le site continue de fonctionner.

Services Cloudflare utilisés, tous gratuits sans carte de crédit : Workers (API et site), D1 (base de données), KV (photos), Workers AI (photos), Cron Triggers.

### Comment une semaine est calculée

- Le menu vise 95 % du budget (`BUDGET_SAFETY` dans `shared/options.ts`) pour absorber les écarts entre succursales.
- Le coût est calculé au nombre d’emballages achetés. Jusqu’à 3 formats par produit et par bannière sont gardés ; le calcul prend celui qui coûte le moins pour la quantité réelle (deux gousses d’ail → petit format, pas le sac de 1 kg).
- Les quantités d’une même semaine sont additionnées (« œufs » et « oeuf » comptent ensemble), donc les restes servent d’une recette à l’autre.
- Semaine 1 : prix réels, rabais compris. Semaines 2 à 4 : prix réguliers, plus prudents.
- Garde-manger (sel, huile, épices) : inclus dans le total, acheté une seule fois en semaine 1. L’eau est gratuite.
- Ingrédient non suivi dans la bannière choisie : formats relevés ailleurs, majorés de 10 %, affichés « prix estimé ».
- Ingrédient introuvable partout : sous-recette maison si possible, sinon épicerie spécialisée au prix estimé maximal.
- Variété : au plus 2 fois le même plat par semaine quand c’est possible, jamais deux jours de suite.
- Budget impossible : l’API refuse et propose le budget minimum.

## Prix : récupérés depuis un ordinateur

épiceries.ca est protégé par Cloudflare et répond par un captcha aux requêtes qui viennent des serveurs (dont notre API). Il répond normalement à un ordinateur ordinaire. Donc :

1. L’API prépare chaque ingrédient avec l’IA (rayon, termes de recherche québécois, catégories épiceries.ca).
2. `worker/scripts/prix.mjs`, lancé **depuis un ordinateur**, demande à l’API les ingrédients à mettre à jour (`GET /admin/prices/pending`), cherche les produits sur épiceries.ca (3 requêtes par seconde au plus) et envoie les résultats (`POST /admin/prices`). Les prix sont revérifiés après 5 jours.
3. Un ingrédient introuvable est renvoyé une fois à l’IA pour d’autres termes (tâche `retry_terms`).

Sur l’ordinateur de développement, la tâche Windows **« Gusto - prix »** lance `worker\scripts\prix-quotidien.cmd` toutes les 3 heures, pour que les nouvelles recettes deviennent vite utilisables. Journal : `worker/prix.log`. Pour la retirer : Planificateur de tâches → « Gusto - prix » → Supprimer.

La solution durable : qu’épiceries.ca autorise l’API (brouillon de courriel dans `docs/courriel-epiceries.md`). Il suffira alors de laisser l’API chercher elle-même (c’est déjà prévu dans `resolveIngredient`).

## Mise en route (nouvelle installation)

Prérequis : Node 22 ou plus, un compte Cloudflare, une clé Groq gratuite (console.groq.com, sans carte de crédit).

Sous Windows PowerShell, utilisez `npx.cmd` au lieu de `npx` si les scripts sont bloqués.

```bash
cd worker && npm install && npm test
cd ../apps/web && npm install
```

```bash
cd worker
npx wrangler login
npx wrangler d1 create gusto                     # copier l'identifiant dans wrangler.toml (database_id)
npx wrangler kv namespace create gusto-images    # copier l'identifiant dans wrangler.toml (kv_namespaces)
npm run db:init
npx wrangler secret put IP_SALT                  # une chaîne aléatoire
npx wrangler secret put GROQ_API_KEY
node scripts/nouveau-jeton.mjs                   # crée l'ADMIN_TOKEN et le garde dans worker/.admin-token
npx wrangler deploy
```

Mettez l’adresse de l’API dans `PUBLIC_API_URL` (`wrangler.toml`), et celle du site dans `ALLOWED_ORIGIN`.

Site :

```bash
cd apps/web
npm run build:web          # avec EXPO_PUBLIC_API_URL et EXPO_PUBLIC_SITE_URL (fichier .env)
npx wrangler deploy        # utilise apps/web/wrangler.jsonc
```

Banque de départ et prix :

```bash
cd worker
node scripts/generer.mjs --tours 30   # met en file la banque si elle est vide, puis accélère
node scripts/prix.mjs                 # prix des ingrédients prêts
```

Suivi : `GET /admin/status` (recettes, photos, tâches, dernières erreurs), `GET /admin/images` (grille des photos, regénérer ou retirer une recette), `GET /admin/ai-models` (modèles Groq disponibles). Toutes les routes `/admin` demandent l’en-tête `Authorization: Bearer <ADMIN_TOKEN>` ou `?token=`.

### Passer les photos à R2 (facultatif)

KV suffit pour la banque de départ (1 Go, 1 000 écritures par jour). Pour R2 : activer R2 dans le tableau de bord (carte de crédit demandée), `npx wrangler r2 bucket create gusto-images`, décommenter `[[r2_buckets]]` dans `wrangler.toml`, redéployer, puis `POST /admin/images-backfill`.

### Développement local

```bash
cd worker && npm run db:init:local && npm run dev      # API sur http://localhost:8787
cd apps/web && npm run web                             # EXPO_PUBLIC_API_URL=http://localhost:8787 dans .env
```

### Déploiement automatique avec GitHub (facultatif)

`.github/workflows/deploy.yml` teste et déploie l’API puis le site à chaque `push` sur `main`. Secrets du dépôt : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Variables : `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_ADSENSE_CLIENT`, `EXPO_PUBLIC_ADSENSE_SLOT`.

## Identité visuelle

- **Style « Pop québécois »** : cobalt `#2B44FF`, rose vif `#FF5FA2`, citron `#FFE14D`, marine `#0E1030`, sur fond blanc. Bordures marine franches et ombres décalées. Tout est dans `src/theme.ts` (avec mode sombre).
- **Logo** : une étiquette de prix inclinée portant un « g ». Tracés vectoriels dans `src/components/logoPaths.ts`, composant `src/components/Logo.tsx`, favicon `public/favicon.svg`, icône d’app `assets/icon.png`, image de partage `public/og.png`. Le PDF utilise les mêmes tracés.
- **Polices** : Plus Jakarta Sans (titres et texte) et Instrument Serif italique (mots mis en valeur).
- **Animations** : CSS dans `app/+html.tsx` (apparition au défilement, flottement, défilement des logos, boutons « pop »). Un composant s’y accroche avec `{...r("reveal", "d2")}`. Coupées si le visiteur a activé « réduire les animations ».
- **Planificateur** : `src/components/Wizard.tsx`, une question à la fois (Entrée pour continuer).
- **Logos des épiceries** : `public/epiceries/` (source : Wikimedia Commons et Wikipédia). Marques de commerce de leurs propriétaires, utilisées seulement pour identifier les bannières ; une mention figure dans le pied de page.

## Publicité

- Web : AdSense, chargé seulement après le consentement aux témoins (Loi 25). Remplacez l’identifiant dans `apps/web/public/ads.txt`.
- AdSense n’accepte pas les adresses `*.workers.dev` : il faut un nom de domaine à soi.
- Le site est généré en pages HTML statiques avec du contenu indexable : `/guides` (7 guides), `/cuisines` (12 pages), `/a-propos`, `/confidentialite`. `npm run build:web` produit aussi `sitemap.xml` et `robots.txt`. Soumettez `sitemap.xml` dans Google Search Console avant de demander l’approbation AdSense.
- Apps : AdMob, à brancher dans `src/components/AdSlot.tsx` au moment de créer les apps.

## Apps iOS et Android

Le code est déjà compatible. Les exports utilisent automatiquement `expo-print` et `expo-sharing` sur mobile (fichiers `*.ts`) et le navigateur sur le web (fichiers `*.web.ts`). Pour construire les apps : `npx eas build`.

## Limites connues

- **Quotas gratuits.** La banque (environ 575 recettes) se remplit en quelques jours au rythme des quotas Groq ; les photos, environ une centaine par jour avec l’IA de Cloudflare (le forfait Workers Paid, environ 5 $ US par mois, lève cette limite).
- **Prix dépendants d’un ordinateur** tant qu’épiceries.ca n’autorise pas l’API (voir « Prix »). Sans mise à jour, les derniers prix connus restent utilisés.
- **Valeurs nutritives estimées par l’IA.** Elles servent aux étiquettes « Protéiné » et « Léger ».
- **Prix par bannière, pas par succursale.** La marge de 5 % absorbe les écarts habituels.
- **Politique de confidentialité à compléter** : remplissez la constante `RESPONSABLE` en haut de `apps/web/app/confidentialite.tsx` (nom et courriel), puis faites relire le texte.
