-- Where a self sign-up came from: the utm tags of the link that first brought
-- the browser to tappetite, as "source/medium/campaign" (e.g. "facebook/social/album1").
-- NULL for restaurants made before this, by a developer, or with no utm tags.
ALTER TABLE businesses ADD COLUMN source TEXT;
