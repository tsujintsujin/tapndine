import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/app/components/Icons";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { tableHistory, type PastSitting } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../../../kit";
import Shell from "../../../Shell";
import { StaffHeader } from "../../../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Table history · tapndine", robots: { index: false, follow: false } };

/**
 * A table's past sittings, newest first: when, how long, the total, and every
 * order that came in, in order. Read-only; the open sitting is on the table page.
 */
export default async function TableHistoryPage({ params }: { params: Promise<{ tableId: string }> }) {
  const staff = await requireStaff();
  const { tableId } = await params;
  const history = await tableHistory(staff.business_id, tableId);
  if (!history) notFound();

  const list = (
    <div className="space-y-3">
      {history.sittings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[15px] text-muted">
          No past orders at this table yet. A sitting shows up here once its table is cleared.
        </p>
      ) : (
        history.sittings.map((s, i) => <Sitting key={s.id} sitting={s} open={i === 0} />)
      )}
    </div>
  );
  const sub = "Cleared sittings, newest first";

  if (staff.role === "manager") {
    return (
      <Shell name={staff.name}>
        <Link
          href={`/staff/t/${tableId}`}
          className="inline-flex h-9 items-center gap-1 rounded-full pr-3 text-[14px] font-semibold text-muted hover:text-ink"
        >
          <ChevronLeft width={18} height={18} />
          {history.label}
        </Link>
        <PageHead title={`${history.label} history`} sub={sub} />
        <div className="mt-6 max-w-3xl">{list}</div>
      </Shell>
    );
  }

  return (
    <>
      <WarmBackdrop />
      <StaffHeader title="History" back={{ href: `/staff/t/${tableId}`, label: history.label }} />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <p className="mb-3 text-[13px] text-muted">{sub}</p>
        {list}
      </main>
    </>
  );
}

function Sitting({ sitting: s, open }: { sitting: PastSitting; open: boolean }) {
  const mins = Math.round((s.closedAt - s.openedAt) / 60000);
  const stay = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
  return (
    <details open={open} className="group rounded-2xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-snug">
            {formatDate(s.openedAt)} · {formatTime(s.openedAt)} – {formatTime(s.closedAt)}
          </p>
          <p className="text-[13px] text-muted">
            {stay} · {s.guests} {s.guests === 1 ? "guest" : "guests"} · {s.items} {s.items === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-lg font-bold">{formatPrice(s.totalCents)}</span>
          <ChevronLeft width={18} height={18} className="-rotate-90 text-muted transition-transform group-open:rotate-90" />
        </div>
      </summary>
      <ol className="border-t border-line pb-2">
        {s.log.map((e) => (
          <li key={e.id}>
            <h3 className="flex items-center justify-between gap-3 bg-wash px-4 py-1.5 text-[13px] font-semibold text-muted">
              <span className="min-w-0 truncate">{e.by}</span>
              <span className="shrink-0 font-medium">{formatTime(e.sentAt)}</span>
            </h3>
            <ul className="divide-y divide-line px-4">
              {e.lines.map((l) => (
                <li key={l.id} className="flex items-baseline gap-3 py-2.5 text-[15px] tabular-nums">
                  <span className="w-7 shrink-0 font-semibold">{l.qty}×</span>
                  <span className="min-w-0 flex-1 leading-snug">{l.name}</span>
                  <span className="shrink-0">{formatPrice(l.priceCents * l.qty)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
}
