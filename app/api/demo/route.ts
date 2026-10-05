import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/cf";
import { randomId } from "@/lib/ids";
import { sendMail } from "@/lib/mail";

const NOTIFY = "justin.masiga.94@gmail.com";

/** 870 -> "2:30 PM" */
const label12 = (min: number) => {
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const date = str(b?.date, 10);
  const min = typeof b?.min === "number" && Number.isInteger(b.min) ? b.min : -1;
  const name = str(b?.name, 100);
  const email = str(b?.email, 200);
  const message = str(b?.message, 2000);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || min < 9 * 60 || min >= 17 * 60) {
    return NextResponse.json({ error: "Pick a day and a time." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  await db()
    .prepare("INSERT INTO demo_requests (id, slot_date, slot_min, name, email, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(randomId(), date, min, name, email, message || null, Date.now())
    .run();

  const day = new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Saved already, so a failed email still counts as booked.
  await sendMail({
    to: NOTIFY,
    replyTo: email,
    subject: `tapndine demo: ${name}, ${day} ${label12(min)}`,
    text: `New demo request\n\nWhen: ${day}, ${label12(min)}\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message || "(none)"}`,
  });
  return NextResponse.json({ ok: true });
}
