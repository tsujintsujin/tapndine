"use client";

import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import { BONUS_DAYS, CHARGE_PESOS, chargeCents, PLANS } from "@/lib/plans";

/**
 * Picking a plan and paying for it with QR Ph (lib/checkout.ts). Used at
 * sign-up ("Buy a plan", `owner` set: the restaurant is made once it's paid),
 * on /trial-over and on the Plan page (a restaurant on its trial buying).
 *
 * The QR shows right here. The screen asks the server every few seconds, and
 * straight away when the phone comes back from the banking app, until
 * PayMongo says paid; then it goes on to `next` from the server.
 */
type Pay = { id: string; qr: string; expiresAt: number; plan: string };

const POLL_MS = 3000;
const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const button =
  "flex h-[52px] w-full items-center justify-center rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60";
const quiet = "rounded font-semibold text-leaf underline-offset-4 hover:underline";

export default function BuyPlan({
  owner,
  onBack,
  heading = "Pick your plan",
  onPlanChange,
}: {
  /** Told the plan's name each time another plan is picked (the Plan page shows its details beside). */
  onPlanChange?: (name: string) => void;
  /** A new owner at sign-up: what they typed, sent with the plan. */
  owner?: { restaurant: string; name: string };
  /** Shown as "Back" while picking (sign-up: back to the trial-or-buy step). */
  onBack?: () => void;
  heading?: string;
}) {
  const [plan, setPlan] = useState(PLANS[1].name);
  const [pay, setPay] = useState<Pay | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const top = useRef<HTMLDivElement>(null);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${BASE_PATH}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, ...owner }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; qr?: string; expiresAt?: number; error?: string };
      if (!res.ok || !j.id || !j.qr) {
        setError(j.error ?? "Couldn't make a payment code. Try again.");
      } else {
        setNow(Date.now());
        setPay({ id: j.id, qr: j.qr, expiresAt: j.expiresAt ?? Date.now() + 30 * 60 * 1000, plan });
      }
    } catch {
      setError("No connection. Check the internet and try again.");
    }
    setBusy(false);
  };

  // Ask until paid: on a timer while the code is up, and at once when the
  // phone comes back to this screen. The server grants the plan only once.
  useEffect(() => {
    if (!pay || paid) return;
    let stopped = false;
    const ask = async () => {
      try {
        const res = await fetch(`${BASE_PATH}/api/billing/checkout/${pay.id}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { status?: string; next?: string };
        if (!stopped && j.status === "paid") {
          setPaid(true);
          window.location.href = `${BASE_PATH}${j.next ?? "/admin/dashboard"}`;
        }
      } catch {
        // Offline for a moment: the next tick asks again.
      }
    };
    const poll = setInterval(() => document.visibilityState === "visible" && ask(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pay, paid]);

  // Each step starts at its top, so a phone doesn't open the QR scrolled halfway.
  useEffect(() => {
    top.current?.scrollIntoView({ block: "nearest" });
  }, [pay, paid]);

  const chosen = PLANS.find((p) => p.name === (pay?.plan ?? plan)) ?? PLANS[1];
  const charge = chargeCents(chosen) / 100;
  const expired = !!pay && !paid && now >= pay.expiresAt;

  if (pay && paid) {
    return (
      <div ref={top} role="status" className="text-center">
        <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">Payment received</h2>
        <p className="mt-2 text-[16px] text-muted">
          {owner ? `Setting up ${owner.restaurant}…` : `Your ${chosen.name} plan is on. Opening your dashboard…`}
        </p>
      </div>
    );
  }

  if (pay && expired) {
    return (
      <div ref={top} className="text-center">
        <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">This code expired</h2>
        <p className="mt-2 text-[16px] text-muted">Nothing was charged. Make a new code to pay.</p>
        <button type="button" onClick={start} disabled={busy} className={`${button} mt-6`}>
          {busy ? "Making your code…" : "Make a new code"}
        </button>
        <button type="button" onClick={() => setPay(null)} className={`${quiet} mt-5 text-[15px]`}>
          Pick another plan
        </button>
      </div>
    );
  }

  if (pay) {
    return (
      <div ref={top} className="text-center">
        <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">Scan to pay {peso(charge)}</h2>
        <p className="mt-1 text-[15px] leading-snug text-muted">
          {chosen.name} plan, a year plus {BONUS_DAYS} free days. Open GCash, Maya or your bank app and scan this QR Ph code.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pay.qr}
          alt={`QR Ph code to pay ${peso(charge)} for the ${chosen.name} plan`}
          width={232}
          height={232}
          className="mx-auto mt-5 h-[232px] w-[232px] rounded-2xl bg-white p-2 ring-1 ring-line"
        />
        <p role="status" className="mt-4 flex items-center justify-center gap-2 text-[15px] font-medium text-ink">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-leaf motion-reduce:animate-none" aria-hidden="true" />
          Waiting for your payment · code expires in {mmss(pay.expiresAt - now)}
        </p>
        <a
          href={pay.qr}
          download="tapndine-qr.png"
          className="mt-5 inline-flex h-11 items-center rounded-full border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:bg-paper"
        >
          Save QR image
        </a>
        <p className="mx-auto mt-3 max-w-xs text-[14px] leading-snug text-muted">
          On this phone? Save the image, then upload it from your wallet app&apos;s scan screen.
        </p>
        <button type="button" onClick={() => setPay(null)} className={`${quiet} mt-5 text-[15px]`}>
          Pick another plan
        </button>
      </div>
    );
  }

  return (
    <div ref={top}>
      <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">{heading}</h2>
      <p className="mt-1 text-[15px] leading-snug text-muted">
        Each plan runs a full year, plus {BONUS_DAYS} days free. Pay once with QR Ph: GCash, Maya or any bank app.
      </p>
      <fieldset className="mt-6">
        <legend className="sr-only">Plan</legend>
        <div className="grid gap-3">
          {PLANS.map((p) => {
            const on = plan === p.name;
            return (
              <label
                key={p.name}
                className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border bg-white px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf/40 ${
                  on ? "border-leaf bg-leaf-tint/40 ring-1 ring-leaf" : "border-line hover:border-leaf/50"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p.name}
                  checked={on}
                  onChange={() => {
                    setPlan(p.name);
                    onPlanChange?.(p.name);
                  }}
                  className="h-5 w-5 shrink-0 accent-[rgb(var(--leaf))]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold text-ink">{p.name}</span>
                  <span className="block text-[14px] text-muted">{p.tables ? `${p.tables} tables, ordering and staff logins` : "Menu only, no ordering"}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-[19px] font-bold text-ink">{peso(chargeCents(p) / 100)}</span>
                  {CHARGE_PESOS !== null && <s className="block text-[13px] text-muted">{peso(p.price)}/yr</s>}
                  {CHARGE_PESOS === null && <span className="block text-[13px] text-muted">a year</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div role="alert" aria-live="assertive">
        {error && (
          <p className="mt-4 rounded-xl border border-chili/25 bg-chili/10 px-3.5 py-3 text-[15px] font-medium text-chili">{error}</p>
        )}
      </div>
      <button type="button" onClick={start} disabled={busy} className={`${button} mt-6`}>
        {busy ? "Making your code…" : `Pay ${peso(charge)} with QR Ph`}
      </button>
      {onBack && (
        <p className="mt-5 text-center text-[15px]">
          <button type="button" onClick={onBack} className={quiet}>
            Back
          </button>
        </p>
      )}
    </div>
  );
}
