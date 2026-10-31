-- Which look the guests' menu has: 'a' (the first design, warm cream and
-- cocoa, a home page and a photo grid) or 'b' (ube and calamansi, one long
-- list). A manager switches it on the Menu page; every restaurant starts on A.
ALTER TABLE businesses ADD COLUMN menu_design TEXT NOT NULL DEFAULT 'a' CHECK (menu_design IN ('a', 'b'));
