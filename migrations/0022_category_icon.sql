-- The icon a manager picked for a main category, one of the shapes in
-- app/components/CategoryIcon.tsx. NULL: guessed from the name, as before.
ALTER TABLE categories ADD COLUMN icon TEXT;
