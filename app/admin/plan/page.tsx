import type { Metadata } from "next";
import BuyPlan from "@/app/components/BuyPlan";
import { db } from "@/lib/cf";
import { formatDate } from "@/lib/format";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../kit";
import Shell from "../Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan · tapndine", robots: { index: false, follow: false } };

/** A manager's plan: buy one while on the free trial (the trial bar links here), or see the one they have. */
export default async function PlanPage() {
  const me = await requireStaff("manager");
  const plan = await db()
    .prepare("SELECT plan, tables, ends_on FROM contracts WHERE business_id = ? ORDER BY ends_on DESC LIMIT 1")
    .bind(me.business_id)
    .first<{ plan: string; tables: number; ends_on: string }>();
  return (
    <Shell name={me.name}>
      <PageHead title="Plan" sub={plan ? "What your restaurant has with tapndine." : "Keep everything you set up on your free trial."} />
      <div className="mt-6 max-w-xl rounded-[22px] bg-white p-5 shadow-[0_20px_50px_-28px_rgb(59_46_37/0.45)] ring-1 ring-black/5 sm:p-7">
        {plan ? (
          <div>
            <h2 className="font-display text-[24px] font-bold">{plan.plan} plan</h2>
            <p className="mt-1 text-[16px] text-muted">
              {plan.tables ? `${plan.tables} tables` : "Menu only"}, until {formatDate(Date.parse(`${plan.ends_on}T12:00:00+08:00`))}.
              To renew or change it, message tapndine.
            </p>
          </div>
        ) : (
          <BuyPlan />
        )}
      </div>
    </Shell>
  );
}
