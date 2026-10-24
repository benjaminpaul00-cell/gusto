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
  image_prompt TEXT,
  image_key TEXT,                -- clé R2, NULL tant que l'image n'existe pas
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
