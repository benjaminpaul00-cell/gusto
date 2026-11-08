-- Base de données D1 de Gusto
-- npx wrangler d1 execute gusto --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  meal TEXT NOT NULL,
  styles TEXT NOT NULL,          -- JSON : ["normal","proteine",...]
  diets TEXT NOT NULL,           -- JSON : ["vegetarien",...]
  servings INTEGER NOT NULL,
  ingredients TEXT NOT NULL,     -- JSON : [{name, qty, unit, display}]
  steps TEXT NOT NULL,           -- JSON : ["..."]
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL,                    -- glucides par portion (g), estimés (diète par macros)
  fat REAL,                      -- lipides par portion (g), estimés
  image_prompt TEXT,
  image_key TEXT,                -- clé R2, NULL tant que l'image n'existe pas
  image_credit TEXT,             -- JSON : auteur, licence et source d'une photo libre ; NULL = image générée
  status TEXT NOT NULL DEFAULT 'active', -- active | rejected
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipes_meal_cuisine ON recipes (meal, cuisine);

CREATE TABLE IF NOT EXISTS ingredients (
  name TEXT PRIMARY KEY,
  section TEXT,
  pantry INTEGER NOT NULL DEFAULT 0,
  unit_weight_g REAL,
  search_terms TEXT,             -- JSON : termes de recherche pour épiceries.ca
  categories TEXT,               -- JSON : catégories épiceries.ca où chercher le produit
  homemade TEXT,                 -- JSON : sous-recette « fait maison », ou NULL
  specialty TEXT,                -- JSON : {where, priceMax, sizeQty, sizeUnit}, ou NULL
  status TEXT NOT NULL DEFAULT 'pending', -- pending | resolved
  prices_checked_at INTEGER,     -- dernière recherche de prix (NULL = jamais)
  terms_retried INTEGER NOT NULL DEFAULT 0, -- 1 = l'IA a déjà proposé d'autres termes
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS store_products (
  ingredient TEXT NOT NULL,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  size_qty REAL NOT NULL,
  size_unit TEXT NOT NULL,
  price REAL NOT NULL,
  regular_price REAL NOT NULL,
  discounted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  low_price REAL,                -- plus bas prix des 12 derniers mois (historique épiceries.ca)
  deal TEXT,                     -- vrai, plancher (plus bas de l'année) ou faux rabais
  history_at INTEGER,            -- dernière analyse de l'historique
  PRIMARY KEY (ingredient, store, product_id) -- plusieurs formats par bannière
);
CREATE INDEX IF NOT EXISTS store_products_store ON store_products (store);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- gen_recipes | resolve_ingredient | gen_image | refresh_prices
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  run_after INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs (status, run_after, id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,          -- hachage de l'IP + jour (aucune IP en clair, Loi 25)
  day TEXT NOT NULL,
  count INTEGER NOT NULL
);

-- Section Recettes : recherches IA (mises en cache), recettes de la communauté (modérées) et recettes externes (attribuées)
CREATE TABLE IF NOT EXISTS section_recipes (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,          -- ia | communaute | externe
  status TEXT NOT NULL,          -- en_attente | publiee | refusee
  title TEXT NOT NULL,
  servings INTEGER NOT NULL,
  servings_estimated INTEGER NOT NULL DEFAULT 0, -- 1 : la source n'indique pas de portions
  prep_min INTEGER,
  cook_min INTEGER,
  temperature TEXT,              -- ex. « 190 °C »
  ingredients TEXT NOT NULL,     -- JSON : [{qty, unit, name, display}] (unit : g, ml ou unite)
  steps TEXT NOT NULL,           -- JSON : ["..."]
  author TEXT,                   -- pseudo (communauté) ou auteur original (externe)
  source_name TEXT,              -- site source (externe)
  source_url TEXT,               -- lien vers la recette originale (externe)
  photo_key TEXT,                -- photo : partagée (communauté) ou libre de droits (externe)
  source_rating REAL,            -- note de départ du site source (sur 5)
  source_rating_count INTEGER NOT NULL DEFAULT 0, -- nombre d'avis sur le site source
  photo_credit TEXT, -- photo libre de droits : JSON {creator, license, source, landing}
  query_key TEXT,                -- recherche IA normalisée (cache)
  ip_hash TEXT,                  -- hachage de l'IP de l'envoi (anti-abus, aucune IP en clair)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS section_recipes_list ON section_recipes (status, source);
CREATE UNIQUE INDEX IF NOT EXISTS section_recipes_query ON section_recipes (query_key) WHERE query_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS section_recipes_url ON section_recipes (source_url) WHERE source_url IS NOT NULL;

-- Étoiles sans compte : un vote par navigateur (identifiant aléatoire) et par IP (hachée) pour chaque recette
CREATE TABLE IF NOT EXISTS ratings (
  recipe_id TEXT NOT NULL,
  voter TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  stars INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (recipe_id, voter)
);
CREATE UNIQUE INDEX IF NOT EXISTS ratings_ip ON ratings (recipe_id, ip_hash);
