import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@/app/components/Icons";
import { ago, formatPrice, hourLabel } from "@/lib/format";
import { tablesOverview, type TableSummary } from "@/lib/orders";
import { isRange, report, tableList, weekdayOf, type Range, type Report } from "@/lib/reports";
import { requireStaff } from "@/lib/staff";
import { card, PageHead } from "../kit";
import Shell from "../Shell";
import { Bars, Heatmap, type Cell } from "./Charts";
import TablePicker from "./TablePicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard · tapndine", robots: { index: false, follow: false } };

const RANGE_LABELS: Record<Range, string> = { today: "Today", "7d": "7 days", "30d": "30 days" };
const COMPARE: Record<Range, string> = {
  today: "vs yesterday, same time",
  "7d": "vs the 7 days before",
  "30d": "vs the 30 days before",
};

/** Whole pesos: averages have no business showing centavos. */
const peso = (cents: number) => formatPrice(Math.round(cents / 100) * 100);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const minutes = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const dateLabel = (day: number) =>
  new Date(day * 86400000).toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

/** The page's own address with this period and table. */
const href = (range: Range, table: string | null) => `/admin/dashboard?range=${range}${table ? `&table=${table}` : ""}`;
const change = (now: number, before: number) => (before > 0 ? now / before - 1 : null);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; table?: string }> }) {
  const me = await requireStaff("manager");
  const q = await searchParams;
  const range: Range = isRange(q.range) ? q.range : "7d";
  const tables = await tableList(me.business_id);
  // Only one of this restaurant's own tables; anything else shows them all.
  const table = tables.find((t) => t.id === q.table) ?? null;
  const [r, live] = await Promise.all([report(me.business_id, range, table?.id ?? null), tablesOverview(me.business_id)]);
  // Charts keep their tapped bar/cell across soft navigation; a new period or
  // table has different bars, so start them fresh (else "Today" crashes).
  const view = href(range, table?.id ?? null);

  return (
    <Shell name={me.name}>
      <PageHead title="Dashboard">
        <nav aria-label="Period" className="flex rounded-full bg-white p-1 shadow-[0_1px_2px_rgb(16_52_42/0.06)]">
          {(Object.keys(RANGE_LABELS) as Range[]).map((k) => (
            <Link
              key={k}
              href={href(k, table?.id ?? null)}
              aria-current={k === range ? "page" : undefined}
              className={`flex h-9 items-center rounded-full px-4 text-[14px] font-semibold ${
                k === range ? "bg-forest text-white" : "text-muted hover:text-ink"
              }`}
            >
              {RANGE_LABELS[k]}
            </Link>
          ))}
        </nav>
        <TablePicker range={range} tables={tables} current={table?.id ?? null} />
      </PageHead>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stats r={r} live={live} filtered={table?.label ?? null} />

        <section key={`bars ${view}`} className={`${card} sm:col-span-2`}>
          {r.range === "today" ? <HoursToday r={r} /> : <SalesByDay r={r} />}
        </section>
        <LiveTables live={live} />
        <TopDishes r={r} />

        <section key={`heat ${view}`} className={`${card} sm:col-span-2`}>
          <BusyHours r={r} />
        </section>
        <SecondRounds r={r} />

        <PerTable r={r} range={range} filtered={!!table} />
        <Corrections r={r} />
        <HomePicks r={r} />
      </div>

      <p className="mt-6 max-w-2xl text-[13px] text-muted">
        These count orders guests sent, not money collected. The cashier&apos;s POS has the final sales.
      </p>
    </Shell>
  );
}

function CardHead({ title, sub, link }: { title: string; sub?: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[19px] font-bold leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {link && (
        <Link
          href={link.href}
          aria-label={link.label}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink hover:border-forest hover:text-forest"
        >
          <ArrowUpRight width={18} height={18} />
        </Link>
      )}
    </div>
  );
}

