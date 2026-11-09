"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon } from "@/app/components/Icons";
import { BONUS_DAYS, PLANS, POPULAR, yearlyOff, yearlyPerMonth, type Term } from "@/lib/plans";

/** The homepage's Pricing cards: the same layout as app/components/PlanCards.tsx, in the homepage's colours. "Choose plan" goes to sign-up. */
const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
const bestOff = Math.max(...PLANS.map(yearlyOff));

function PlanList({ includes, without, dark }: { includes: string[]; without: string[]; dark?: boolean }) {
  return (
    <ul className={`mt-6 flex-1 space-y-2.5 border-t pt-6 text-sm font-medium ${dark ? "border-white/15" : "border-home-cocoa/10"}`}>
      {includes.map((f) => (
        <li key={f} className="flex items-start gap-2.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-home-sage text-white">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          {f}
        </li>
      ))}
      {without.map((f) => (
        <li key={f} className={`flex items-start gap-2.5 ${dark ? "text-home-shell/60" : "text-home-cocoa/55"}`}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-home-cream text-home-cocoa/60" aria-hidden>
            &ndash;
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}

export default function HomePlans() {
  const [term, setTerm] = useState<Term>("year");
  const yearly = term === "year";
  const option = (t: Term, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={term === t}
      onClick={() => setTerm(t)}
      className={`h-11 rounded-full px-6 text-sm font-bold transition-colors ${term === t ? "bg-home-cocoa text-home-shell" : "hover:bg-home-cream"}`}
    >
      {label}
    </button>
  );
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <div role="radiogroup" aria-label="Pay" className="inline-flex rounded-full bg-white p-1 shadow-[0_10px_30px_-18px_rgb(59_46_37/0.5)]">
          {option("month", "Monthly")}
          {option("year", "Yearly")}
        </div>
        <span className="rounded-full bg-home-butter px-3 py-1 text-sm font-bold">Save up to {bestOff}% yearly</span>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          // The plan most restaurants pick: drawn dark to stand out (Justin, 2026-11-07).
          const hi = p.name === POPULAR;
          const muted = hi ? "text-home-shell/70" : "text-home-cocoa/70";
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl p-6 shadow-[0_20px_50px_-24px_rgb(59_46_37/0.4)] ${hi ? "bg-home-cocoa text-home-shell" : "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {yearly && <span className="shrink-0 rounded-full bg-home-orange px-2.5 py-0.5 text-xs font-bold">{yearlyOff(p)}% off</span>}
              </div>
              <p className={`mt-1 text-sm font-semibold ${hi ? "text-home-butter" : "text-home-orange"}`}>{p.blurb}</p>
              <p className={`mt-5 h-5 text-sm font-medium ${muted}`}>{yearly && <s>{peso(p.monthly)}</s>}</p>
              <p>
                <span className="text-4xl font-extrabold tracking-tight">{peso(yearly ? yearlyPerMonth(p) : p.monthly)}</span>
                <span className="text-sm font-semibold opacity-60"> /mo</span>
              </p>
              <Link
                href="/start"
                className={`mt-6 inline-block rounded-full px-6 py-3 text-center font-semibold transition hover:brightness-95 ${hi ? "bg-home-butter text-home-cocoa" : "bg-home-orange"}`}
              >
                Choose plan
              </Link>
              <p className={`mt-3 text-sm font-medium leading-snug ${muted}`}>
                {yearly ? `You pay ${peso(p.price)} for 12 months.` : `You pay ${peso(p.monthly)} for 1 month.`}
              </p>
              <PlanList includes={yearly ? [`${BONUS_DAYS} extra days free for setup`, ...p.includes] : p.includes} without={("without" in p && p.without) || []} dark={hi} />
            </div>
          );
        })}
      </div>
    </>
  );
}
