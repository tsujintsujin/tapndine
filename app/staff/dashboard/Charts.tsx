"use client";

import { useState } from "react";
import { hourLabel } from "@/lib/format";

// The two charts on Statistics. Phones have no hover, so tapping a bar or a
// cell puts its value in the line above the chart.

export type Bar = { key: string | number; label: string; value: number; display: string };

/** Clean top for the axis: 1, 2 or 5 times a power of ten, at or above max. */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 5, 10].find((m) => m * p >= max) ?? 10) * p;
}

/** Pesos for the axis, whole: "₱20,000". */
const pesoAxis = (cents: number) => "₱" + Math.round(cents / 100).toLocaleString("en-PH");

/**
 * Columns from one baseline, one series. Every `tickEvery`-th column, counted
 * back from the last, gets a label underneath. Plain values only: this is
 * rendered from a server page, which cannot hand functions to the browser.
 */
export function Bars({
  bars,
  money,
  tickEvery,
  initial,
}: {
  bars: Bar[];
  /** Values are centavos; the axis shows pesos. */
  money?: boolean;
  tickEvery: number;
  initial?: number;
}) {
  const [sel, setSel] = useState(initial ?? bars.length - 1);
  const top = niceMax(Math.max(...bars.map((b) => b.value)));
  const b = bars[sel];

  return (
    <div>
      <p className="h-6 text-[15px]" aria-live="polite">
        <span className="text-muted">{b.label} · </span>
        <span className="font-semibold">{b.display}</span>
      </p>
      <div className="relative mt-3">
        <span className="absolute -top-5 right-0 text-[12px] tabular-nums text-muted">top {money ? pesoAxis(top) : top}</span>
        {/* Each column is a striped pill track; the filled pill inside is the value. */}
        <div className={`flex h-44 items-end ${bars.length > 14 ? "gap-[3px]" : "gap-2.5"}`}>
          {bars.map((bar, i) => (
            <button
              key={bar.key}
              type="button"
              aria-label={`${bar.label}: ${bar.display}`}
              aria-pressed={i === sel}
              onClick={() => setSel(i)}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
            >
              <span className="track relative block h-full w-full max-w-12 overflow-hidden rounded-full">
                <span
                  className={`absolute inset-x-0 bottom-0 block rounded-full ${i === sel ? "bg-forest" : "bg-leaf/75"}`}
                  style={{ height: bar.value ? `max(${(bar.value / top) * 100}%, 10px)` : 0 }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className={`mt-2 flex ${bars.length > 14 ? "gap-[3px]" : "gap-2.5"}`} aria-hidden="true">
        {bars.map((bar, i) => (
          <span key={bar.key} className="relative h-4 min-w-0 flex-1">
            {(bars.length - 1 - i) % tickEvery === 0 && (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] text-muted">
                {bar.label.split(",").pop()!.trim()}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export type Cell = { weekday: number; hour: number; avg: number };

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const avgLabel = (v: number) => `${v === 0 ? "No" : v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)} order${v === 1 ? "" : "s"} on average`;

/** Weekday × hour, darker = more orders sent. One hue, five steps. */
export function Heatmap({ cells, hours }: { cells: Cell[]; hours: number[] }) {
  const max = Math.max(...cells.map((c) => c.avg));
  const peak = cells.find((c) => c.avg === max)!;
  const [sel, setSel] = useState({ weekday: peak.weekday, hour: peak.hour });
  const at = (w: number, h: number) => cells.find((c) => c.weekday === w && c.hour === h)?.avg ?? 0;
  const step = (v: number) => (v === 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
  const shades = ["bg-wash", "bg-leaf/20", "bg-leaf/40", "bg-leaf/60", "bg-leaf/80", "bg-leaf"];
  const selAvg = at(sel.weekday, sel.hour);

  return (
    <div>
      <p className="h-6 text-[15px]" aria-live="polite">
        <span className="text-muted">
          {DAY_NAMES[sel.weekday]}, {hourLabel(sel.hour)} ·{" "}
        </span>
        <span className="font-semibold">{avgLabel(selAvg)}</span>
      </p>
      <div
        className="mt-2 grid gap-[2px]"
        style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {WEEK.map((w) => (
          <div key={w} className="contents">
            <span className="self-center text-[12px] text-muted">{DAY_NAMES[w]}</span>
            {hours.map((h) => {
              const v = at(w, h);
              const here = sel.weekday === w && sel.hour === h;
              return (
                <button
                  key={h}
                  type="button"
                  aria-label={`${DAY_NAMES[w]} ${hourLabel(h)}: ${avgLabel(v)}`}
                  aria-pressed={here}
                  onClick={() => setSel({ weekday: w, hour: h })}
                  className={`h-7 rounded-[4px] ${shades[step(v)]} ${here ? "ring-2 ring-mango ring-offset-1" : ""}`}
                />
              );
            })}
          </div>
        ))}
        <span />
        {hours.map((h, i) => (
          <span key={h} className="relative h-4" aria-hidden="true">
            {i % 3 === 0 && (
              // The last labels hang left, so they stay inside the card.
              <span className={`absolute whitespace-nowrap text-[12px] text-muted ${i >= hours.length - 2 ? "right-0" : "left-0"}`}>
                {hourLabel(h)}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted" aria-hidden="true">
        Fewer
        {shades.slice(1).map((s) => (
          <span key={s} className={`h-3 w-4 rounded-[3px] ${s}`} />
        ))}
        More
      </div>
    </div>
  );
}