function Delta({ value, range, dark }: { value: number | null; range: Range; dark?: boolean }) {
  if (value == null || !Number.isFinite(value)) {
    return <p className={`mt-3 text-[13px] ${dark ? "text-white/60" : "text-muted"}`}>Nothing to compare yet</p>;
  }
  const up = value >= 0;
  return (
    <p className={`mt-3 flex items-center gap-1.5 text-[13px] ${dark ? "text-white/75" : "text-muted"}`}>
      <span
        className={`rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
          dark ? "bg-white/15 text-mango" : up ? "bg-leaf-tint text-leaf" : "bg-chili/10 text-chili"
        }`}
      >
        {up ? "▲" : "▼"} {pct(Math.abs(value))}
      </span>
      {COMPARE[range]}
    </p>
  );
}

function Stats({ r, live, filtered }: { r: Report; live: TableSummary[]; filtered: string | null }) {
  const c = r.current;
  const p = r.previous;
  const busy = live.filter((t) => t.items > 0);
  const stat = "mt-3 font-display text-[40px] font-bold leading-none tracking-tight";
  return (
    <>
      {/* The one dark card, with the banig strip the menu header wears. */}
      <section className="relative overflow-hidden rounded-[22px] bg-forest p-5 pb-8 text-white">
        <p className="text-[15px] font-semibold">{filtered ? `Orders sent at ${filtered}` : "Orders sent"}</p>
        <p className={stat}>{peso(c.total)}</p>
        <Delta value={change(c.total, p.total)} range={r.range} dark />
        <div className="banig absolute inset-x-0 bottom-0" aria-hidden="true" />
      </section>
      <section className={card}>
        <p className="text-[15px] font-semibold">Groups served</p>
        <p className={stat}>{c.tables}</p>
        <Delta value={change(c.tables, p.tables)} range={r.range} />
      </section>
      <section className={card}>
        <p className="text-[15px] font-semibold">Average per group</p>
        <p className={stat}>{c.tables ? peso(c.total / c.tables) : "–"}</p>
        <Delta
          value={c.tables && p.tables ? change(c.total / c.tables, p.total / p.tables) : null}
          range={r.range}
        />
      </section>
      <section className={card}>
        <CardHead title="Ordering now" link={{ href: "/admin", label: "Open Tables" }} />
        <p className={stat}>
          {busy.length}
          <span className="ml-1.5 font-sans text-[16px] font-medium tracking-normal text-muted">of {live.length} tables</span>
        </p>
        <p className="mt-3 text-[13px] text-muted">
          {busy.length ? `${peso(busy.reduce((n, t) => n + t.totalCents, 0))} on the open bills` : "No open orders right now"}
        </p>
      </section>
    </>
  );
}

function SalesByDay({ r }: { r: Report }) {
  const bars = r.byDay.map((d) => ({ key: d.day, label: dateLabel(d.day), value: d.total, display: formatPrice(d.total) }));
  return (
    <>
      <CardHead title="Sales by day" />
      <div className="mt-6">
        <Bars bars={bars} money tickEvery={r.days > 7 ? 7 : 1} initial={bars.length - 1} />
      </div>
    </>
  );
}

