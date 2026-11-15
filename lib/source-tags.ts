/**
 * Where a sign-up came from: the utm tags on the link that first brought this
 * browser to tappetite (Facebook posts carry utm_source=facebook&utm_campaign=…).
 * Kept first-touch in a cookie for 30 days and saved on the restaurant at sign-up
 * as "source/medium/campaign", e.g. "facebook/social/album1". Safe on client and server.
 */
export const SOURCE_COOKIE = "tp_src";
export const SOURCE_MAX_AGE = 60 * 60 * 24 * 30;
export const SAFE_SOURCE = /^[\w.-]{1,60}(\/[\w.-]{0,60}){0,2}$/;

/** "facebook/social/album1" from a URL's utm tags, or null when it has no utm_source. */
export function sourceFromParams(p: URLSearchParams): string | null {
  const part = (k: string) => (p.get(k) || "").toLowerCase().replace(/[^\w.-]/g, "").slice(0, 60);
  if (!part("utm_source")) return null;
  const s = [part("utm_source"), part("utm_medium"), part("utm_campaign")].join("/").replace(/\/+$/, "");
  return SAFE_SOURCE.test(s) ? s : null;
}
