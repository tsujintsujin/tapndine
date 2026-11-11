-- The restaurant's social pages, shown as "Follow us" on the guests' menu
-- home. JSON, e.g. {"facebook":{"url":"https://facebook.com/covecafe","on":true}}
-- (lib/socials.ts). NULL: none set, and the section doesn't show.
ALTER TABLE businesses ADD COLUMN socials TEXT;
