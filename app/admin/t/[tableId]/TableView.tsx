"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Additional, GuestOrders, Line, TableOrders } from "@/lib/orders";
import { formatPrice, formatTime } from "@/lib/format";
import Link from "next/link";
import { ChevronLeft, MinusIcon, PlusIcon } from "@/app/components/Icons";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { btn, card, PageHead } from "../../kit";
import Shell from "../../Shell";
import { api, OfflineNote, StaffHeader, useConfirm, usePoll } from "../../ui";

type DishOption = { id: string; name: string; priceCents: number };
type View = "guests" | "summary";
const VIEW_KEY = "tapndine:tableView";

/**
 * One table's orders: a card per guest phone with its batches and subtotal,
 * then the waiter's Additionals, then the table total. Or, toggled from the
 * header, the same orders summed up per dish like a receipt. Refreshes itself.
 * Waiters get it on their phone layout; managers inside the dashboard frame,
 * with the total, Clear table and Additionals in a column beside the guests.
 */
export default function TableView({
  tableId,
  initial,
  dishes,
  manager,
}: {
  tableId: string;
  initial: TableOrders;
  dishes: DishOption[];
  /** The manager's name: renders in the dashboard frame. Null for waiters. */
  manager: string | null;
}) {
  const router = useRouter();
  const {
    data: table,
    refresh,
    offline,
  } = usePoll(`/api/staff/tables/${tableId}`, initial, (d) => (d as { table: TableOrders }).table);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirm();

  // The waiter's last choice sticks across tables. Read after mount, so the
  // server render and the first browser render agree.
  const [view, setView] = useState<View>("guests");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "summary") setView("summary");
    } catch {}
  }, []);
  const toggleView = () => {
    const next: View = view === "guests" ? "summary" : "guests";
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  };

  /** Runs a change, then shows the result straight away instead of waiting for the next poll. */
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setQty = async (line: Line, qty: number) => {
    if (
      qty === 0 &&
      !(await confirm({
        title: `Remove ${line.name}?`,
        body: "It comes off this table's order and the guest's bill.",
        confirmLabel: "Remove",
        danger: true,
      }))
    )
      return;
    act(line.id, () => api(`/api/staff/items/${line.id}`, { method: "POST", body: { qty } }));
  };

  const empty = table.guests.length === 0 && table.additionals.length === 0;

  const clear = async () => {
    if (
      !(await confirm({
        title: `Clear ${table.label}?`,
        body: "Do this once the bill is paid. The orders leave this screen and the guests' menu links stop working.",
        confirmLabel: "Clear table",
        danger: true,
      }))
    )
      return;
    act("clear", async () => {
      await api(`/api/staff/tables/${tableId}/clear`, {
        method: "POST",
        body: {},
      });
      router.push("/admin");
    });
  };

  // Shared by both layouts.
  const errorNote = error && (
    <p role="alert" className="rounded-xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
      {error}
    </p>
  );
  const emptyNote = empty && (
    <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[15px] text-muted">
      No orders at this table yet. They show up here as soon as a guest taps Send to waiter.
    </p>
  );
  const additionals = (
    <section className="rounded-2xl border border-line bg-white" aria-labelledby="additionals">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2 id="additionals" className="font-display text-xl font-bold">
          Additionals
        </h2>
        {table.additionals.length > 0 && (
          <span className="font-display text-lg font-bold">{formatPrice(table.additionalsSubtotal)}</span>
        )}
      </div>
      <p className="px-4 text-[13px] text-muted">Added by staff</p>
      {table.additionals.length > 0 && (
        <ul className="mt-2 divide-y divide-line px-4">
          {table.additionals.map((l) => (
            <LineRow key={l.id} line={l} busy={busy === l.id} onQty={setQty} meta={additionalMeta(l)} />
          ))}
        </ul>
      )}
      <AddDish
        dishes={dishes}
        busy={busy === "add"}
        onAdd={(d) =>
          act("add", () =>
            api(`/api/staff/tables/${tableId}/items`, {
              method: "POST",
              body: { dishId: d.id, qty: 1 },
            }),
          )
        }
      />
    </section>
  );

  if (manager !== null) {
    const guests = table.guests.length;
    return (
      <Shell name={manager}>
        <OfflineNote offline={offline} />
        <Link
          href="/admin"
          className="inline-flex h-9 items-center gap-1 rounded-full pr-3 text-[14px] font-semibold text-muted hover:text-ink"
        >
          <ChevronLeft width={18} height={18} />
          Tables
        </Link>
        <PageHead title={table.label} sub={empty ? "No orders yet" : `${guests} ${guests === 1 ? "guest" : "guests"}, live`}>
          <div role="group" aria-label="Show orders" className="flex rounded-full bg-white p-1 shadow-[0_1px_2px_rgb(16_52_42/0.06)]">
            {(["guests", "summary"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => view !== v && toggleView()}
                className={`flex h-9 items-center rounded-full px-4 text-[14px] font-semibold ${
                  view === v ? "bg-forest text-white" : "text-muted hover:text-ink"
                }`}
              >
                {v === "guests" ? "By guest" : "Summary"}
              </button>
            ))}
          </div>
        </PageHead>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Desktop: this is the right-hand column. Phones: it dissolves (contents)
              so the total comes first, then the guests, then Additionals. */}
          <div className="contents lg:sticky lg:top-6 lg:order-2 lg:block lg:space-y-4">
            <section className={`${card} order-1`}>
              <p className="text-[15px] font-semibold">Table total</p>
              <p className="mt-2 font-display text-[40px] font-bold leading-none tracking-tight">{formatPrice(table.totalCents)}</p>
              <button
                type="button"
                disabled={empty || busy === "clear"}
                onClick={clear}
                className={`${btn.secondary} mt-5 w-full disabled:border-line disabled:text-muted`}
              >
                Clear table (paid)
              </button>
            </section>
            {view === "guests" && <div className="order-3">{additionals}</div>}
          </div>
          <div className="order-2 min-w-0 space-y-4 lg:order-1">
            {errorNote}
            {emptyNote}
            {view === "summary" && !empty && <Summary table={table} />}
            {view === "guests" && guests > 0 && (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {table.guests.map((g) => (
                  <GuestCard key={g.number} guest={g} busy={busy} onQty={setQty} />
                ))}
              </div>
            )}
          </div>
        </div>
        {dialog}
      </Shell>
    );
  }

  return (
    <>
      <WarmBackdrop />
      <StaffHeader
        title={table.label}
        back={{ href: "/admin", label: "Tables" }}
        right={
          <button
            type="button"
            onClick={toggleView}
            aria-label={view === "guests" ? "Show summary by dish" : "Show orders by guest"}
            className="flex h-11 items-center rounded-lg px-2.5 text-[15px] font-medium ring-1 ring-inset ring-white/30 active:bg-white/10"
          >
            {view === "guests" ? "Summary" : "By guest"}
          </button>
        }
      />
      <OfflineNote offline={offline} />

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-36 pt-4">
        {errorNote}

        {emptyNote}

        {view === "summary" && !empty && <Summary table={table} />}

        {view === "guests" &&
          table.guests.map((g) => <GuestCard key={g.number} guest={g} busy={busy} onQty={setQty} />)}

        {view === "guests" && additionals}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">Table total</p>
            <p className="font-display text-[26px] font-bold leading-tight">{formatPrice(table.totalCents)}</p>
          </div>
          <button
            type="button"
            disabled={empty || busy === "clear"}
            onClick={clear}
            className="h-12 shrink-0 rounded-xl border border-ink px-4 text-[15px] font-semibold active:bg-wash disabled:border-line disabled:text-muted"
          >
            Clear table (paid)
          </button>
        </div>
      </footer>
      {dialog}
    </>
  );
}

