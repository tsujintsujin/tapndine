-- What a dish's one-pick choice is called, for when it isn't a size: a
-- noodle dish where the guest picks Pork, Chicken or Seafood is "Meat", not
-- "Size". NULL shows "Size", as before.
ALTER TABLE dishes ADD COLUMN size_label TEXT;
