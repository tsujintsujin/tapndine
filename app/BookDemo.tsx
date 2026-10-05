"use client";

import { useMemo, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";

// "Book a demo": the date calendar and grouped time list from the Aqua booking
// page (Freelance/Pitch/Aqua/app/book/page.tsx), recoloured to the homepage
// palette. Booking saves the request (app/api/demo) and emails Justin.

// Demo hours: Monday to Friday, 9 AM to 5 PM, every 30 minutes.
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 17 * 60;
const SLOT_MIN = 30;
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 14:30 -> "2:30 PM" */
const label12 = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const prettyDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long" });

/** Open start times on a day; on today, only the ones still ahead. */
function slotsFor(iso: string) {
  const now = new Date();
  const nowMin = iso === isoDate(now) ? now.getHours() * 60 + now.getMinutes() : -1;
  const out: number[] = [];
  for (let m = OPEN_MIN; m < CLOSE_MIN; m += SLOT_MIN) if (m > nowMin) out.push(m);
  return out;
}

export function BookDemoButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={className}>
        {children}
      </button>
      <dialog
        ref={dialog}
        // A click on the backdrop lands on the <dialog> itself; one inside lands on its content.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="w-[calc(100%-2rem)] max-w-3xl rounded-3xl bg-white p-0 text-home-cocoa shadow-2xl backdrop:bg-home-cocoa/50"
      >
        <Scheduler onClose={() => dialog.current?.close()} />
      </dialog>
    </>
  );
}

function Scheduler({ onClose }: { onClose: () => void }) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array(first.getDay()).fill(null),
      ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ] as (Date | null)[];
  }, [month]);

  const slots = date ? slotsFor(date) : [];
  const atThisMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date || time === null || sending) return;
    const f = new FormData(e.currentTarget);
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${BASE_PATH}/api/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, min: time, name: f.get("name"), email: f.get("email"), message: f.get("message") }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent && date && time !== null) {
    return (
      <div className="p-7 text-center sm:p-10">
        <h2 className="text-2xl font-extrabold tracking-tight">Demo booked</h2>
        <p className="mt-3 text-sm font-medium text-home-cocoa/70">
          <span className="font-bold text-home-cocoa">{prettyDate(date)}</span>, {label12(time)}. We&apos;ll email you
          to confirm.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full bg-home-orange px-6 py-3 font-semibold transition hover:brightness-95"
        >
          Done
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-home-cream bg-home-shell px-4 py-3 text-sm text-home-cocoa placeholder:text-home-cocoa/40 focus:border-home-orange focus:outline-none";

  return (
    <form onSubmit={submit} className="max-h-[90dvh] overflow-y-auto p-5 pb-0 sm:p-7 sm:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Book a demo</h2>
          <p className="mt-1.5 text-sm font-medium text-home-cocoa/60">
            Pick a day and a time. We&apos;ll walk you through tapndine on a real table.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none text-home-cocoa/50 transition hover:bg-home-cream hover:text-home-cocoa"
        >
          &times;
        </button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={atThisMonth}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-lg px-3 py-1 text-home-cocoa/35 hover:bg-home-cream/60 hover:text-home-cocoa disabled:invisible"
              aria-label="Previous month"
            >
              &lsaquo;
            </button>
            <span className="text-sm font-semibold">
              {month.toLocaleString("en-PH", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-lg px-3 py-1 text-home-cocoa/35 hover:bg-home-cream/60 hover:text-home-cocoa"
              aria-label="Next month"
            >
              &rsaquo;
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-home-cocoa/40">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = isoDate(d);
              const past = d < startOfToday;
              const blocked = !past && (isWeekend(d) || !slotsFor(key).length);
              const off = past || blocked;
              const on = key === date;
              const today0 = d.getTime() === startOfToday.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    setDate(key);
                    setTime(null);
                  }}
                  aria-current={today0 ? "date" : undefined}
                  title={blocked ? "No demos this day" : undefined}
                  className={`relative aspect-square rounded-xl transition ${
                    on
                      ? "bg-home-cocoa font-semibold text-home-shell"
                      : off
                        ? "cursor-not-allowed text-home-cocoa/20"
                        : today0
                          ? "bg-home-cream font-semibold hover:bg-home-cream/70"
                          : "hover:bg-home-cream/60"
                  }`}
                >
                  {d.getDate()}
                  {blocked && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2.5 top-1/2 h-px -translate-y-1/2 bg-home-cocoa/20"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-home-cocoa/45">Demos run Monday to Friday, 9 AM to 5 PM.</p>
        </div>

        {/* Times */}
        <div className="h-[340px] overflow-y-auto rounded-2xl border border-home-cream bg-home-shell p-3 md:h-[310px]">
          {!date ? (
            <p className="px-1 py-10 text-center text-sm text-home-cocoa/45">Pick a date to see open times.</p>
          ) : (
            [
              { label: "Morning", from: 0, to: 12 * 60 },
              { label: "Afternoon", from: 12 * 60, to: 17 * 60 },
            ].map((g) => {
              const inGroup = slots.filter((m) => m >= g.from && m < g.to);
              if (!inGroup.length) return null;
              return (
                <div key={g.label} className="mb-4 last:mb-0">
                  <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-home-cocoa/40">
                    {g.label}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {inGroup.map((m) => {
                      const on = m === time;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTime(m)}
                          aria-pressed={on}
                          className={`rounded-xl px-4 py-3 text-sm tabular-nums transition ${
                            on
                              ? "bg-home-cocoa font-semibold text-home-shell"
                              : "bg-home-cream/60 text-home-cocoa/80 hover:bg-home-cream"
                          }`}
                        >
                          {label12(m)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Who's asking */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-home-cocoa/70">Your name</span>
          <input name="name" required maxLength={100} autoComplete="name" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-home-cocoa/70">Email</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-home-cocoa/70">
            Message <span className="font-medium text-home-cocoa/40">(optional)</span>
          </span>
          <textarea name="message" rows={3} maxLength={2000} className={`${field} resize-none`} />
        </label>
      </div>

      {/* Pinned to the bottom so the button stays in reach while the modal scrolls on a phone. */}
      <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col gap-3 border-t border-home-cream bg-white px-5 py-4 sm:-mx-7 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <p className="text-sm font-medium text-home-cocoa/70">
          {error ? (
            <span className="font-semibold text-red-700">{error}</span>
          ) : date && time !== null ? (
            <>
              <span className="font-bold text-home-cocoa">{prettyDate(date)}</span>, {label12(time)}
            </>
          ) : (
            "No time picked yet"
          )}
        </p>
        <button
          type="submit"
          disabled={!date || time === null || sending}
          className="rounded-full bg-home-orange px-6 py-3 text-center font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-home-cream disabled:text-home-cocoa/35 disabled:hover:brightness-100"
        >
          {sending ? "Booking..." : "Book demo"}
        </button>
      </div>
    </form>
  );
}
