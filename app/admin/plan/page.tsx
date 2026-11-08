import type { Metadata } from "next";
import { db } from "@/lib/cf";
import { trialEndsAt } from "@/lib/dev";
import { formatDate } from "@/lib/format";
import { requireStaff } from "@/lib/staff";
import { daysLeft, TRIAL_STAFF, TRIAL_TABLES } from "@/lib/trial";
import { PageHead } from "../kit";
import Shell from "../Shell";
import PlanPicker from "./PlanPicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscription · tapndine", robots: { index: false, follow: false } };

/** Settings > Subscription: buy a plan while on the free trial (the sidebar shows the days left), or see the one they have. */
export default async function PlanPage() {
  const me = await requireStaff("manager");
  const plan = await db()
    .prepare("SELECT plan, tables, ends_on FROM contracts WHERE business_id = ? ORDER BY ends_on DESC LIMIT 1")
    .bind(me.business_id)
    .first<{ plan: string; tables: number; ends_on: string }>();
  const ends = await trialEndsAt(me.business_id);
  const left = ends === null ? null : daysLeft(ends);
  const sub =
    left === null
      ? plan
        ? "What your restaurant has with tapndine."
        : "Pick a plan for your restaurant."
      : left === 0
        ? "Your free trial has ended. Buy a plan to keep everything you set up."
        : `Free trial: ${left === 1 ? "last day" : `${left} days left`}, with ${TRIAL_TABLES} table and ${TRIAL_STAFF} staff logins besides yours. Buy a plan to keep everything you set up.`;
  return (
    <Shell name={me.name}>
      <PageHead title="Subscription" sub={sub} />
      {plan ? (
        <div data-guide="plan" className="mt-6 max-w-xl rounded-[22px] bg-white p-5 shadow-[0_20px_50px_-28px_rgb(59_46_37/0.45)] ring-1 ring-black/5 sm:p-7">
          <h2 className="font-display text-[24px] font-bold">{plan.plan} plan</h2>
          <p className="mt-1 text-[16px] text-muted">
            {plan.tables ? `${plan.tables} tables` : "Menu only"}, until {formatDate(Date.parse(`${plan.ends_on}T12:00:00+08:00`))}.
            To renew or change it, message tapndine.
          </p>
        </div>
      ) : (
        <PlanPicker />
      )}
    </Shell>
  );
}
