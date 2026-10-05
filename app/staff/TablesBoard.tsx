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
 * Waiters get it on their phone layout, managers inside the dashboard frame.
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
  const summary = busy === 0 ? "No orders yet." : `${busy} ${busy === 1 ? "table has" : "tables have"} orders.`;

  const grid = (
    <ul className={`grid auto-rows-fr gap-3 ${isManager ? "mt-6 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "mt-4 grid-cols-2 sm:grid-cols-3"}`}>
      {tables.map((t) => {
        const active = t.items > 0;
        return (
          <li key={t.id}>
            <Link
              href={`/staff/t/${t.id}`}
              className={`flex h-full flex-col p-4 ${isManager ? "min-h-[150px] rounded-[22px]" : "min-h-[124px] rounded-2xl"} ${
                active
                  ? "bg-forest text-white shadow-[0_8px_20px_rgb(16_52_42/0.25)] hover:bg-forest-soft active:bg-forest-soft"
                  : `${isManager ? "bg-white shadow-[0_1px_2px_rgb(16_52_42/0.06)]" : "border border-line bg-white"} hover:bg-leaf-tint active:bg-wash`
              }`}
            >
              <span className="font-display text-[22px] font-bold leading-tight">{t.label}</span>
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
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <h1 className="font-display text-[28px] font-bold leading-tight">Tables</h1>
        <p className="mt-1 text-[15px] text-muted">
          Hi {staffName}. {summary}
        </p>
        {grid}
      </main>
    </>
  );
}
