import type { Metadata } from "next";
import Link from "next/link";
import { restaurants } from "@/lib/dev";
import { formatPrice } from "@/lib/format";
import { isRange, type Range } from "@/lib/reports";
import { requireDeveloper } from "@/lib/staff";
import { card, PageHead } from "../kit";
import Shell from "../Shell";
import DevBoard from "./DevBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Restaurants · tapndine", robots: { index: false, follow: false } };

const RANGE_LABELS: Record<Range, string> = { today: "Today", "7d": "7 days", "30d": "30 days" };

/** Whole pesos, as on the restaurant dashboard. */
const peso = (cents: number) => formatPrice(Math.round(cents / 100) * 100);

/** The developers' home: every restaurant on tapndine. */
export default async function DevPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await requireDeveloper();
  const q = await searchParams;
  const range: Range = isRange(q.range) ? q.range : "7d";
  const list = await restaurants(range);
  const live = list.filter((r) => !r.off);
  const sum = (k: "sent" | "groups" | "ordering") => list.reduce((n, r) => n + r[k], 0);
  const stat = "mt-3 font-display text-[40px] font-bold leading-none tracking-tight";

  return (
    <Shell name={me.name}>
      <PageHead title="Restaurants" sub="Every restaurant on tapndine. Open one to work in it as its manager.">
        <nav aria-label="Period" className="flex rounded-full bg-white p-1 shadow-[0_1px_2px_rgb(16_52_42/0.06)]">
          {(Object.keys(RANGE_LABELS) as Range[]).map((k) => (
            <Link
              key={k}
              href={`/staff/dev?range=${k}`}
              aria-current={k === range ? "page" : undefined}
              className={`flex h-9 items-center rounded-full px-4 text-[14px] font-semibold ${
                k === range ? "bg-forest text-white" : "text-muted hover:text-ink"
              }`}
            >
              {RANGE_LABELS[k]}
            </Link>
          ))}
        </nav>
      </PageHead>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="relative overflow-hidden rounded-[22px] bg-forest p-5 pb-8 text-white">
          <p className="text-[15px] font-semibold">Orders sent, all restaurants</p>
          <p className={stat}>{peso(sum("sent"))}</p>
          <p className="mt-3 text-[13px] text-white/75">{RANGE_LABELS[range]}</p>
          <div className="banig absolute inset-x-0 bottom-0" aria-hidden="true" />
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Groups served</p>
          <p className={stat}>{sum("groups")}</p>
          <p className="mt-3 text-[13px] text-muted">{RANGE_LABELS[range]}</p>
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Ordering now</p>
          <p className={stat}>
            {sum("ordering")}
            <span className="ml-1.5 font-sans text-[16px] font-medium tracking-normal text-muted">tables</span>
          </p>
          <p className="mt-3 text-[13px] text-muted">With orders on an open bill</p>
        </section>
        <section className={card}>
          <p className="text-[15px] font-semibold">Restaurants</p>
          <p className={stat}>
            {live.length}
            <span className="ml-1.5 font-sans text-[16px] font-medium tracking-normal text-muted">live</span>
          </p>
          <p className="mt-3 text-[13px] text-muted">
            {list.length - live.length ? `${list.length - live.length} switched off` : "None switched off"}
          </p>
        </section>
      </div>

      <DevBoard list={list} openId={me.business_id} rangeLabel={RANGE_LABELS[range]} />

      <p className="mt-6 max-w-2xl text-[13px] text-muted">
        Orders sent are what guests and waiters sent, not money collected, the same count as each restaurant&apos;s own
        dashboard.
      </p>
    </Shell>
  );
}
