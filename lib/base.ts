/**
 * The app is served under justin94.space/tapndine (Portfolio proxies that path
 * here). Next prefixes <Link> and its own assets, but not fetch(), redirects,
 * <img src> or iframe src, so those use this. "" once it has its own domain.
 */
export const BASE_PATH = "/tapndine";

/** The restaurant a developer last opened. Not trusted for anything: it only lets an older tab notice the switch. */
export const OPEN_COOKIE = "tnd_open";
