"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PALETTES, type Palette } from "@/lib/palettes";
import { CheckIcon } from "@/app/components/Icons";
import { card } from "../kit";
import { api } from "../ui";

/**
 * The colours of the guests' menu. A restaurant that never picked has the
 * first one, cocoa and orange (the menu's own colours). Picking one saves
 * straight away; guests see it the next time the menu loads.
 */
export default function PaletteCard({ palette }: { palette: string | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState(palette ?? PALETTES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (id: string) => {
    if (id === current || busy) return;
    const before = current;
    setCurrent(id);
    setError("");
    setBusy(true);
    try {
      await api("/api/staff/palette", { method: "POST", body: { palette: id } });
      router.refresh();
    } catch (e) {
      setCurrent(before);
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className={`${card} mt-4`} aria-labelledby="palette-title">
      <h2 id="palette-title" className="font-display text-lg font-bold leading-tight">
        Menu colors
      </h2>
      <p className="text-[14px] text-muted">The colors guests see on their phones. Pick one; it saves right away.</p>
      <div role="radiogroup" aria-labelledby="palette-title" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PALETTES.map((colors) => {
          const { id, name } = colors;
          const on = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => pick(id)}
              className={`rounded-2xl p-2 text-left ring-inset transition-colors ${
                on ? "bg-leaf-tint ring-2 ring-forest" : "ring-1 ring-line hover:bg-wash"
              }`}
            >
              <Swatch c={colors} />
              <span className="mt-2 flex items-center gap-1.5 px-1 pb-0.5 text-[14px] font-semibold leading-tight">
                <span className="min-w-0 flex-1">{name}</span>
                {on && (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest text-white" aria-hidden>
                    <CheckIcon width={14} height={14} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-chili">
          {error}
        </p>
      )}
    </section>
  );
}

/** A tiny menu in the palette: header band, dish tiles, the send bar. */
function Swatch({ c }: { c: Palette }) {
  const rgb = (v: string) => `rgb(${v})`;
  return (
    <span aria-hidden className="relative block h-[76px] overflow-hidden rounded-xl ring-1 ring-black/10" style={{ background: rgb(c.paper) }}>
      <span className="flex h-[22px] items-center gap-1.5 px-2" style={{ background: rgb(c.forest) }}>
        <span className="h-1.5 w-10 rounded-full bg-white/85" />
        <span className="h-1.5 w-5 rounded-full" style={{ background: rgb(c.mango) }} />
      </span>
      <span className="flex gap-1 px-2 pt-2">
        {[c.wash, c.mangoSoft, c.wash].map((v, i) => (
          <span key={i} className="h-4 flex-1 rounded-[4px]" style={{ background: rgb(v) }} />
        ))}
      </span>
      <span className="absolute inset-x-2 bottom-2 flex h-4 items-center justify-end rounded-full pr-0.5" style={{ background: rgb(c.forest) }}>
        <span className="h-3 w-7 rounded-full" style={{ background: rgb(c.mango) }} />
      </span>
    </span>
  );
}
