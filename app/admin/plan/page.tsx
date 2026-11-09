import type { Metadata } from "next";
import PlanCards from "@/app/components/PlanCards";
import { db } from "@/lib/cf";
import { trialEndsAt } from "@/lib/dev";
import { CheckIcon } from "@/app/components/Icons";
import { formatPrice } from "@/lib/format";
import { daysBetween, GRACE_DAYS, planByName, today } from "@/lib/plans";
import { requireStaff } from "@/lib/staff";
import { daysLeft, TRIAL_STAFF, TRIAL_TABLES } from "@/lib/trial";
import { PageHead } from "../kit";
import Shell from "../Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscription · tapndine", robots: { index: false, follow: false } };

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * Settings > Subscription: the plan the restaurant has and until when, and
 * the plans to buy, by the month or the year (each new one starts after the
 * last paid day). On the free trial, the days it has left.
 */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const me = await requireStaff("manager");
  const { term } = await searchParams;
  const { results: contracts } = await db()
    .prepare("SELECT plan, tables, price_cents, starts_on, ends_on FROM contracts WHERE business_id = ? ORDER BY starts_on")
    .bind(me.business_id)
    .all<{ plan: string; tables: number; price_cents: number; starts_on: string; ends_on: string }>();
  // The plan running today, or the last one that ran. One bought ahead (Standard now, Grand next) waits for its start day.
  const day = today();
  const plan = contracts.find((c) => c.starts_on <= day && day <= c.ends_on) ?? contracts.filter((c) => c.starts_on <= day).at(-1) ?? contracts[0] ?? null;
  const next = contracts.find((c) => c.starts_on > day) ?? null;
  const lastPaid = contracts.reduce((m, c) => (c.ends_on > m ? c.ends_on : m), "");
  const ends = await trialEndsAt(me.business_id);
  const trialLeft = ends === null ? null : daysLeft(ends);
  const left = plan ? daysBetween(day, lastPaid) + 1 : null;
  const fullDate = (day: string) =>
    new Date(`${day}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
  const until = plan ? fullDate(lastPaid) : "";
  // Only a self signed-up restaurant closes when its plan runs out; one a developer added is kept in Billing.
  const closes = me.paidUntil !== null;
  const known = plan ? planByName(plan.plan) : undefined;
  const includes = known?.includes ?? (plan?.tables ? ["Online menu", "Full customizable menu", `${plan.tables} tables`, "Ordering", "Waiter accounts", "Manager accounts"] : ["Online menu", "Full customizable menu", "Manager account"]);

  const sub =
    trialLeft !== null
      ? trialLeft === 0
        ? "Your free trial has ended. Buy a plan to keep everything you set up."
        : `Free trial: ${trialLeft === 1 ? "last day" : `${days(trialLeft)} left`}, with ${TRIAL_TABLES} table and ${TRIAL_STAFF} staff logins besides yours. Buy a plan to keep everything you set up.`
      : plan
        ? "Your plan, and the plans to buy next. A new month or year starts the day after your last paid day."
        : "Pick a plan for your restaurant.";

  // Red at 3 days or fewer and once it has ended, yellow at 7 or fewer: the same as the sidebar's dot.
  const tone = left === null ? "" : left <= 3 ? "bg-chili/10 text-chili ring-chili/25" : left <= 7 ? "bg-mango-soft text-forest ring-mango/40" : "";
  const status =
    left === null
      ? ""
      : left > 1
        ? `Paid until ${until}: ${days(left)} left.`
        : left === 1
          ? `Paid until today, ${until}.`
          : closes
            ? `Ended ${until}. Your menu stays open ${days(Math.max(0, GRACE_DAYS + left))} more, then closes until you pay.`
            : `Ended ${until}. Buy your next month or year below.`;

  return (
    <Shell name={me.name}>
      <PageHead title="Subscription" sub={sub} />
      {plan && (
        <section aria-label="Your plan" className="mt-6 rounded-[22px] bg-white p-5 shadow-[0_20px_50px_-28px_rgb(59_46_37/0.45)] ring-1 ring-black/5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="font-display text-[24px] font-bold">Your {plan.plan} plan</h2>
              <p className={`mt-3 inline-block rounded-xl px-3 py-2 text-[15px] font-semibold ${tone ? `ring-1 ${tone}` : "bg-paper text-ink"}`}>{status}</p>
              {next && (
                <p className="mt-3 text-[15px] text-muted">
                  Next: <span className="font-semibold text-ink">{next.plan} plan</span>, starts {fullDate(next.starts_on)}
                </p>
              )}
            </div>
            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Tables</dt>
                  <dd className="font-semibold">{plan.tables || "Menu only"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Price</dt>
                  <dd className="font-semibold">{formatPrice(plan.price_cents)}</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-muted">Covers</dt>
                  <dd className="font-semibold">
                    {fullDate(plan.starts_on)} to {fullDate(plan.ends_on)}
                  </dd>
                </div>
              </dl>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-[15px] font-medium">
                {includes.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-leaf text-white">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
      <h2 className="mt-8 font-display text-[24px] font-bold">{plan ? "Buy your next month or year" : "Plans"}</h2>
      <div className="mt-3">
        <PlanCards startTerm={term === "month" ? "month" : "year"} />
      </div>
    </Shell>
  );
}
