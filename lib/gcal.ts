import { env } from "@/lib/cf";

/**
 * Demo bookings go on the demo account's Google Calendar (tappetitesupport@gmail.com,
 * connected once with scripts/google-calendar-token.mjs) with a Google Meet link.
 * The booker is the only guest, so Google emails them the invite; Justin sees the
 * calendar through sharing, never as a guest. Uses the sign-in OAuth client.
 * Returns null when not configured or when Google refuses: the booking is saved
 * either way, and the caller says so in its emails.
 */
export async function createDemoEvent(o: {
  requestId: string;
  date: string; // YYYY-MM-DD
  startMin: number; // minutes after midnight, Philippine time
  lengthMin: number;
  summary: string;
  description: string;
  guest: string;
}): Promise<{ meet: string | null; link: string } | null> {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GOOGLE_CAL_REFRESH_TOKEN: refresh } = env();
  if (!id || !secret || !refresh) {
    console.log("[gcal] GOOGLE_CAL_REFRESH_TOKEN or the OAuth client is not set, no calendar event.");
    return null;
  }
  const at = (min: number) => `${o.date}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;
  try {
    const t = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
    });
    if (!t.ok) {
      console.error("[gcal] token refresh failed:", t.status, await t.text());
      return null;
    }
    const { access_token } = (await t.json()) as { access_token: string };
    const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: o.summary,
        description: o.description,
        start: { dateTime: at(o.startMin), timeZone: "Asia/Manila" },
        end: { dateTime: at(o.startMin + o.lengthMin), timeZone: "Asia/Manila" },
        attendees: [{ email: o.guest }],
        guestsCanInviteOthers: false,
        conferenceData: { createRequest: { requestId: o.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      }),
    });
    if (!r.ok) {
      console.error("[gcal] event insert failed:", r.status, await r.text());
      return null;
    }
    const ev = (await r.json()) as { hangoutLink?: string; htmlLink: string };
    return { meet: ev.hangoutLink ?? null, link: ev.htmlLink };
  } catch (e) {
    console.error("[gcal] failed:", e);
    return null;
  }
}
