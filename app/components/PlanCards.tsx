"use client";

import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import { CheckIcon } from "@/app/components/Icons";
import {
  BONUS_DAYS,
  chargeCents,
  EXTRA_TABLE,
  PLANS,
  POPULAR,
  yearlyOff,
  yearlyPerMonth,
  type Plan,
  type Term,
} from "@/lib/plans";

/**
 * The plans as cards, one per plan, Hostinger style (Justin, 2026-11-08): a
 * Monthly/Yearly switch above them; on Yearly each card shows its discount,
 * the monthly price struck through and the year's price per month big, then
 * what is paid today. "Choose plan" opens the QR Ph code in a pop-up
 * (lib/checkout.ts); once PayMongo says paid, the page goes on to `next`.
 *
 * Used on Subscription (/admin/plan), on the trial-over page, and at sign-up
 * (/start/plans, where the restaurant is made once it's paid). The homepage
 * draws its own copy in its own colours (app/HomePlans.tsx).
 */
const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
const bestOff = Math.max(...PLANS.map(yearlyOff));

export default function PlanCards({ startTerm = "year" }: { startTerm?: Term }) {
  const [term, setTerm] = useState<Term>(startTerm);
  const [paying, setPaying] = useState<{ plan: Plan; term: Term } | null>(null);

  return (
    <div data-guide="plan">
      <TermSwitch term={term} onChange={setTerm} />
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <PlanCard key={p.name} plan={p} term={term} onChoose={() => setPaying({ plan: p, term })} />
        ))}
      </div>
      <p className="mt-5 rounded-2xl bg-white px-5 py-4 text-[15px] text-muted ring-1 ring-black/5">
        Need more tables on Standard or Grand? Add any number for{" "}
        <span className="font-semibold text-ink">{peso(EXTRA_TABLE / 12)}</span> a table a month. Message tappetite to add them.
      </p>
      {paying && <PayDialog plan={paying.plan} term={paying.term} onClose={() => setPaying(null)} />}
    </div>
  );
}

