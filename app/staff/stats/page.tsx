import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice, hourLabel } from "@/lib/format";
import { isRange, report, tableList, weekdayOf, type Range, type Report } from "@/lib/reports";
import { requireStaff } from "@/lib/staff";
import { StaffNav } from "../ui";
import { Bars, Heatmap, type Cell } from "./Charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Statistics · tapndine", robots: { index: false, follow: false } };

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
const href = (range: Range, table: string | null) => `/staff/stats?range=${range}${table ? `&table=${table}` : ""}`;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string; table?: string }> }) {
  const me = await requireStaff("manager");
  const q = await searchParams;
  const range: Range = isRange(q.range) ? q.range : "7d";
  const tables = await tableList(me.business_id);
  // Only one of this restaurant's own tables; anything else shows them all.
  const table = tables.find((t) => t.id === q.table) ?? null;
  const r = await report(me.business_id, range, table?.id ?? null);
  const chip = "flex h-11 shrink-0 items-center justify-center rounded-lg px-4 text-[15px] font-semibold";

  return (
    <>
      <StaffNav isManager />
      <main className="mx-auto max-w-3xl px-4 pb-14 pt-4">
        <h1 className="font-display text-[28px] font-bold leading-tight">Statistics</h1>
        <nav aria-label="Period" className="mt-3 flex gap-1 rounded-xl bg-wash p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((k) => (
            <Link
              key={k}
              href={href(k, table?.id ?? null)}
              aria-current={k === range ? "page" : undefined}
              className={`${chip} flex-1 ${k === range ? "bg-white text-ink shadow-sm" : "text-muted"}`}
            >
              {RANGE_LABELS[k]}
            </Link>
          ))}
        </nav>
        <nav aria-label="Table" className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {[{ id: null, label: "All tables" }, ...tables].map((t) => {
            const here = (table?.id ?? null) === t.id;
            return (
              <Link
                key={t.id ?? "all"}
                href={href(range, t.id)}
                aria-current={here ? "page" : undefined}
                className={`${chip} border ${here ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-2 text-[13px] text-muted">
          {table && <strong className="font-semibold text-ink">Showing {table.label} only. </strong>}
          Counts what guests sent from their phones, after the waiter&apos;s corrections. The cashier&apos;s POS has the
          final sales.
        </p>

        <Overview r={r} />
        <Busy r={r} />
        <Dishes r={r} />
        <Tables r={r} range={range} filtered={!!table} />
        <Corrections r={r} />
      </main>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {sub && <p className="mt-0.5 text-[14px] text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const card = "rounded-2xl border border-line bg-white";

function Tile({ label, value, delta, note }: { label: string; value: string; delta?: number | null; note?: string }) {
  return (
    <div className={`${card} p-3.5`}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-[24px] font-semibold leading-tight">{value}</p>
      {delta != null && Number.isFinite(delta) && (
        <p className={`mt-1 text-[13px] font-medium ${delta >= 0 ? "text-leaf" : "text-chili"}`}>
          {delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))}
        </p>
      )}
      {note && <p className="mt-1 text-[13px] text-muted">{note}</p>}
    </div>
  );
}

const change = (now: number, before: number) => (before > 0 ? now / before - 1 : null);

function Overview({ r }: { r: Report }) {
  const c = r.current;
  const p = r.previous;
  return (
    <Section title="Overview" sub={`Arrows compare ${COMPARE[r.range].replace("vs ", "with ")}.`}>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Orders sent" value={peso(c.total)} delta={change(c.total, p.total)} />
        <Tile label="Groups served" value={String(c.tables)} delta={change(c.tables, p.tables)} />
        <Tile
          label="Average per group"
          value={c.tables ? peso(c.total / c.tables) : "–"}
          delta={c.tables && p.tables ? change(c.total / c.tables, p.total / p.tables) : null}
        />
        <Tile
          label="Average per phone"
          value={c.phones ? peso(c.guestTotal / c.phones) : "–"}
          note="One phone often orders for two or more"
        />
      </div>
      {r.range !== "today" && c.total > 0 && <SalesByDay r={r} />}
    </Section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={`${card} px-4 py-6 text-center text-[15px] text-muted`}>{children}</p>;
}

function Busy({ r }: { r: Report }) {
  if (r.byHour.length === 0) {
    return (
      <Section title="Busy hours">
        <Empty>No orders sent in this period yet.</Empty>
      </Section>
    );
  }

  if (r.range === "today") {
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
      <Section title="Busy hours" sub="Orders sent each hour today. Tap a bar.">
        <div className={`${card} p-4`}>
          <Bars bars={bars} tickEvery={bars.length > 8 ? 3 : 1} initial={bars.length - 1} />
        </div>
      </Section>
    );
  }

  // Average per weekday and hour, so a 30-day view reads as "a typical
  // Friday at 7". Today only counts for the hours it has had so far: at
  // 10 AM, today is not yet a Saturday evening with no orders.
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
    <Section title="Busy hours" sub="Orders sent on a typical day of the week. Darker is busier. Tap a square.">
      <div className={`${card} p-4`}>
        <Heatmap cells={[...sums.values()]} hours={Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)} />
      </div>
    </Section>
  );
}

function SalesByDay({ r }: { r: Report }) {
  const bars = r.byDay.map((d) => ({ key: d.day, label: dateLabel(d.day), value: d.total, display: formatPrice(d.total) }));
  return (
    <div className={`${card} mt-2.5 p-4`}>
      <p className="mb-2 text-[13px] font-medium text-muted">Orders sent each day. Tap a bar.</p>
      <Bars bars={bars} money tickEvery={r.days > 7 ? 7 : 1} initial={bars.length - 1} />
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-block rounded-full bg-mango-soft px-2 py-px align-[1px] text-[11px] font-semibold text-ink">
      {children}
    </span>
  );
}

function Dishes({ r }: { r: Report }) {
  const flagged = [
    ...r.dishes.filter((d) => d.featured || d.bestSeller),
    ...r.unordered.filter((d) => d.featured || d.bestSeller).map((d) => ({ ...d, rank: null as number | null })),
  ];
  const row = (d: Report["dishes"][number]) => (
    <tr key={d.id} className="border-t border-line">
      <td className="py-2.5 pl-4 pr-2 align-top tabular-nums text-muted">{d.rank}</td>
      <td className="py-2.5 pr-2 align-top">
        {d.name}
        {d.featured ? <Badge>Hero</Badge> : null}
        {d.bestSeller ? <Badge>Best seller</Badge> : null}
      </td>
      <td className="py-2.5 pr-2 text-right align-top tabular-nums">{d.qty}</td>
      <td className="py-2.5 pr-4 text-right align-top tabular-nums">{peso(d.total)}</td>
    </tr>
  );
  const TOP = 10;

  return (
    <Section title="Dishes" sub="What sells, and what to rethink.">
      {flagged.length > 0 && (
        <div className={`${card} mt-2.5 p-4`}>
          <p className="text-[15px] font-semibold">Menu home picks</p>
          <p className="text-[13px] text-muted">
            The dishes the menu shows first. If they rank low, swap them for ones that sell.
          </p>
          <ul className="mt-2 space-y-1 text-[15px]">
            {flagged.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <span>
                  {d.name}
                  <span className="text-muted"> · {d.featured ? "Hero" : "Best seller"}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${d.rank && d.rank <= 5 ? "" : "font-semibold text-chili"}`}>
                  {d.rank ? `#${d.rank} of ${r.dishes.length}` : "Not ordered"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.dishes.length === 0 ? (
        <div className="mt-2.5">
          <Empty>No dishes ordered in this period yet.</Empty>
        </div>
      ) : (
        <div className={`${card} mt-2.5 overflow-hidden`}>
          <table className="w-full text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
                <th className="py-2.5 pr-2 font-medium">Dish</th>
                <th className="py-2.5 pr-2 text-right font-medium">Qty</th>
                <th className="py-2.5 pr-4 text-right font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>{r.dishes.slice(0, TOP).map(row)}</tbody>
          </table>
          {r.dishes.length > TOP && (
            <details className="group border-t border-line">
              <summary className="flex h-12 cursor-pointer list-none items-center justify-center text-[15px] font-semibold text-leaf">
                <span className="group-open:hidden">Show all {r.dishes.length}</span>
                <span className="hidden group-open:inline">Show top {TOP}</span>
              </summary>
              <table className="w-full text-[15px]">
                <tbody>{r.dishes.slice(TOP).map(row)}</tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {r.unordered.length > 0 && (
        <div className={`${card} mt-2.5 p-4`}>
          <p className="text-[15px] font-semibold">Not ordered in this period ({r.unordered.length})</p>
          <p className="text-[13px] text-muted">On the menu and available, but nobody sent them.</p>
          <p className="mt-2 text-[15px]">{r.unordered.map((d) => d.name).join(" · ")}</p>
        </div>
      )}
    </Section>
  );
}

function Tables({ r, range, filtered }: { r: Report; range: Range; filtered: boolean }) {
  const t = r.tables;
  if (t.served === 0) {
    return (
      <Section title="Tables">
        <Empty>No tables have ordered in this period yet.</Empty>
      </Section>
    );
  }
  const best = t.perTable[0]?.total ?? 0;
  return (
    <Section title="Tables" sub="Typical (median) times, so one table left open overnight can't skew them.">
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Typical stay" value={t.medianStay != null ? minutes(t.medianStay) : "–"} note="First tap to Clear table" />
        <Tile
          label="Tap to first order"
          value={t.medianTapToSend != null ? minutes(t.medianTapToSend) : "–"}
          note="Long? The menu may be hard to use"
        />
        <Tile
          label="Ordered a second round"
          value={t.reorderRate != null ? pct(t.reorderRate) : "–"}
          note="Sent again 15+ min after the first order"
        />
        <Tile
          label="Groups per table, per day"
          value={t.turnsPerDay != null ? t.turnsPerDay.toFixed(1).replace(/\.0$/, "") : "–"}
        />
      </div>
      {!filtered && (
        <div className={`${card} mt-2.5 overflow-hidden`}>
          <p className="px-4 pt-3 text-[13px] text-muted">Best-selling table first. Tap a table to see only its numbers.</p>
          <table className="mt-1 w-full text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="py-2.5 pl-4 pr-2 font-medium">Table</th>
                <th className="py-2.5 pr-2 text-right font-medium">Sent</th>
                <th className="py-2.5 pr-2 text-right font-medium">Groups</th>
                <th className="py-2.5 pr-4 text-right font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {t.perTable.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="pl-4 pr-2">
                    <Link href={href(range, x.id)} className="flex min-h-11 items-center gap-1.5 font-medium text-leaf">
                      {x.label}
                      {x.total > 0 && x.total === best && <Badge>Top</Badge>}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-2 text-right tabular-nums">{peso(x.total)}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums">{x.sittings}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{x.avg != null ? peso(x.avg) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Corrections({ r }: { r: Report }) {
  const c = r.corrections;
  return (
    <Section
      title="Corrections at confirmation"
      sub="Lines the waiter changed or removed while reading the order back. A dish that keeps getting corrected may have a misleading photo or description."
    >
      {r.tables.served === 0 ? (
        <Empty>No tables have ordered in this period yet.</Empty>
      ) : (
        <>
          <Tile
            label="Groups with a correction"
            value={`${c.tables} of ${r.tables.served}`}
            note={c.rate != null ? `${pct(c.rate)} of groups` : undefined}
          />
          {c.dishes.length > 0 && (
            <div className={`${card} mt-2.5 overflow-hidden`}>
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    <th className="py-2.5 pl-4 pr-2 font-medium">Dish</th>
                    <th className="py-2.5 pr-2 text-right font-medium">Groups</th>
                    <th className="py-2.5 pr-2 text-right font-medium">Removed</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Qty fixed</th>
                  </tr>
                </thead>
                <tbody>
                  {c.dishes.map((d) => (
                    <tr key={d.id} className="border-t border-line">
                      <td className="py-2.5 pl-4 pr-2">{d.name}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{d.tables}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{d.removed}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{d.changed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
