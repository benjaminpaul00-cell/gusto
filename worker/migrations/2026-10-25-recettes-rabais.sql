-- Section Recettes : notes de départ des sites sources et crédit des photos libres de droits.
ALTER TABLE section_recipes ADD COLUMN source_rating REAL;
ALTER TABLE section_recipes ADD COLUMN source_rating_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE section_recipes ADD COLUMN photo_credit TEXT;
-- Rabais : historique des prix d'épiceries.ca (vrai prix régulier, plus bas prix de l'année, faux rabais).
ALTER TABLE store_products ADD COLUMN low_price REAL;
ALTER TABLE store_products ADD COLUMN deal TEXT;
ALTER TABLE store_products ADD COLUMN history_at INTEGER;