/**
 * Every line at the table, guests and Additionals together, summed per dish
 * like a receipt: Item, Orders, Total. Read-only; changes happen in By guest.
 */
function Summary({ table }: { table: TableOrders }) {
  const rows = new Map<string, { name: string; priceCents: number; qty: number }>();
  const all = [...table.guests.flatMap((g) => g.batches.flatMap((b) => b.lines)), ...table.additionals];
  for (const l of all) {
    // Same dish at the same price is one row; a price change mid-meal shows as two.
    const key = `${l.name}|${l.priceCents}`;
    const row = rows.get(key);
    if (row) row.qty += l.qty;
    else rows.set(key, { name: l.name, priceCents: l.priceCents, qty: l.qty });
  }
  const items = all.reduce((n, l) => n + l.qty, 0);

  return (
    <section className="rounded-2xl border border-line bg-white px-4 pb-4 pt-4" aria-labelledby="summary">
      <h2 id="summary" className="font-display text-xl font-bold">
        Summary
      </h2>
      <p className="text-[13px] text-muted">All guests and Additionals, per dish</p>
      <table className="mt-3 w-full text-[15px] tabular-nums">
        <thead>
          <tr className="border-b border-dashed border-ink/30 text-left text-[12px] font-semibold uppercase tracking-wide text-muted">
            <th className="py-2 font-semibold">Item</th>
            <th className="w-16 py-2 text-center font-semibold">Orders</th>
            <th className="w-20 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {[...rows.values()].map((r) => (
            <tr key={`${r.name}|${r.priceCents}`} className="border-b border-line last:border-0">
              <td className="py-2.5 pr-2 align-top">
                <span className="block leading-snug">{r.name}</span>
                <span className="block text-[13px] text-muted">{formatPrice(r.priceCents)} each</span>
              </td>
              <td className="py-2.5 text-center align-top font-semibold">{r.qty}</td>
              <td className="py-2.5 text-right align-top">{formatPrice(r.priceCents * r.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-dashed border-ink/30 font-semibold">
            <td className="pt-3">Total</td>
            <td className="pt-3 text-center">{items}</td>
            <td className="pt-3 text-right">{formatPrice(table.totalCents)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

const additionalMeta = (l: Additional) => `${l.addedBy ?? "Staff"} · ${formatTime(l.addedAt)}`;

function GuestCard({
  guest,
  busy,
  onQty,
}: {
  guest: GuestOrders;
  busy: string | null;
  onQty: (line: Line, qty: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white pb-2" aria-labelledby={`guest-${guest.number}`}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2 id={`guest-${guest.number}`} className="min-w-0 break-words font-display text-xl font-bold">
          {guest.nickname ?? `Guest ${guest.number}`}
        </h2>
        <span className="shrink-0 font-display text-lg font-bold">{formatPrice(guest.subtotal)}</span>
      </div>
      <p className="px-4 text-[13px] text-muted">
        {guest.nickname ? `Guest ${guest.number} · subtotal for this phone` : "Subtotal for this phone"}
      </p>
      {guest.batches.map((b, i) => (
        <div key={b.id} className="mt-3">
          <h3 className="flex items-center justify-between bg-wash px-4 py-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">
            <span>Batch {i + 1}</span>
            <span className="font-medium normal-case tracking-normal">{formatTime(b.sentAt)}</span>
          </h3>
          <ul className="divide-y divide-line px-4">
            {b.lines.map((l) => (
              <LineRow key={l.id} line={l} busy={busy === l.id} onQty={onQty} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Name and line price on the left, "− 2 +" on the right: the same stepper as the customer's My order. */
function LineRow({
  line,
  busy,
  onQty,
  meta,
}: {
  line: Line;
  busy: boolean;
  onQty: (line: Line, qty: number) => void;
  meta?: string;
}) {
  const step = "grid h-10 w-10 place-items-center rounded-full active:bg-wash disabled:opacity-40";
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{line.name}</p>
        <p className="text-sm text-muted">
          {formatPrice(line.priceCents * line.qty)}
          {meta && ` · ${meta}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center rounded-full border border-line">
        <button
          type="button"
          disabled={busy}
          onClick={() => onQty(line, line.qty - 1)}
          aria-label={`One less ${line.name}`}
          className={step}
        >
          <MinusIcon width={18} height={18} />
        </button>
        <span className="w-5 text-center font-semibold tabular-nums">{line.qty}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onQty(line, line.qty + 1)}
          aria-label={`One more ${line.name}`}
          className={step}
        >
          <PlusIcon width={18} height={18} />
        </button>
      </div>
    </li>
  );
}

/** Type part of a dish name, tap it to add one. No photos: the waiter knows the food. */
function AddDish({ dishes, busy, onAdd }: { dishes: DishOption[]; busy: boolean; onAdd: (d: DishOption) => void }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? dishes.filter((d) => words.every((w) => d.name.toLowerCase().includes(w))).slice(0, 6)
    : [];

  return (
    <div className="px-4 pb-4 pt-3">
      <label className="block">
        <span className="sr-only">Add a dish</span>
        <span className="relative block">
          <PlusIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a dish, e.g. rice"
            autoComplete="off"
            enterKeyHint="done"
            className="h-12 w-full rounded-xl border border-line bg-paper pl-10 pr-3 text-[16px] outline-none focus:border-leaf focus:bg-white focus:ring-2 focus:ring-leaf/20"
          />
        </span>
      </label>
      {words.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-line">
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-[15px] text-muted">No dish matches “{q.trim()}”.</li>
          ) : (
            matches.map((d) => (
              <li key={d.id} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onAdd(d);
                    setQ("");
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left text-[16px] active:bg-leaf-tint disabled:opacity-50"
                >
                  <span>{d.name}</span>
                  <span className="shrink-0 text-[15px] text-muted">{formatPrice(d.priceCents)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
