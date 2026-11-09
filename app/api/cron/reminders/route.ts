import { NextResponse } from "next/server";
import { db } from "@/lib/cf";
import { sendMail } from "@/lib/mail";
import { daysBetween, today } from "@/lib/plans";

/** Days before a plan's last day, counting that day, that the owner gets an email. */
const REMIND_AT = [3, 1];

/**
 * The daily job (custom-worker.ts): emails the owner of each self signed-up
 * restaurant whose plan has 3 days or 1 day left.
 *
 * ponytail: no secret on this route. It only sends reminders that are due and
 * haven't gone out (plan_reminders), so calling it from outside changes nothing.
 */
export async function POST() {
  const d = db();
  const { results } = await d
    .prepare(
      `SELECT b.id, b.name, MAX(c.ends_on) AS ends_on,
              (SELECT s.email FROM staff s WHERE s.business_id = b.id AND s.email IS NOT NULL AND s.disabled_at IS NULL LIMIT 1) AS email
       FROM businesses b JOIN contracts c ON c.business_id = b.id
       WHERE b.trial_ends_at IS NOT NULL AND b.disabled_at IS NULL
       GROUP BY b.id`
    )
    .all<{ id: string; name: string; ends_on: string; email: string | null }>();

  let sent = 0;
  for (const r of results) {
    const left = daysBetween(today(), r.ends_on) + 1;
    if (!r.email || !REMIND_AT.includes(left)) continue;
    const claimed = await d
      .prepare("INSERT OR IGNORE INTO plan_reminders (business_id, ends_on, days_left, sent_at) VALUES (?, ?, ?, ?)")
      .bind(r.id, r.ends_on, left, Date.now())
      .run();
    if (!claimed.meta.changes) continue;
    const when = left === 1 ? "today" : `in ${left} days`;
    const mail = await sendMail({
      to: r.email,
      subject: `Your tapndine plan for ${r.name} ends ${when}`,
      text: `Your tapndine plan for ${r.name} ends ${when}.\n\nPay for your next month or year to keep your menu open to guests:\nhttps://tapndine.online/admin/plan\n\nIf it runs out, your menu stays open 3 more days, then closes until you pay. Nothing is deleted.\n\ntapndine.online`,
    });
    if (mail.delivered) sent++;
    // Not sent: free the row so a later run can try again.
    else await d.prepare("DELETE FROM plan_reminders WHERE business_id = ? AND ends_on = ? AND days_left = ?").bind(r.id, r.ends_on, left).run();
  }
  return NextResponse.json({ ok: true, sent });
}
