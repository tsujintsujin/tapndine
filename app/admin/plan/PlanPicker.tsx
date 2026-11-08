"use client";

import { useState } from "react";
import BuyPlan from "@/app/components/BuyPlan";
import { CheckIcon } from "@/app/components/Icons";
import { BONUS_DAYS, CHARGE_PESOS, chargeCents, EXTRA_TABLE, PLANS } from "@/lib/plans";

const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
const box = "rounded-[22px] bg-white p-5 shadow-[0_20px_50px_-28px_rgb(59_46_37/0.45)] ring-1 ring-black/5 sm:p-7";

/** The plan picker, with the picked plan's details beside it (below it on a phone). */
export default function PlanPicker() {
  const [name, setName] = useState(PLANS[1].name);
  const p = PLANS.find((x) => x.name === name) ?? PLANS[1];
  const without = ("without" in p && p.without) || [];
  return (
    <div data-guide="plan" className="mt-6 grid max-w-7xl items-start gap-5 lg:grid-cols-2">
      <div className={box}>
        <BuyPlan onPlanChange={setName} />
      </div>
      <section aria-live="polite" aria-label={`${p.name} plan details`} className={box}>
        <p className="text-[14px] font-medium text-muted">Plan details</p>
        <h2 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight">{p.name}</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[24px] font-bold">{peso(chargeCents(p) / 100)}</span>
          {CHARGE_PESOS !== null ? (
            <s className="text-[15px] text-muted">{peso(p.price)} a year</s>
          ) : (
            <span className="text-[15px] text-muted">a year</span>
          )}
        </p>
        <p className="mt-1 text-[15px] text-muted">
          Runs a full year, plus {BONUS_DAYS} days free. Everything from your free trial stays.
        </p>
        <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-[15px] font-medium">
          {p.includes.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-leaf text-white">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              {f}
            </li>
          ))}
          {without.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-muted">
              <span aria-hidden className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-wash">
                &ndash;
              </span>
              {f}
            </li>
          ))}
        </ul>
        {p.tables > 0 && (
          <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-[14px] text-muted">
            Need more than {p.tables} tables? Add any number for {peso(EXTRA_TABLE / 12)} a table a month.
          </p>
        )}
      </section>
    </div>
  );
}