function HoursToday({ r }: { r: Report }) {
  if (r.byHour.length === 0) {
    return (
      <>
        <CardHead title="Today by the hour" />
        <Empty>No orders sent yet today.</Empty>
      </>
    );
  }
  const hours = r.byHour.map((h) => h.hour);
  const lo = Math.min(...hours);
  const hi = Math.max(...hours);
  const byHour = new Map(r.byHour.map((h) => [h.hour, h.orders]));
  const bars = Array.from({ length: hi - lo + 1 }, (_, i) => {
    const h = lo + i;
    const n = byHour.get(h) ?? 0;
    return { key: h, label: hourLabel(h), value: n, display: `${n} order${n === 1 ? "" : "s"} sent` };
  });
  return (
    <>
      <CardHead title="Today by the hour" />
      <div className="mt-6">
        <Bars bars={bars} tickEvery={bars.length > 8 ? 3 : 1} initial={bars.length - 1} />
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-paper px-4 py-8 text-center text-[15px] text-muted">{children}</p>;
}

function LiveTables({ live }: { live: TableSummary[] }) {
  const busy = live.filter((t) => t.items > 0).sort((a, b) => (b.lastOrderAt ?? 0) - (a.lastOrderAt ?? 0));
  return (
    <section className={card}>
      <CardHead title="Open tables" link={{ href: "/admin", label: "Open Tables" }} />
      {busy.length === 0 ? (
        <Empty>Every table is clear.</Empty>
      ) : (
        <ul className="mt-4 space-y-2">
          {busy.slice(0, 5).map((t) => (
            <li key={t.id}>
              <Link href={`/admin/t/${t.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3.5 py-3 hover:bg-leaf-tint">
                <span className="min-w-0">
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-[13px] text-muted">
                    {t.guests} {t.guests === 1 ? "guest" : "guests"}
                    {t.lastOrderAt ? `, last order ${ago(t.lastOrderAt)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-display text-[17px] font-bold text-forest">{formatPrice(t.totalCents)}</span>
              </Link>
            </li>
          ))}
          {busy.length > 5 && <li className="px-1 text-[13px] text-muted">and {busy.length - 5} more</li>}
        </ul>
      )}
    </section>
  );
}

function TopDishes({ r }: { r: Report }) {
  const top = r.dishes.slice(0, 6);
  return (
    <section className={`${card} sm:col-span-2 xl:col-span-1 xl:row-span-2`}>
      <CardHead title="Top dishes" link={{ href: "/admin/menu", label: "Open Menu" }} />
      {top.length === 0 ? (
        <Empty>No dishes ordered in this period yet.</Empty>
      ) : (
        <ol className="mt-4 space-y-3">
          {top.map((d) => (
            <li key={d.id} className="flex items-center gap-3">
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="h-11 w-11 shrink-0 rounded-xl bg-wash" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{d.name}</span>
                <span className="block text-[13px] text-muted">
                  {d.qty} sent, {peso(d.total)}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">#{d.rank}</span>
            </li>
          ))}
        </ol>
      )}
      {r.unordered.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[15px] font-semibold">Nobody ordered ({r.unordered.length})</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{r.unordered.map((d) => d.name).join(", ")}</p>
        </div>
      )}
    </section>
  );
}

function BusyHours({ r }: { r: Report }) {
  if (r.byHour.length === 0) {
    return (
      <>
        <CardHead title="Busy hours" />
        <Empty>No orders sent in this period yet.</Empty>
      </>
    );
  }
  if (r.range === "today") {
    return (
      <>
        <CardHead title="Busy hours" sub="Switch to 7 or 30 days to see a typical week." />
        <Empty>One day is too little to show a pattern.</Empty>
      </>
    );
  }
  // Average per weekday and hour, so a 30-day view reads as "a typical
  // Friday at 7". Today only counts for the hours it has had so far.
  const hrs = r.byHour.map((h) => h.hour);
  const lo = Math.min(...hrs);
  const hi = Math.max(...hrs);
  const sums = new Map<string, Cell>();
  const seen = new Map<string, number>();
  for (const d of r.byDay) {
    for (let h = lo; h <= hi; h++) {
      if (d.day === r.today && h > r.hourNow) continue;
      const key = `${weekdayOf(d.day)}-${h}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  for (const h of r.byHour) {
    const w = weekdayOf(h.day);
    const key = `${w}-${h.hour}`;
    const cell = sums.get(key) ?? { weekday: w, hour: h.hour, avg: 0 };
    cell.avg += h.orders / seen.get(key)!;
    sums.set(key, cell);
  }
  return (
    <>
      <CardHead title="Busy hours" sub="A typical week" />
      <div className="mt-4">
        <Heatmap cells={[...sums.values()]} hours={Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)} />
      </div>
    </>
  );
}

/** Half-ring gauge: the share of groups that ordered again. */
function SecondRounds({ r }: { r: Report }) {
  const t = r.tables;
  const rate = t.reorderRate ?? 0;
  const len = Math.PI * 80; // half of a radius-80 circle
  return (
    <section className={`${card} sm:col-span-2 xl:col-span-1`}>
      <CardHead title="Second rounds" sub="Ordered again 15+ min later" />
      <div className="relative mx-auto mt-4 w-full max-w-[260px]">
        <svg viewBox="0 0 200 110" className="w-full" aria-hidden="true">
          <path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="#EEF1EC" strokeWidth="22" strokeLinecap="round" />
          {/* Nothing at 0%: a zero-length round-capped line still draws a dot. */}
          {rate > 0 && (
            <path
              d="M20 100a80 80 0 0 1 160 0"
              fill="none"
              stroke="#10342A"
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray={`${len * rate} ${len}`}
            />
          )}
        </svg>
        <p className="absolute inset-x-0 bottom-0 text-center">
          <span className="block font-display text-[36px] font-bold leading-none">{t.reorderRate != null ? pct(rate) : "–"}</span>
          <span className="text-[13px] text-muted">of {t.served} groups</span>
        </p>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Typical stay", t.medianStay != null ? minutes(t.medianStay) : "–"],
          ["Tap to order", t.medianTapToSend != null ? minutes(t.medianTapToSend) : "–"],
          ["Groups / table / day", t.turnsPerDay != null ? t.turnsPerDay.toFixed(1).replace(/\.0$/, "") : "–"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-paper px-2 py-2.5">
            <dd className="font-semibold">{v}</dd>
            <dt className="mt-0.5 text-[12px] leading-tight text-muted">{k}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

const th = "py-2.5 text-left text-[13px] font-medium text-muted";

function PerTable({ r, range, filtered }: { r: Report; range: Range; filtered: boolean }) {
  const t = r.tables;
  return (
    <section className={`${card} sm:col-span-2`}>
      <CardHead title="Tables" sub={filtered ? undefined : "Click a table to see only its numbers"} />
      {t.served === 0 ? (
        <Empty>No tables have ordered in this period yet.</Empty>
      ) : (
        <table className="mt-3 w-full text-[15px]">
          <thead>
            <tr>
              <th className={th}>Table</th>
              <th className={`${th} text-right`}>Sent</th>
              <th className={`${th} text-right`}>Groups</th>
              <th className={`${th} text-right`}>Average</th>
            </tr>
          </thead>
          <tbody>
            {t.perTable.map((x) => (
              <tr key={x.id} className="border-t border-line">
                <td>
                  <Link href={href(range, x.id)} className="flex min-h-11 items-center font-semibold text-leaf hover:underline">
                    {x.label}
                  </Link>
                </td>
                <td className="text-right tabular-nums">{peso(x.total)}</td>
                <td className="text-right tabular-nums">{x.sittings}</td>
                <td className="text-right tabular-nums">{x.avg != null ? peso(x.avg) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Corrections({ r }: { r: Report }) {
  const c = r.corrections;
  return (
    <section className={`${card} sm:col-span-2 xl:col-span-1`}>
      <CardHead title="Corrections" sub="Fixed by the waiter at read-back" />
      {r.tables.served === 0 ? (
        <Empty>No tables have ordered in this period yet.</Empty>
      ) : (
        <>
          <p className="mt-3 font-display text-[32px] font-bold leading-none">
            {c.tables}
            <span className="ml-1.5 font-sans text-[15px] font-medium text-muted">of {r.tables.served} groups</span>
          </p>
          {c.dishes.length > 0 ? (
            <ul className="mt-4 space-y-2 text-[14px]">
              {c.dishes.slice(0, 5).map((d) => (
                <li key={d.id} className="flex justify-between gap-3">
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {d.removed} removed, {d.changed} fixed
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted">No dish needed correcting.</p>
          )}
        </>
      )}
    </section>
  );
}

function HomePicks({ r }: { r: Report }) {
  const flagged = [
    ...r.dishes.filter((d) => d.featured || d.bestSeller),
    ...r.unordered.filter((d) => d.featured || d.bestSeller).map((d) => ({ ...d, rank: null as number | null })),
  ];
  return (
    <section className={`${card} sm:col-span-2 xl:col-span-1`}>
      <CardHead title="Menu home picks" sub="Swap any that rank low" link={{ href: "/admin/menu", label: "Open Menu" }} />
      {flagged.length === 0 ? (
        <Empty>No hero or featured dishes picked.</Empty>
      ) : (
        <ul className="mt-4 space-y-2.5 text-[14px]">
          {flagged.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{d.name}</span>
                <span className="text-[13px] text-muted">{d.featured ? "Hero" : "Featured"}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ${
                  d.rank && d.rank <= 5 ? "bg-leaf-tint text-leaf" : "bg-chili/10 text-chili"
                }`}
              >
                {d.rank ? `#${d.rank} of ${r.dishes.length}` : "Not ordered"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
