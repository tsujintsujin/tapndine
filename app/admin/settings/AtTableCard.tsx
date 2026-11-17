"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RADII } from "@/lib/atTable";
import { btn, card } from "../kit";
import { Switch } from "../menu/MenuBoard";
import { api } from "../ui";

export type AtTableSettings = {
  send: boolean;
  call: boolean;
  bill: boolean;
  opensAt: string | null;
  closesAt: string | null;
  radius: number;
  /** When the location was set and how sure the phone was, or null when not set. */
  pin: { setAt: number; accuracy: number } | null;
};

/**
 * What guests can do from a table's menu, and when and where orders are taken
 * (lib/atTable.ts). Every change saves at once. Designed on the canvas
 * "tappetite at the table settings", approved 2026-11-17.
 */
export default function AtTableCard({ initial }: { initial: AtTableSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const save = async (patch: Record<string, unknown>, next: Partial<AtTableSettings>, what: string) => {
    const before = s;
    setS({ ...s, ...next });
    setBusy(what);
    setError("");
    try {
      await api("/api/staff/at-table", { method: "POST", body: patch });
      router.refresh();
    } catch (e) {
      setS(before);
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const setHours = (opensAt: string, closesAt: string) => {
    if (!opensAt || !closesAt) return setS({ ...s, opensAt: opensAt || null, closesAt: closesAt || null });
    save({ hours: { opensAt, closesAt } }, { opensAt, closesAt }, "hours");
  };

  const useHere = () => {
    if (!navigator.geolocation) return setError("This browser can't share its location.");
    setBusy("pin");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        save({ here }, { pin: { setAt: Date.now(), accuracy: Math.round(here.acc) } }, "pin");
      },
      (e) => {
        setBusy("");
        setError(e.code === e.PERMISSION_DENIED ? "Location is blocked for this site. Allow it in the browser, then try again." : "Couldn't get this phone's location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const row = "flex items-center justify-between gap-4 py-3";
  const time =
    "h-11 rounded-xl border border-line bg-white px-3 text-[15px] text-ink outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

  return (
    <section className={`${card} mt-4`} aria-labelledby="at-table-title">
      <h2 id="at-table-title" className="font-display text-lg font-bold leading-tight">
        At the table
      </h2>
      <p className="text-[14px] text-muted">What guests can do from their table&apos;s menu.</p>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-chili">
          {error}
        </p>
      )}

      <ul className="mt-2 divide-y divide-line">
        <li className={row}>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Send orders</span>
            <span className="block text-[13px] text-muted">
              {s.send ? "Guests send their order. It shows on your Tables screen." : "Off: guests build a list and show it to staff."}
            </span>
          </span>
          <Switch on={s.send} label="Send orders" onChange={() => save({ send: !s.send }, { send: !s.send }, "send")} />
        </li>
        <li className={row}>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Call staff button</span>
            <span className="block text-[13px] text-muted">Guests tap it instead of waving. The call shows on your Tables screen.</span>
          </span>
          <Switch on={s.call} label="Call staff button" onChange={() => save({ call: !s.call }, { call: !s.call }, "call")} />
        </li>
        <li className={row}>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Bill, please button</span>
            <span className="block text-[13px] text-muted">Guests ask for the bill from the menu. Turn off if guests pay at the counter.</span>
          </span>
          <Switch on={s.bill} label="Bill, please button" onChange={() => save({ bill: !s.bill }, { bill: !s.bill }, "bill")} />
        </li>
      </ul>

      {s.send && (
        <div className="mt-3 space-y-5 rounded-2xl bg-wash p-4">
          <div>
            <h3 className="text-[15px] font-bold">Only take orders from the restaurant</h3>
            <p className="text-[13px] text-muted">Stops orders from someone who took a photo of a table&apos;s QR and scans it at home.</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-[240px]">
              <span className="block text-[14px] font-semibold">Opening hours</span>
              <span className="block text-[13px] text-muted">
                {s.opensAt && s.closesAt ? "Every day. Outside these, guests can look but not send." : "Not set: orders any time."}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-[13px] text-muted">
              Opens
              <input type="time" value={s.opensAt ?? ""} onChange={(e) => setHours(e.target.value, s.closesAt ?? "")} className={time} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-muted">
              Closes
              <input type="time" value={s.closesAt ?? ""} onChange={(e) => setHours(s.opensAt ?? "", e.target.value)} className={time} />
            </label>
            {s.opensAt && s.closesAt && (
              <button type="button" disabled={!!busy} onClick={() => save({ hours: null }, { opensAt: null, closesAt: null }, "hours")} className={`${btn.danger} h-11`}>
                Any time
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-[240px]">
              <span className="block text-[14px] font-semibold">Restaurant location</span>
              {s.pin ? (
                <span className="block text-[13px] text-muted">
                  Set on {new Date(s.pin.setAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} from inside the
                  restaurant (accurate to {s.pin.accuracy} m).
                </span>
              ) : (
                <span className="block text-[13px] text-[#9A3412]">Not set. Stand inside the restaurant and tap the button.</span>
              )}
            </div>
            <button type="button" disabled={!!busy} onClick={useHere} className={btn.secondary}>
              <PinIcon />
              {busy === "pin" ? "Finding you…" : "Use where I am now"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-[240px]">
              <span className="block text-[14px] font-semibold">How close guests must be</span>
              <span className="block text-[13px] text-muted">Bigger if you&apos;re in a mall or phones read poorly inside.</span>
            </div>
            <div role="radiogroup" aria-label="How close guests must be" className="flex gap-0.5 rounded-full border border-line bg-white p-[3px]">
              {RADII.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={s.radius === m}
                  disabled={!!busy}
                  onClick={() => s.radius !== m && save({ radius: m }, { radius: m }, "radius")}
                  className={`h-[38px] min-w-16 rounded-full px-3.5 text-[14px] font-semibold ${s.radius === m ? "bg-forest text-white" : "text-ink hover:bg-wash"}`}
                >
                  {m} m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const PinIcon = () => (
  <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
