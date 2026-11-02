-- A category can sit under a main category (Coffee under Drinks), one level deep.
ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id);
