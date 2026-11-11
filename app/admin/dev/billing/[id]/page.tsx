import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/app/components/Icons";
import { restaurantBilling } from "@/lib/billing";
import { formatPrice } from "@/lib/format";
import { requireDeveloper } from "@/lib/staff";
import { card, PageHead } from "@/app/admin/kit";
import Shell from "@/app/admin/Shell";
import { day, standingText } from "../parts";
import BillingBoard from "./BillingBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · tappetite", robots: { index: false, follow: false } };

/** One restaurant's contracts and payments. */
export default async function RestaurantBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDeveloper();
  const r = await restaurantBilling((await params).id);
  if (!r) notFound();
  const t = standingText(r.standing);
  const c = r.current;
  const stat = "mt-3 font-display text-[32px] font-bold leading-none tracking-tight";

  return (
    <Shell name={me.name}>
      <Link href="/admin/dev/billing" className="-ml-1 inline-flex h-10 items-center gap-0.5 rounded-lg pr-3 text-[15px] font-medium text-muted hover:text-ink">
        <ChevronLeft width={20} height={20} />
        Billing
      </Link>
      <PageHead title={r.name} sub={`Code ${r.slug}${r.off ? " · switched off" : ""}`} />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <section
          className={`relative overflow-hidden rounded-[22px] p-5 ${t.tone === "bad" ? "bg-chili text-white" : "bg-forest text-white"}`}
        >
          <p className="text-[15px] font-semibold">Standing</p>
          <p className={stat}>{t.label}</p>
          <p className="mt-3 text-[13px] text-white/80">{t.detail}</p>
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Running contract</p>
          {c ? (
            <>
              <p className={stat}>{c.plan}</p>
              <p className="mt-3 text-[13px] text-muted">
                {day(c.startsOn)} to {day(c.endsOn)}
              </p>
              <p className={`mt-0.5 text-[13px] ${r.tablesUsed > c.tables ? "font-semibold text-chili" : "text-muted"}`}>
                {r.tablesUsed} of {c.tables} tables in use{r.tablesUsed > c.tables ? ", more than the plan covers" : ""}
              </p>
            </>
          ) : (
            <>
              <p className={stat}>None</p>
              <p className="mt-3 text-[13px] text-muted">No contract covers today</p>
            </>
          )}
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Paid on it</p>
          {c ? (
            <>
              <p className={stat}>
                {formatPrice(c.paidCents)}
                <span className="ml-1.5 font-sans text-[15px] font-medium tracking-normal text-muted">of {formatPrice(c.priceCents)}</span>
              </p>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-wash" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-leaf"
                  style={{ width: `${c.priceCents ? Math.min(100, (c.paidCents / c.priceCents) * 100) : 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className={stat}>–</p>
          )}
        </section>
      </div>

      <BillingBoard billing={r} />
    </Shell>
  );
}
