-- The colour scheme of the guests' menu (lib/palettes.ts PaletteId). NULL
-- keeps the design's own colours; a manager picks one on the Menu page.
ALTER TABLE businesses ADD COLUMN menu_palette TEXT;
