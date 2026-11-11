// The social link rules (lib/socials.ts).
// Run: node scripts/socials-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { cleanLink, parseSocials, shownSocials } from "../lib/socials.ts";

// Pasted without https://, with it, from the phone app's share link.
assert.equal(cleanLink("facebook", " facebook.com/covecafe "), "https://facebook.com/covecafe");
assert.equal(cleanLink("facebook", "http://m.facebook.com/covecafe"), "https://m.facebook.com/covecafe");
assert.equal(cleanLink("facebook", "https://www.facebook.com/profile.php?id=123"), "https://www.facebook.com/profile.php?id=123");
assert.equal(cleanLink("instagram", "https://www.instagram.com/cove.cafe/?igsh=abc"), "https://www.instagram.com/cove.cafe/?igsh=abc");
assert.equal(cleanLink("x", "twitter.com/covecafe"), "https://twitter.com/covecafe");
assert.equal(cleanLink("tiktok", "https://vm.tiktok.com/ZSabc/"), "https://vm.tiktok.com/ZSabc/");

// Another network's link, a look-alike host, the network's home page, junk.
assert.equal(cleanLink("facebook", "instagram.com/covecafe"), null);
assert.equal(cleanLink("facebook", "notfacebook.com/covecafe"), null);
assert.equal(cleanLink("facebook", "https://facebook.com@evil.com/x"), null);
assert.equal(cleanLink("facebook", "facebook.com"), null);
assert.equal(cleanLink("facebook", "javascript:alert(1)"), null);
assert.equal(cleanLink("x", "x.com/cove cafe"), null);
assert.equal(cleanLink("tiktok", ""), null);

// Stored JSON: bad links and unknown networks drop out; only "on" ones show, in order.
const s = parseSocials(
  JSON.stringify({
    tiktok: { url: "tiktok.com/@cove", on: true },
    facebook: { url: "https://facebook.com/cove", on: true },
    instagram: { url: "https://evil.com/cove", on: true },
    x: { url: "x.com/cove", on: false },
    youtube: { url: "youtube.com/cove", on: true },
  })
);
assert.deepEqual(Object.keys(s).sort(), ["facebook", "tiktok", "x"]);
assert.deepEqual(
  shownSocials(s).map((x: { id: string }) => x.id),
  ["facebook", "tiktok"]
);
assert.deepEqual(parseSocials(null), {});
assert.deepEqual(parseSocials("not json"), {});
assert.deepEqual(shownSocials({}), []);

console.log("socials-check: all good");
