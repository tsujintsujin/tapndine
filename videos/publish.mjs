// Copies the homepage animations into public/anim/<name>/ so the site can serve
// them. videos/<name>/ is the HyperFrames source (open it in Studio to edit);
// re-run `npm run anim` after changing one. The preview-only backdrop stills
// (assets/guide*.png) are left out.
import { cpSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "anim");

rmSync(out, { recursive: true, force: true });
for (const name of ["hero-loop", "waiter-orders", "menu-booklet"]) {
  // play.html, not index.html: Cloudflare would redirect .../index.html to
  // .../name/ and Vercel strips trailing slashes, so the two would bounce.
  cpSync(join(here, name, "index.html"), join(out, name, "play.html"));
  cpSync(join(here, name, "assets"), join(out, name, "assets"), {
    recursive: true,
    filter: (src) => !basename(src).startsWith("guide"),
  });
  console.log("anim:", name);
}
