import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "@/app/components/Icons";
import { billingOverview, RENEW_DAYS } from "@/lib/billing";
import { formatPrice } from "@/lib/format";
import { requireDeveloper } from "@/lib/staff";
import { card, PageHead } from "@/app/admin/kit";
import Shell from "@/app/admin/Shell";
import { day, StandingBadge, standingText } from "./parts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · tappetite", robots: { index: false, follow: false } };

/** Every restaurant's contract and payments, the ones needing action first. */
export default async function BillingPage() {
  const me = await requireDeveloper();
  const b = await billingOverview();
  const owing = b.rows.filter((r) => r.standing.kind === "due").length;
  const stat = "mt-3 font-display text-[40px] font-bold leading-none tracking-tight";

  return (
    <Shell name={me.name}>
      <PageHead title="Billing" sub="What each restaurant signed and paid, as you record it." />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="relative overflow-hidden rounded-[22px] bg-forest p-5 text-white">
          <p className="text-[15px] font-semibold">Collected, last 30 days</p>
          <p className={stat}>{formatPrice(b.collected30)}</p>
          <p className="mt-3 text-[13px] text-white/75">{formatPrice(b.collectedYear)} so far this year</p>
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Owed now</p>
          <p className={stat}>{formatPrice(b.owedCents)}</p>
          <p className="mt-3 text-[13px] text-muted">
            {owing ? `${owing} ${owing === 1 ? "restaurant" : "restaurants"} to follow up` : "Nobody owes anything"}
          </p>
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Renew soon</p>
          <p className={stat}>{b.renewSoon}</p>
          <p className="mt-3 text-[13px] text-muted">Ending within {RENEW_DAYS} days, nothing new signed</p>
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Under contract</p>
          <p className={stat}>
            {b.rows.filter((r) => r.current).length}
            <span className="ml-1.5 font-sans text-[16px] font-medium tracking-normal text-muted">of {b.rows.length}</span>
          </p>
          <p className="mt-3 text-[13px] text-muted">Restaurants with a contract running today</p>
        </section>
      </div>

      <section className={`${card} mt-4`}>
        <h2 className="font-display text-[19px] font-bold">Restaurants</h2>
        <p className="mt-0.5 text-[13px] text-muted">Those needing action first. Click one to record a contract or a payment.</p>
        <ul className="mt-2">
          {b.rows.map((r) => {
            const t = standingText(r.standing);
            const c = r.current;
            return (
              <li key={r.id} className="border-t border-line first:border-t-0">
                <Link
                  href={`/admin/dev/billing/${r.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3.5 hover:bg-paper"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[17px] font-bold leading-tight">{r.name}</span>
                      <StandingBadge standing={r.standing} />
                      {r.off && <span className="rounded-full bg-wash px-2.5 py-1 text-[12px] font-semibold text-muted">Switched off</span>}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted">
                      {c
                        ? `${c.plan} · ${day(c.startsOn)} to ${day(c.endsOn)} · ${formatPrice(c.paidCents)} of ${formatPrice(c.priceCents)} paid`
                        : t.detail}
                    </span>
                    {c && (
                      <span className={`mt-0.5 block text-[13px] ${r.tablesUsed > c.tables ? "font-semibold text-chili" : "text-muted"}`}>
                        {r.tablesUsed} of {c.tables} tables in use{r.tablesUsed > c.tables ? ", more than the plan covers" : ""}
                      </span>
                    )}
                    {c && r.standing.kind !== "paid" && <span className="mt-0.5 block text-[13px] text-muted">{t.detail}</span>}
                  </span>
                  <ChevronRight width={20} height={20} className="shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </Shell>
  );
}
