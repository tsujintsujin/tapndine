// One-time: connect the Google account whose calendar holds the demo bookings
// (tappetitesupport@gmail.com) and save its refresh token for lib/gcal.ts.
//
//   node scripts/google-calendar-token.mjs <client.json> <out.json>
//
// <client.json> is the "tapndine web" OAuth client, which lists
// http://localhost:8765/oauth2callback as a redirect. The script prints the
// consent URL and listens on localhost:8765 (this machine only). Open the URL,
// sign in as the demo account and allow; Google sends the browser back here,
// the code is traded for a refresh token, written to <out.json> (keep it under
// D:\AIO Freelance\Credentials, never in the repo), and the script exits. It
// prints which calendar it connected, never the token. Then set the token as
// the Worker secret GOOGLE_CAL_REFRESH_TOKEN.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const [clientPath, outPath] = process.argv.slice(2);
if (!clientPath || !outPath) {
  console.error("usage: node scripts/google-calendar-token.mjs <client.json> <out.json>");
  process.exit(1);
}
const c = JSON.parse(readFileSync(clientPath, "utf8")).web;
const REDIRECT = "http://localhost:8765/oauth2callback";

const q = new URLSearchParams({
  client_id: c.client_id,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/calendar.events",
  access_type: "offline",
  prompt: "consent",
  login_hint: "tappetitesupport@gmail.com",
});
console.log(`Open: https://accounts.google.com/o/oauth2/v2/auth?${q}`);

async function connect(code) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const t = await r.json();
  if (!t.refresh_token) throw new Error(`No refresh token: ${r.status} ${t.error ?? ""} ${t.error_description ?? ""}`);
  // The primary calendar's name is the account's address: proof of which account allowed.
  const cal = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1", {
    headers: { Authorization: `Bearer ${t.access_token}` },
  }).then((x) => x.json());
  writeFileSync(outPath, JSON.stringify({ account: cal.summary, scope: t.scope, refresh_token: t.refresh_token, saved: new Date().toISOString() }, null, 2));
  return `calendar of ${cal.summary}, scope ${t.scope}`;
}

// "localhost" can resolve to either address, so listen on both, loopback only.
const servers = ["127.0.0.1", "::1"].map((host) =>
  createServer(async (req, res) => {
    const u = new URL(req.url, REDIRECT);
    const code = u.searchParams.get("code");
    if (u.pathname !== "/oauth2callback" || !code) return res.writeHead(404).end();
    try {
      const what = await connect(code);
      res.writeHead(200, { "Content-Type": "text/plain" }).end(`Connected: ${what}. You can close this tab.`);
      console.log(`saved: ${what}`);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" }).end(String(e));
      console.error(String(e));
      process.exitCode = 1;
    }
    for (const s of servers) s.close();
  }).listen(8765, host)
);
