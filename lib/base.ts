/**
 * The path the app is served under: "" on its own domain, tapndine.online.
 * Next prefixes
 * <Link> and its own assets, but not fetch(), redirects, <img src> or iframe
 * src, so those use this.
 */
export const BASE_PATH = "";

/** The restaurant a developer last opened. Not trusted for anything: it only lets an older tab notice the switch. */
export const OPEN_COOKIE = "tnd_open";
