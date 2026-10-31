"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MenuDesign } from "@/lib/menu";
import { CheckIcon } from "@/app/components/Icons";
import { card } from "../kit";
import { api } from "../ui";

const DESIGNS: { id: MenuDesign; name: string; about: string; Mini: () => React.JSX.Element }[] = [
  { id: "a", name: "Design A", about: "Warm cream. Today's pick big at the top, dishes in a photo grid.", Mini: MiniA },
  { id: "b", name: "Design B", about: "Ube and calamansi. One long list by category, photos on the side.", Mini: MiniB },
];

/**
 * Which look the guests' menu has. Picking one saves straight away; guests
 * see it the next time they open the menu.
 */
export default function DesignCard({ design }: { design: MenuDesign }) {
  const router = useRouter();
  const [current, setCurrent] = useState(design);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (d: MenuDesign) => {
    if (d === current || busy) return;
    const before = current;
    setCurrent(d);
    setError("");
    setBusy(true);
    try {
      await api("/api/staff/design", { method: "POST", body: { design: d } });
      router.refresh();
    } catch (e) {
      setCurrent(before);
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className={`${card} mt-4`} aria-labelledby="design-title">
      <h2 id="design-title" className="font-display text-lg font-bold leading-tight">
        Menu design
      </h2>
      <p className="text-[14px] text-muted">How your menu looks on guests&apos; phones. Switch any time.</p>
      <div role="radiogroup" aria-labelledby="design-title" className="mt-4 grid gap-3 sm:grid-cols-2">
        {DESIGNS.map(({ id, name, about, Mini }) => {
          const on = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => pick(id)}
              className={`flex items-center gap-4 rounded-2xl p-3 text-left ring-inset transition-colors ${
                on ? "bg-leaf-tint ring-2 ring-forest" : "ring-1 ring-line hover:bg-wash"
              }`}
            >
              <Mini />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-[17px] font-bold">
                  {name}
                  {on && (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-forest text-white" aria-hidden>
                      <CheckIcon width={14} height={14} />
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug text-muted">{about}</span>
                <span className="mt-1.5 block text-[13px] font-semibold text-forest">{on ? "Guests see this one" : "Use this design"}</span>
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

/** A tiny drawing of Design A: big photo, three tiles, pill bar. */
function MiniA() {
  return (
    <span aria-hidden className="relative flex h-[128px] w-[72px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-[#FFF9E7] ring-1 ring-black/10">
      <span className="relative h-[62px] rounded-b-[10px] bg-[linear-gradient(160deg,#9A6A3E,#3B2E25)]">
        <span className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full bg-[#F19A33]" />
        <span className="absolute bottom-2 left-1.5 h-1.5 w-8 rounded-full bg-white/80" />
      </span>
      <span className="mt-2 flex gap-1 px-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-5 flex-1 rounded-[4px] bg-[#FAD68A]" />
        ))}
      </span>
      <span className="mt-1.5 flex gap-1 px-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-5 flex-1 rounded-[4px] bg-[#F4EACE]" />
        ))}
      </span>
      <span className="absolute inset-x-1.5 bottom-1.5 h-3 rounded-full bg-[#3B2E25]" />
    </span>
  );
}

/** A tiny drawing of Design B: ube band with picks, then rows with a photo on the right. */
function MiniB() {
  return (
    <span aria-hidden className="relative flex h-[128px] w-[72px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-[#F8F7FB] ring-1 ring-black/10">
      <span className="h-[30px] bg-[#3D2358] px-1.5 pt-1.5">
        <span className="block h-1.5 w-7 rounded-full bg-white/80" />
      </span>
      <span className="-mt-3 flex gap-1 px-1.5">
        <span className="h-8 w-7 rounded-[5px] bg-white ring-1 ring-black/5" />
        <span className="h-8 w-7 rounded-[5px] bg-white ring-1 ring-black/5" />
      </span>
      <span className="mx-1.5 mt-1.5 block h-[2px] w-4 rounded-full bg-[#3D2358]" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="mx-1.5 mt-1.5 flex items-center gap-1">
          <span className="flex-1">
            <span className="block h-1 w-7 rounded-full bg-[#1E1530]/60" />
            <span className="mt-0.5 block h-1 w-5 rounded-full bg-[#1E1530]/25" />
          </span>
          <span className="h-4 w-4 rounded-[4px] bg-[#C9B6DD]" />
        </span>
      ))}
      <span className="absolute inset-x-1.5 bottom-1.5 flex h-3 items-center justify-end rounded-full bg-[#3D2358] pr-0.5">
        <span className="h-2 w-2 rounded-full bg-[#D4E157]" />
      </span>
    </span>
  );
}
