// The restaurant's social pages: a manager sets them in Settings > Socials,
// and the ones switched on show as "Follow us" on the guests' menu home.
// Stored as JSON in businesses.socials (migration 0028). No server imports
// here: the Socials page checks a link in the browser with the same rules.

export const NETWORKS = [
  { id: "facebook", name: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], example: "facebook.com/yourcafe" },
  { id: "instagram", name: "Instagram", hosts: ["instagram.com", "instagr.am"], example: "instagram.com/yourcafe" },
  { id: "x", name: "X", hosts: ["x.com", "twitter.com"], example: "x.com/yourcafe" },
  { id: "tiktok", name: "TikTok", hosts: ["tiktok.com"], example: "tiktok.com/@yourcafe" },
] as const;

export type NetworkId = (typeof NETWORKS)[number]["id"];
/** One network as the manager set it: the link, and whether guests see it. */
export type Social = { url: string; on: boolean };
export type Socials = Partial<Record<NetworkId, Social>>;
/** What the guests' menu gets: only the links switched on, in NETWORKS order. */
export type ShownSocial = { id: NetworkId; name: string; url: string };

/**
 * The link as stored, or null when it isn't a page on that network. A missing
 * "https://" is added, so "facebook.com/covecafe" works as pasted.
 */
export function cleanLink(id: NetworkId, raw: string): string | null {
  const net = NETWORKS.find((n) => n.id === id);
  const text = raw.trim();
  if (!net || !text || text.length > 300 || /\s/.test(text)) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (!net.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  // The network's own home page isn't the restaurant's page.
  if (u.pathname === "/" && !u.search) return null;
  u.protocol = "https:";
  return u.toString();
}

/** The stored JSON, keeping only links that still pass cleanLink. */
export function parseSocials(json: string | null): Socials {
  let raw: unknown;
  try {
    raw = json ? JSON.parse(json) : null;
  } catch {
    return {};
  }
  const out: Socials = {};
  if (!raw || typeof raw !== "object") return out;
  for (const { id } of NETWORKS) {
    const s = (raw as Record<string, { url?: unknown; on?: unknown }>)[id];
    const url = typeof s?.url === "string" ? cleanLink(id, s.url) : null;
    if (url) out[id] = { url, on: s?.on === true };
  }
  return out;
}

export function shownSocials(s: Socials): ShownSocial[] {
  return NETWORKS.flatMap(({ id, name }) => (s[id]?.on ? [{ id, name, url: s[id].url }] : []));
}
