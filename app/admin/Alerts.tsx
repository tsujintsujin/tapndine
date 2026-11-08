"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { BellIcon } from "@/app/components/Icons";
import { type Seen, seenNow, somethingNew, tablesNeedingYou } from "@/lib/alerts";
import type { TableSummary } from "@/lib/orders";
import { usePoll, useStaffInfo } from "./ui";

type Alerts = { tables: TableSummary[] | null; offline: boolean; needYou: number };
const AlertsContext = createContext<Alerts>({ tables: null, offline: false, needYou: 0 });
/** The restaurant's tables, kept fresh on every staff page. */
export const useAlerts = () => useContext(AlertsContext);

/** Two soft notes, made here so there is no sound file to load. */
function chime(ctx: AudioContext) {
  const start = ctx.currentTime;
  [
    [880, 0],
    [1175, 0.16],
  ].forEach(([hz, at]) => {
    const tone = ctx.createOscillator();
    const volume = ctx.createGain();
    tone.frequency.value = hz;
    volume.gain.setValueAtTime(0.0001, start + at);
    volume.gain.exponentialRampToValueAtTime(0.4, start + at + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.6);
    tone.connect(volume).connect(ctx.destination);
    tone.start(start + at);
    tone.stop(start + at + 0.6);
  });
}

/** `quiet`: the guide, where the orders are the sample restaurant's: no chime, no sound button. */
function Live({ children, quiet }: { children: React.ReactNode; quiet: boolean }) {
  const path = usePathname();
  // Also in a hidden tab, or the chime would only sound on a screen already showing the order.
  const { data: tables, offline, refresh } = usePoll("/api/staff/tables", null, (d) => (d as { tables: TableSummary[] }).tables, 5000, true);
  const needYou = tables ? tablesNeedingYou(tables) : 0;
  const seen = useRef<Seen | null>(null);
  const audio = useRef<AudioContext | null>(null);
  // Browsers keep a page silent until someone has pressed something on it.
  const [soundOn, setSoundOn] = useState(false);

  // Opening a table marks it seen, so ask again on every page change.
  useEffect(() => {
    refresh();
  }, [path, refresh]);

  useEffect(() => {
    const unlock = (e: Event) => {
      audio.current ??= new AudioContext();
      audio.current.resume().catch(() => {});
      // On press, not click: this same press takes the button away. It chimes so they know it worked.
      if ((e.target as Element).closest("[data-sound-on]")) chime(audio.current);
      setSoundOn(true);
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      audio.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!tables) return;
    // The first look sets the baseline: reloading a page doesn't chime for what was already there.
    if (!quiet && seen.current && somethingNew(seen.current, tables) && audio.current) {
      const ctx = audio.current;
      ctx.resume().then(() => chime(ctx), () => {});
    }
    seen.current = seenNow(tables);
    // Every poll, because moving to another page puts its own title back.
    document.title = (needYou ? `(${needYou}) ` : "") + document.title.replace(/^\(\d+\) /, "");
  }, [tables, needYou, quiet]);

  return (
    <AlertsContext.Provider value={{ tables, offline, needYou }}>
      {children}
      {!soundOn && !quiet && (
        <button
          type="button"
          data-sound-on
          className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-50 flex h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-forest pl-4 pr-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(16_52_42/0.3)]"
        >
          <BellIcon width={18} height={18} className="text-mango" />
          Tap to turn on order sounds
        </button>
      )}
    </AlertsContext.Provider>
  );
}

/** Nothing to watch until a restaurant is open (a developer's own pages). */
export default function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { restaurant, guide } = useStaffInfo();
  return restaurant ? (
    <Live key={restaurant.id} quiet={guide}>
      {children}
    </Live>
  ) : (
    children
  );
}
