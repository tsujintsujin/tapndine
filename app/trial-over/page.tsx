import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookDemoButton } from "@/app/BookDemo";
import { Logo } from "@/app/admin/kit";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { restaurantName } from "@/lib/dev";
import { formatDate } from "@/lib/format";
import { currentLogin } from "@/lib/staff";
import PlanCards from "@/app/components/PlanCards";
import { addDays, GRACE_DAYS, today } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/trial";
import LogOutButton from "./LogOutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your menu is closed · tapndine", robots: { index: false, follow: false } };

/**
 * Where a restaurant's staff land once its free trial is over, or its plan
 * ran out more than GRACE_DAYS ago: everything else is closed to them
 * (lib/staff.ts). Managers buy a plan right here (QR Ph); waiters are told to ask their manager.
 */
export default async function TrialOverPage() {
  const me = await currentLogin();
  if (!me) redirect("/login");
  const trialEnded = me.trialEndsAt !== null && me.trialEndsAt <= Date.now();
  const lapsed = me.paidUntil !== null && me.paidUntil < addDays(today(), -GRACE_DAYS);
  if (!trialEnded && !lapsed) redirect(me.role === "developer" ? "/admin/dev" : "/admin");
  const endedOn = trialEnded ? formatDate(me.trialEndsAt!) : formatDate(Date.parse(`${me.paidUntil}T12:00:00+08:00`));
  const name = (me.business_id && (await restaurantName(me.business_id))) || "Your restaurant";
  const manager = me.role !== "waiter";

  return (
    <div className="theme-green relative min-h-dvh px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] text-ink sm:px-6">
      <WarmBackdrop />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between py-2">
        <Logo href="/trial-over" />
        <LogOutButton />
      </header>

      <main className="relative mx-auto max-w-6xl">
        <section className="mx-auto mt-6 max-w-2xl text-center sm:mt-12">
          <p className="mx-auto w-fit rounded-full bg-mango-soft px-4 py-1.5 text-[14px] font-semibold text-forest">
            {trialEnded ? "Free trial" : "Your plan"} ended {endedOn}
          </p>
          <h1 className="mt-5 text-balance font-display text-[38px] font-bold leading-[1.05] tracking-tight sm:text-[52px]">
            {trialEnded ? "Has tapndine helped you?" : "Your menu is closed for now"}
          </h1>
          {manager ? (
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
              {trialEnded ? `${name}'s ${TRIAL_DAYS}-day trial is over` : `${name}'s plan ran out`}, so the menu is closed to
              guests for now. Your dishes, tables and staff are all saved. Buy a plan below and everything opens again, just
              as you left it.
            </p>
          ) : (
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
              {trialEnded ? `${name}'s free trial is over` : `${name}'s plan ran out`}. Ask your manager to buy a plan, and your
              tables will be back right away.
            </p>
          )}
        </section>

        {manager && (
          <>
            <div className="mt-10 text-left">
              <PlanCards />
            </div>
            <div className="mt-6 text-center text-[15px] text-muted">
              Questions first?{" "}
              <BookDemoButton className="rounded font-semibold text-leaf underline-offset-4 hover:underline">Book a call</BookDemoButton>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
