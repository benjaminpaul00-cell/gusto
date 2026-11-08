-- Diète par macros : glucides et lipides par portion (estimés, ajustés aux calories et aux protéines).
ALTER TABLE recipes ADD COLUMN carbs REAL;
ALTER TABLE recipes ADD COLUMN fat REAL;
