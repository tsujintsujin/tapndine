-- A dish the guest menu offers in the "You haven't ordered any drinks" popup,
-- when an order has nothing from its category. The manager switches it on per dish.
ALTER TABLE dishes ADD COLUMN suggest INTEGER NOT NULL DEFAULT 0;
