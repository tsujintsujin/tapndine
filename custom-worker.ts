// The Worker tapndine runs: OpenNext's app, plus a daily job that calls the
// app's own reminder route (the route has the database and mail set up).
// @ts-ignore -- built by `opennextjs-cloudflare build`, not there before that.
import app from "./.open-next/worker.js";

type Ctx = { waitUntil(p: Promise<unknown>): void };

export default {
  fetch: app.fetch,
  scheduled(_event: unknown, env: unknown, ctx: Ctx) {
    ctx.waitUntil(app.fetch(new Request("https://tapndine.online/api/cron/reminders", { method: "POST" }), env, ctx));
  },
};
