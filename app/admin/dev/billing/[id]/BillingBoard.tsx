"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Contract, RestaurantBilling } from "@/lib/billing";
import { formatPrice } from "@/lib/format";
import { METHODS, PLANS } from "@/lib/plans";
import { btn, card } from "@/app/admin/kit";
import { api, useConfirm } from "@/app/admin/ui";
import { day } from "../parts";

const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const label = "mt-4 block text-[14px] font-semibold";

/** "2026-10-08" plus n days. */
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
/** One year on, less a day: a term starting 8 Oct 2026 covers up to 7 Oct 2027. */
const yearEnd = (start: string) => {
  const d = new Date(start + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return addDays(d.toISOString().slice(0, 10), -1);
};
const pesos = (cents: number) => String(cents / 100);

/** The contracts with their payments, and the two forms: record a payment, record a contract. */
export default function BillingBoard({ billing }: { billing: RestaurantBilling }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { contracts, current, today } = billing;

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await f();
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // A payment most likely settles the oldest term still owing; else the running one.
  const owing = [...contracts].reverse().find((c) => c.paidCents < c.priceCents);
  const payFor = owing ?? current ?? contracts[0];

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={card}>
          <h2 className="font-display text-[19px] font-bold">Contracts and payments</h2>
          {contracts.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-paper px-4 py-8 text-center text-[15px] text-muted">
              No contract recorded yet. Add the one they signed with the form.
            </p>
          ) : (
            <ul className="mt-2">
              {contracts.map((c) => (
                <ContractItem
                  key={c.id}
                  c={c}
                  today={today}
                  busy={busy}
                  onDeleteContract={async () => {
                    const ok = await confirm({
                      title: "Delete this contract?",
                      body: "Only for one typed by mistake. It has no payments, so nothing else changes.",
                      confirmLabel: "Delete",
                      danger: true,
                    });
                    if (ok) await run(() => api(`/api/dev/billing/contracts/${c.id}`, { method: "DELETE" }));
                  }}
                  onDeletePayment={async (p) => {
                    const ok = await confirm({
                      title: `Delete the ${formatPrice(p.amountCents)} payment?`,
                      body: `Paid ${day(p.paidOn)} by ${p.method}. Only for one typed by mistake.`,
                      confirmLabel: "Delete",
                      danger: true,
                    });
                    if (ok) await run(() => api(`/api/dev/billing/payments/${p.id}`, { method: "DELETE" }));
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {payFor && (
            <form
              key={payFor.id + payFor.paidCents}
              className={card}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                const body = Object.fromEntries(["paidOn", "amount", "method", "reference", "note"].map((k) => [k, f.get(k)]));
                await run(() => api(`/api/dev/billing/contracts/${f.get("contract")}/payments`, { method: "POST", body }));
              }}
            >
              <h2 className="font-display text-[19px] font-bold">Record a payment</h2>
              <label className={label}>
                For
                <select name="contract" defaultValue={payFor.id} className={field}>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.plan}, {day(c.startsOn)} to {day(c.endsOn)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Paid on
                  <input name="paidOn" type="date" required defaultValue={today} className={field} />
                </label>
                <label className={label}>
                  Amount (₱)
                  <input
                    name="amount"
                    inputMode="decimal"
                    required
                    defaultValue={payFor.priceCents > payFor.paidCents ? pesos(payFor.priceCents - payFor.paidCents) : ""}
                    className={field}
                  />
                </label>
              </div>
              <label className={label}>
                How
                <select name="method" defaultValue="GCash" className={field}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Reference <span className="font-normal text-muted">(optional)</span>
                <input name="reference" maxLength={80} autoComplete="off" placeholder="GCash ref no., OR no." className={field} />
              </label>
              <label className={label}>
                Note <span className="font-normal text-muted">(optional)</span>
                <input name="note" maxLength={300} autoComplete="off" className={field} />
              </label>
              <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full`}>
                Record payment
              </button>
            </form>
          )}

          {/* A fresh form after each new contract, with the next renewal's dates. */}
          <ContractForm key={contracts.length} billing={billing} busy={busy} run={run} />
        </div>
      </div>
      {dialog}
    </>
  );
}

/** Record what they signed: a first contract, or the renewal after the running one. */
function ContractForm({
  billing,
  busy,
  run,
}: {
  billing: RestaurantBilling;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { current, today } = billing;
  // A new contract follows the running one (a renewal), or starts today.
  const startDefault = current ? addDays(current.endsOn, 1) : today;
  const planDefault = PLANS.find((p) => p.name === current?.plan) ?? PLANS[0];
  const [plan, setPlan] = useState(planDefault.name);
  const [tables, setTables] = useState(String(planDefault.tables));
  const [price, setPrice] = useState(String(planDefault.price));
  const [startsOn, setStartsOn] = useState(startDefault);
  const [endsOn, setEndsOn] = useState(yearEnd(startDefault));

  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = Object.fromEntries(["plan", "tables", "price", "signedOn", "startsOn", "endsOn", "note"].map((k) => [k, f.get(k)]));
        await run(() => api(`/api/dev/billing/${billing.id}/contracts`, { method: "POST", body }));
      }}
    >
      <h2 className="font-display text-[19px] font-bold">{current ? "Record a renewal" : "Record a contract"}</h2>
      <p className="mt-0.5 text-[13px] text-muted">What they signed. Price and tables are kept as signed, whatever the plans cost later.</p>
      <label className={label}>
        Plan
        <select
          value={PLANS.some((p) => p.name === plan) ? plan : ""}
          onChange={(e) => {
            const p = PLANS.find((x) => x.name === e.target.value);
            if (p) {
              setPlan(p.name);
              setTables(String(p.tables));
              setPrice(String(p.price));
            } else setPlan("");
          }}
          className={field}
        >
          {PLANS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}: {p.tables} tables, {formatPrice(p.price * 100)}
            </option>
          ))}
          <option value="">Something else</option>
        </select>
      </label>
      {!PLANS.some((p) => p.name === plan) && (
        <label className={label}>
          Plan name
          <input value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={60} required className={field} />
        </label>
      )}
      <input type="hidden" name="plan" value={plan} />
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Tables
          <input name="tables" type="number" min={1} max={500} required value={tables} onChange={(e) => setTables(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Price (₱)
          <input name="price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
        </label>
      </div>
      <label className={label}>
        Signed on
        <input name="signedOn" type="date" required defaultValue={today} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          First day
          <input
            name="startsOn"
            type="date"
            required
            value={startsOn}
            onChange={(e) => {
              setStartsOn(e.target.value);
              if (e.target.value) setEndsOn(yearEnd(e.target.value));
            }}
            className={field}
          />
        </label>
        <label className={label}>
          Last day
          <input name="endsOn" type="date" required value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={field} />
        </label>
      </div>
      <label className={label}>
        Note <span className="font-normal text-muted">(optional)</span>
        <input name="note" maxLength={500} autoComplete="off" className={field} />
      </label>
      <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full`}>
        {current ? "Record renewal" : "Record contract"}
      </button>
    </form>
  );
}

function ContractItem({
  c,
  today,
  busy,
  onDeleteContract,
  onDeletePayment,
}: {
  c: Contract;
  today: string;
  busy: boolean;
  onDeleteContract: () => void;
  onDeletePayment: (p: Contract["payments"][number]) => void;
}) {
  const when = c.endsOn < today ? "Ended" : c.startsOn > today ? "Upcoming" : "Running";
  const left = c.priceCents - c.paidCents;
  return (
    <li className="border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[17px] font-bold leading-tight">{c.plan}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                when === "Running" ? "bg-leaf-tint text-leaf" : when === "Upcoming" ? "bg-mango-soft text-ink" : "bg-wash text-muted"
              }`}
            >
              {when}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {day(c.startsOn)} to {day(c.endsOn)} · {c.tables} tables · signed {day(c.signedOn)}
          </p>
          {c.note && <p className="mt-1 text-[13px]">{c.note}</p>}
        </div>
        {/* Under the plan name on phones, so left-aligned there. */}
        <p className="sm:text-right">
          <span className="block font-display text-[17px] font-bold">{formatPrice(c.priceCents)}</span>
          <span className={`block text-[13px] ${left > 0 ? "font-semibold text-chili" : "text-leaf"}`}>
            {left > 0 ? `${formatPrice(left)} left to pay` : left < 0 ? `${formatPrice(-left)} paid over` : "Paid in full"}
          </span>
        </p>
      </div>

      {c.payments.length > 0 ? (
        <table className="mt-3 w-full text-[14px]">
          <thead className="hidden sm:table-header-group">
            <tr>
              {["Paid on", "Amount", "How", "Reference"].map((h) => (
                <th key={h} className="py-2 text-left text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {c.payments.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="py-2.5 pr-3">
                  <span className="block font-semibold sm:font-normal">{day(p.paidOn)}</span>
                  {/* On phones the other columns fold under the date. */}
                  <span className="block text-[13px] text-muted sm:hidden">
                    {formatPrice(p.amountCents)} · {p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  {p.note && <span className="block text-[13px] text-muted">{p.note}</span>}
                </td>
                <td className="hidden py-2.5 pr-3 font-semibold tabular-nums sm:table-cell">{formatPrice(p.amountCents)}</td>
                <td className="hidden py-2.5 pr-3 sm:table-cell">{p.method}</td>
                <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">{p.reference ?? "–"}</td>
                <td className="py-1 text-right">
                  <button type="button" disabled={busy} onClick={() => onDeletePayment(p)} className={`${btn.danger} h-10`}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-4 py-3">
          <p className="text-[14px] text-muted">No payments recorded.</p>
          <button type="button" disabled={busy} onClick={onDeleteContract} className={`${btn.danger} h-10`}>
            Delete contract
          </button>
        </div>
      )}
    </li>
  );
}
