// The Worker tappetite runs: OpenNext's app, plus a daily job that calls the
// app's own reminder route (the route has the database and mail set up).
// @ts-ignore -- built by `opennextjs-cloudflare build`, not there before that.
import app from "./.open-next/worker.js";

type Ctx = { waitUntil(p: Promise<unknown>): void };

const HOME = "tappetite.click";
// The old name's domain (and www here) move to the same path on HOME, so printed
// NFC tags and QR codes keep working. /api/ stays served on the old domain:
// PayMongo's webhook and waiter screens left open since before the move post there.
const OLD = new Set(["tapndine.online", "www.tapndine.online"]);

export default {
  fetch(req: Request, env: unknown, ctx: Ctx) {
    const url = new URL(req.url);
    const old = OLD.has(url.hostname);
    if ((old && !url.pathname.startsWith("/api/")) || url.hostname === `www.${HOME}`) {
      url.protocol = "https:";
      url.host = HOME;
      return Response.redirect(url.toString(), 301);
    }
    return app.fetch(req, env, ctx);
  },
  scheduled(_event: unknown, env: unknown, ctx: Ctx) {
    ctx.waitUntil(app.fetch(new Request(`https://${HOME}/api/cron/reminders`, { method: "POST" }), env, ctx));
  },
};
