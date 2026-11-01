import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookDemoButton } from "@/app/BookDemo";
import { Logo } from "@/app/admin/kit";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { restaurantName } from "@/lib/dev";
import { formatDate } from "@/lib/format";
import { EXTRA_TABLE, PLANS } from "@/lib/plans";
import { currentLogin } from "@/lib/staff";
import { MESSENGER_URL, TRIAL_DAYS } from "@/lib/trial";
import LogOutButton from "./LogOutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your free trial is over · tapndine", robots: { index: false, follow: false } };

const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
const perTableMonth = (p: { price: number; tables: number }) =>
  "₱" + (p.price / p.tables / 12).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const cta = "inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full px-7 text-[16px] font-semibold";

/**
 * Where a restaurant's staff land once its free trial is over: everything
 * else is closed to them (lib/staff.ts). Managers get the plans and two ways
 * to reach us; waiters are told to ask their manager.
 */
export default async function TrialOverPage() {
  const me = await currentLogin();
  if (!me) redirect("/login");
  if (me.trialEndsAt === null || me.trialEndsAt > Date.now()) redirect(me.role === "developer" ? "/admin/dev" : "/admin");
  const name = (me.business_id && (await restaurantName(me.business_id))) || "Your restaurant";
  const manager = me.role !== "waiter";

  return (
    <div className="theme-green relative min-h-dvh px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] text-ink sm:px-6">
      <WarmBackdrop />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between py-2">
        <Logo href="/trial-over" />
        <LogOutButton />
      </header>

      <main className="relative mx-auto max-w-5xl">
        <section className="mx-auto mt-6 max-w-2xl text-center sm:mt-12">
          <p className="mx-auto w-fit rounded-full bg-mango-soft px-4 py-1.5 text-[14px] font-semibold text-forest">
            Free trial ended {formatDate(me.trialEndsAt)}
          </p>
          <h1 className="mt-5 text-balance font-display text-[38px] font-bold leading-[1.05] tracking-tight sm:text-[52px]">
            Has tapndine helped you?
          </h1>
          {manager ? (
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
              {name}&apos;s {TRIAL_DAYS}-day trial is over, so the menu is closed to guests for now. Your dishes, table and
              staff are all saved. Pick a plan below and everything opens again, just as you left it.
            </p>
          ) : (
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
              {name}&apos;s free trial is over. Ask your manager to pick a plan, and your tables will be back right away.
            </p>
          )}
        </section>

        {manager && (
          <>
            <h2 className="sr-only">Plans</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p) => (
                <li key={p.name} className="flex flex-col rounded-[22px] bg-white p-6 shadow-[0_20px_50px_-28px_rgb(59_46_37/0.45)] ring-1 ring-black/5">
                  <h3 className="font-display text-[20px] font-bold">{p.name}</h3>
                  <p className="mt-0.5 text-[15px] font-semibold text-leaf">{p.tables} tables</p>
                  <p className="mt-5">
                    <span className="font-display text-[34px] font-bold tracking-tight">{peso(p.price)}</span>
                    <span className="text-[15px] text-muted"> / year</span>
                  </p>
                  <p className="mt-1 text-[14px] text-muted">{perTableMonth(p)} per table a month</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-[22px] bg-white/70 px-5 py-4 text-center text-[15px] text-muted ring-1 ring-black/5">
              More tables? Add them to any plan for <span className="font-semibold text-ink">{peso(EXTRA_TABLE / 12)}</span> per
              table a month ({peso(EXTRA_TABLE)} a year).
            </p>

            <section className="mx-auto mt-10 max-w-xl text-center" aria-labelledby="next">
              <h2 id="next" className="font-display text-[24px] font-bold">
                Ready to keep going?
              </h2>
              <p className="mt-1.5 text-[16px] text-muted">Tell us your plan and we&apos;ll switch {name} back on.</p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                {MESSENGER_URL && (
                  <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className={`${cta} bg-forest text-white hover:bg-forest-soft`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
                      <path d="M12 2C6.4 2 2 6.1 2 11.6c0 2.9 1.2 5.4 3.1 7.1v3.3l3-1.7c.9.3 1.9.4 2.9.4 5.6 0 10-4.1 10-9.6S17.6 2 12 2zm1 12.9-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z" />
                    </svg>
                    Message us on Messenger
                  </a>
                )}
                <BookDemoButton
                  className={`${cta} ${MESSENGER_URL ? "border border-forest/80 bg-white text-forest hover:bg-leaf-tint" : "bg-forest text-white hover:bg-forest-soft"}`}
                >
                  Book a call
                </BookDemoButton>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