/** Monthly or Yearly, as two buttons that act as one choice. */
function TermSwitch({ term, onChange }: { term: Term; onChange: (t: Term) => void }) {
  const option = (t: Term, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={term === t}
      onClick={() => onChange(t)}
      className={`h-11 rounded-full px-5 text-[15px] font-semibold transition-colors ${
        term === t ? "bg-forest text-white" : "text-ink hover:bg-paper"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Pay" className="inline-flex rounded-full bg-white p-1 ring-1 ring-black/10">
        {option("month", "Monthly")}
        {option("year", "Yearly")}
      </div>
      <span className="rounded-full bg-mango-soft px-3 py-1 text-[14px] font-semibold text-forest">
        Save up to {bestOff}% yearly
      </span>
    </div>
  );
}

function PlanCard({ plan: p, term, onChoose }: { plan: Plan; term: Term; onChoose: () => void }) {
  const popular = p.name === POPULAR;
  const yearly = term === "year";
  const today = chargeCents(p, term) / 100;
  const without = ("without" in p && p.without) || [];
  return (
    <section
      aria-labelledby={`plan-${p.name}`}
      className={`relative flex flex-col rounded-[22px] bg-white p-6 shadow-[0_20px_50px_-28px_rgb(59_46_37/0.45)] ${
        popular ? "ring-2 ring-forest" : "ring-1 ring-black/5"
      }`}
    >
      {popular && (
        <p className="absolute -top-3 left-6 rounded-full bg-forest px-3 py-1 text-[13px] font-semibold text-white">Most picked</p>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 id={`plan-${p.name}`} className="font-display text-[22px] font-bold leading-tight">
          {p.name}
        </h3>
        {yearly && (
          <span className="shrink-0 rounded-full bg-mango px-2.5 py-0.5 text-[13px] font-bold text-forest">{yearlyOff(p)}% off</span>
        )}
      </div>
      <p className="mt-1 text-[15px] text-muted">{p.blurb}</p>

      <p className="mt-5 h-5 text-[15px] text-muted">{yearly && <s>{peso(p.monthly)}</s>}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className="font-display text-[40px] font-bold leading-none tracking-tight">
          {peso(yearly ? yearlyPerMonth(p) : p.monthly)}
        </span>
        <span className="text-[16px] font-medium text-muted">/mo</span>
      </p>

      <button
        type="button"
        onClick={onChoose}
        className={`mt-6 h-[52px] w-full rounded-xl text-[17px] font-semibold ${
          popular ? "bg-forest text-white hover:bg-forest-soft" : "border-2 border-forest text-forest hover:bg-leaf-tint"
        }`}
      >
        Choose plan
      </button>
      <p className="mt-3 text-[14px] leading-snug text-muted">
        {yearly
          ? `Today you pay ${peso(today)} for 12 months. Buy again next year to keep it.`
          : `Today you pay ${peso(today)} for 1 month. Buy again each month to keep it.`}
      </p>

      <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-[15px] font-medium">
        {(yearly ? [`${BONUS_DAYS} extra days free for setup`, ...p.includes] : p.includes).map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-leaf text-white">
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
            {f}
          </li>
        ))}
        {without.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-muted">
            <span aria-hidden="true" className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-wash">
              &ndash;
            </span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Pay = { id: string; qr: string; expiresAt: number };
const POLL_MS = 3000;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The QR Ph code for one plan and term, in a pop-up. Makes the code on open,
 * then asks the server every few seconds (and at once when the phone comes
 * back from the banking app) until PayMongo says paid.
 */
function PayDialog({ plan, term, onClose }: { plan: Plan; term: Term; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pay, setPay] = useState<Pay | null>(null);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const amount = chargeCents(plan, term) / 100;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // A fresh code each time the pop-up opens, or "Make a new code" is pressed.
  useEffect(() => {
    let gone = false;
    setPay(null);
    setError("");
    (async () => {
      try {
        const res = await fetch(`${BASE_PATH}/api/billing/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: plan.name, term }),
        });
        const j = (await res.json().catch(() => ({}))) as Partial<Pay> & { error?: string };
        if (gone) return;
        if (!res.ok || !j.id || !j.qr) setError(j.error ?? "Couldn't make a payment code. Try again.");
        else setPay({ id: j.id, qr: j.qr, expiresAt: j.expiresAt ?? Date.now() + 30 * 60 * 1000 });
      } catch {
        if (!gone) setError("No connection. Check the internet and try again.");
      }
    })();
    return () => {
      gone = true;
    };
  }, [plan, term, attempt]);

  useEffect(() => {
    if (!pay || paid) return;
    let stopped = false;
    const ask = async () => {
      try {
        const res = await fetch(`${BASE_PATH}/api/billing/checkout/${pay.id}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { status?: string; next?: string };
        if (!stopped && j.status === "paid") {
          setPaid(true);
          window.location.href = `${BASE_PATH}${j.next ?? "/admin/plan"}`;
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

  const expired = !!pay && !paid && now >= pay.expiresAt;
  const what = `${plan.name} plan, ${term === "year" ? `12 months plus ${BONUS_DAYS} days free` : "1 month"}`;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="pay-title"
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-[24px] bg-white p-0 text-ink shadow-[0_24px_60px_-20px_rgb(59_46_37/0.45)] backdrop:bg-forest/50"
    >
      <div className="relative p-6 text-center sm:p-7">
        {!paid && (
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-[22px] text-muted hover:bg-paper"
          >
            &times;
          </button>
        )}
        {paid ? (
          <div role="status">
            <h2 id="pay-title" className="font-display text-[26px] font-bold leading-tight">Payment received</h2>
            <p className="mt-2 text-[16px] text-muted">Your {plan.name} plan is on. Opening it now…</p>
          </div>
        ) : error ? (
          <>
            <h2 id="pay-title" className="font-display text-[26px] font-bold leading-tight">Couldn&apos;t make the code</h2>
            <p role="alert" className="mt-2 text-[16px] text-chili">{error}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-6 h-12 w-full rounded-xl bg-forest text-[16px] font-semibold text-white">
              Try again
            </button>
          </>
        ) : !pay ? (
          <div role="status" className="py-10">
            <h2 id="pay-title" className="font-display text-[22px] font-bold">Making your code…</h2>
            <p className="mt-1 text-[15px] text-muted">{what}</p>
          </div>
        ) : expired ? (
          <>
            <h2 id="pay-title" className="font-display text-[26px] font-bold leading-tight">This code expired</h2>
            <p className="mt-2 text-[16px] text-muted">Nothing was charged. Make a new code to pay.</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-6 h-12 w-full rounded-xl bg-forest text-[16px] font-semibold text-white">
              Make a new code
            </button>
          </>
        ) : (
          <>
            <h2 id="pay-title" className="font-display text-[26px] font-bold leading-tight">Scan to pay {peso(amount)}</h2>
            <p className="mt-1 text-[15px] leading-snug text-muted">
              {what}. Open GCash, Maya or your bank app and scan this QR Ph code.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pay.qr}
              alt={`QR Ph code to pay ${peso(amount)} for the ${plan.name} plan`}
              width={232}
              height={232}
              className="mx-auto mt-5 h-[232px] w-[232px] rounded-2xl bg-white p-2 ring-1 ring-line"
            />
            <p role="status" className="mt-4 flex items-center justify-center gap-2 text-[15px] font-medium">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-leaf motion-reduce:animate-none" aria-hidden="true" />
              Waiting for your payment · expires in {mmss(pay.expiresAt - now)}
            </p>
            <a
              href={pay.qr}
              download="tappetite-qr.png"
              className="mt-5 inline-flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-semibold hover:bg-paper"
            >
              Save QR image
            </a>
            <p className="mx-auto mt-3 max-w-xs text-[14px] leading-snug text-muted">
              On this phone? Save the image, then upload it from your wallet app&apos;s scan screen.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
