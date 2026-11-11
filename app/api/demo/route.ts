import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/cf";
import { randomId } from "@/lib/ids";
import { sendMail } from "@/lib/mail";
import { createDemoEvent } from "@/lib/gcal";

const NOTIFY = "justin.masiga.94@gmail.com";
/** Where bookers' replies go (Titan mailbox). */
const SUPPORT = "support@tappetite.click";
/** A demo slot's length; the picker offers a time every 30 minutes (BookDemo.tsx). */
const DEMO_MIN = 30;
const DEMO_MENU = "https://tappetite.click/t/b3744013e9f6";

/** 870 -> "2:30 PM" */
const label12 = (min: number) => {
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Start times already booked on a day, so the picker can hide them. ?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!isDate(date)) return NextResponse.json({ error: "Pick a day." }, { status: 400 });
  const r = await db()
    .prepare("SELECT DISTINCT slot_min FROM demo_requests WHERE slot_date = ?")
    .bind(date)
    .all<{ slot_min: number }>();
  return NextResponse.json({ taken: r.results.map((x) => x.slot_min) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const date = str(b?.date, 10);
  const min = typeof b?.min === "number" && Number.isInteger(b.min) ? b.min : -1;
  const name = str(b?.name, 100);
  const email = str(b?.email, 200);
  const message = str(b?.message, 2000);

  if (!isDate(date) || min < 9 * 60 || min >= 17 * 60) {
    return NextResponse.json({ error: "Pick a day and a time." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  // One booking per time: the check is inside the insert, so two people
  // picking the same time at once cannot both get it.
  const id = randomId();
  const saved = await db()
    .prepare(
      `INSERT INTO demo_requests (id, slot_date, slot_min, name, email, message, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE NOT EXISTS (SELECT 1 FROM demo_requests WHERE slot_date = ?2 AND slot_min = ?3)`
    )
    .bind(id, date, min, name, email, message || null, Date.now())
    .run();
  if (saved.meta.changes === 0) {
    return NextResponse.json({ error: "Someone just booked that time. Pick another.", taken: true }, { status: 409 });
  }

  const day = new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Saved already, so a failed invite or email still counts as booked.
  // The booker is the event's only guest: Google emails them the invite.
  const ev = await createDemoEvent({
    requestId: id,
    date,
    startMin: min,
    lengthMin: DEMO_MIN,
    summary: `tappetite demo with ${name}`,
    description:
      `A ${DEMO_MIN}-minute look at tappetite on Google Meet.\n\n` +
      `Booked by ${name} (${email})${message ? `\nMessage: ${message}` : ""}\n\n` +
      `Try the demo menu before we meet: ${DEMO_MENU}`,
    guest: email,
  });
  await sendMail({
    to: NOTIFY,
    replyTo: email,
    subject: `tappetite demo: ${name}, ${day} ${label12(min)}`,
    text:
      `New demo request\n\nWhen: ${day}, ${label12(min)}\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message || "(none)"}\n\n` +
      (ev
        ? `Calendar invite sent to them from tappetitesupport@gmail.com.\nMeet: ${ev.meet ?? "(see the event)"}\nEvent: ${ev.link}`
        : `No calendar invite was made (see the Worker log). Send them a Meet link yourself.`),
  });
  // And the booker gets their own copy, so they know it went through.
  await sendMail({
    to: email,
    replyTo: SUPPORT,
    subject: `Your tappetite demo: ${day}, ${label12(min)}`,
    text:
      `Hi ${name},\n\nThanks for booking a tappetite demo. We have you down for ${day} at ${label12(min)} (Philippine time).\n\n` +
      (ev
        ? `Google Calendar is sending you an invite with the Google Meet link${ev.meet ? `: ${ev.meet}` : "."}\n` +
          `To change the time or ask anything, just reply to this email.\n\n`
        : `We'll email you before then with how we'll meet. To change the time or ask anything, just reply to this email.\n\n`) +
      `Want a look now? Open the demo menu: ${DEMO_MENU}\n\ntappetite`,
  });
  return NextResponse.json({ ok: true, invite: ev !== null });
}
