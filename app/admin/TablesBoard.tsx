"use client";

import Link from "next/link";
import type { TableSummary } from "@/lib/orders";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { ago, formatPrice } from "@/lib/format";
import { PageHead } from "./kit";
import Shell from "./Shell";
import { OfflineNote, StaffNav, usePoll } from "./ui";

/**
 * Every table as a button; tables with orders stand out and show their total.
 * Waiters get the staff layout (wider on tablets and desktop), managers the dashboard frame.
 */
export default function TablesBoard({
  initial,
  staffName,
  isManager,
}: {
  initial: TableSummary[];
  staffName: string;
  isManager: boolean;
}) {
  const { data: tables, offline } = usePoll("/api/staff/tables", initial, (d) => (d as { tables: TableSummary[] }).tables);
  const busy = tables.filter((t) => t.items > 0).length;
  const flagged = tables.filter((t) => t.newOrders > 0 || t.calls.length > 0).length;
  const summary =
    (busy === 0 ? "No orders yet." : `${busy} ${busy === 1 ? "table has" : "tables have"} orders.`) +
    (flagged ? ` ${flagged} ${flagged === 1 ? "needs" : "need"} you.` : "");

  const grid = (
    <ul className={`grid auto-rows-fr gap-3 ${isManager ? "mt-6 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "mt-4 grid-cols-2 sm:grid-cols-3 md:mt-6 md:grid-cols-4 md:gap-4 lg:grid-cols-5"}`}>
      {tables.map((t) => {
        const active = t.items > 0;
        const flags = [
          ...(t.newOrders > 0 ? [t.newOrders === 1 ? "New order" : `${t.newOrders} new orders`] : []),
          ...t.calls.map((c) => (c === "bill" ? "Wants the bill" : "Calling waiter")),
        ];
        return (
          <li key={t.id}>
            <Link
              href={`/admin/t/${t.id}`}
              aria-label={flags.length ? `${t.label}: ${flags.join(", ")}` : undefined}
              className={`relative flex h-full flex-col p-4 ${flags.length ? "ring-[3px] ring-mango ring-offset-2 ring-offset-paper " : ""}${isManager ? "min-h-[150px] rounded-[22px]" : "min-h-[124px] rounded-2xl"} ${
                active
                  ? "bg-forest text-white shadow-[0_8px_20px_rgb(16_52_42/0.25)] hover:bg-forest-soft active:bg-forest-soft"
                  : `${isManager ? "bg-white shadow-[0_1px_2px_rgb(16_52_42/0.06)]" : "border border-line bg-white"} hover:bg-leaf-tint active:bg-wash`
              }`}
            >
              <span className="font-display text-[22px] font-bold leading-tight">{t.label}</span>
              {flags.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {flags.map((f) => (
                    <span key={f} className="whitespace-nowrap rounded-full bg-mango px-2.5 py-0.5 text-[12px] font-bold text-forest">
                      {f}
                    </span>
                  ))}
                </span>
              )}
              {active ? (
                <>
                  <span className="mt-1 text-[14px] text-white/75">
                    {t.guests} {t.guests === 1 ? "guest" : "guests"} · {t.items} {t.items === 1 ? "item" : "items"}
                  </span>
                  <span className="mt-auto pt-2 font-display text-xl font-bold text-mango">{formatPrice(t.totalCents)}</span>
                  {t.lastOrderAt && <span className="text-[13px] text-white/60">Last order {ago(t.lastOrderAt)}</span>}
                </>
              ) : (
                <span className="mt-1 text-[14px] text-muted">No orders</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (isManager) {
    return (
      <Shell name={staffName}>
        <OfflineNote offline={offline} />
        <PageHead title="Tables" sub={`Live. ${summary} Click a table to see its orders.`} />
        {grid}
      </Shell>
    );
  }

  return (
    <>
      <WarmBackdrop />
      <StaffNav isManager={false} />
      <OfflineNote offline={offline} />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4 md:max-w-5xl md:px-6 md:pt-8 lg:max-w-6xl">
        <h1 className="font-display text-[28px] font-bold leading-tight">Tables</h1>
        <p className="mt-1 text-[15px] text-muted">
          Hi {staffName}. {summary}
        </p>
        {grid}
      </main>
    </>
  );
}
