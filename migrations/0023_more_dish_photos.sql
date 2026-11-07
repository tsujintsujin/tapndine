-- Up to two more photos per dish, after the cover in image_url: a JSON array
-- of Cloudinary URLs, in the order the guest swipes through them.
ALTER TABLE dishes ADD COLUMN more_images TEXT NOT NULL DEFAULT '[]';
