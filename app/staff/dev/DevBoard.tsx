"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import type { Standing } from "@/lib/billing";
import type { Restaurant } from "@/lib/dev";
import { formatPrice } from "@/lib/format";
import { btn, card } from "../kit";
import { api, useConfirm } from "../ui";
import { StandingBadge } from "./billing/parts";

const peso = (cents: number) => formatPrice(Math.round(cents / 100) * 100);
const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

/** The restaurant list with its actions, and the Add a restaurant form. */
export default function DevBoard({
  list,
  openId,
  rangeLabel,
  standings,
}: {
  list: Restaurant[];
  openId: string | null;
  rangeLabel: string;
  /** Each restaurant's billing standing, by id. */
  standings: Record<string, Standing>;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  /** Runs one action; a failure shows above the list. */
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await f();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={card}>
          <h2 className="font-display text-[19px] font-bold">All restaurants</h2>
          <ul className="mt-2">
            {list.map((r) => (
              <li key={r.id} className="border-t border-line py-4 first:border-t-0">
                {renaming === r.id ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const name = new FormData(e.currentTarget).get("name");
                      if (await run(() => api(`/api/dev/restaurants/${r.id}`, { method: "PATCH", body: { name } }))) {
                        setRenaming(null);
                        router.refresh();
                      }
                    }}
                  >
                    <label className="min-w-0 flex-1 text-[14px] font-semibold">
                      Restaurant name
                      <input name="name" required maxLength={60} defaultValue={r.name} autoFocus className={field} />
                    </label>
                    <button type="submit" disabled={busy} className={btn.primary}>
                      Save
                    </button>
                    <button type="button" onClick={() => setRenaming(null)} className={btn.secondary}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[18px] font-bold leading-tight">{r.name}</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                            r.off ? "bg-chili/10 text-chili" : "bg-leaf-tint text-leaf"
                          }`}
                        >
                          {r.off ? "Switched off" : "Live"}
                        </span>
                        {standings[r.id] && <StandingBadge standing={standings[r.id]} />}
                        {r.id === openId && (
                          <span className="rounded-full bg-mango-soft px-2.5 py-1 text-[12px] font-semibold text-ink">Open now</span>
                        )}
                      </p>
                      <p className="mt-1 text-[13px] text-muted">
                        Code {r.slug} · {r.tables} {r.tables === 1 ? "table" : "tables"} · {r.dishes}{" "}
                        {r.dishes === 1 ? "dish" : "dishes"} · {r.staff} {r.staff === 1 ? "login" : "logins"}
                      </p>
                      <p className="mt-1.5 text-[14px]">
                        <span className="font-semibold">{peso(r.sent)}</span>
                        <span className="text-muted">
                          {" "}
                          sent, {r.groups} {r.groups === 1 ? "group" : "groups"} ({rangeLabel.toLowerCase()})
                          {r.ordering ? `, ${r.ordering} ordering now` : ""}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (await run(() => api("/api/dev/open", { method: "POST", body: { id: r.id } }))) {
                            window.location.href = `${BASE_PATH}/staff/dashboard`;
                          }
                        }}
                        className={`${btn.primary} h-10`}
                      >
                        Open
                      </button>
                      <Link href={`/staff/dev/billing/${r.id}`} className={`${btn.secondary} h-10`}>
                        Billing
                      </Link>
                      <button type="button" disabled={busy} onClick={() => setRenaming(r.id)} className={`${btn.secondary} h-10`}>
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (!r.off) {
                            const ok = await confirm({
                              title: `Switch off ${r.name}?`,
                              body: "Its NFC tags stop opening the menu, menus open right now stop working, and its staff are logged out. Nothing is deleted: switch it back on any time.",
                              confirmLabel: "Switch off",
                              danger: true,
                            });
                            if (!ok) return;
                          }
                          if (await run(() => api(`/api/dev/restaurants/${r.id}`, { method: "PATCH", body: { off: !r.off } }))) {
                            router.refresh();
                          }
                        }}
                        className={r.off ? `${btn.secondary} h-10` : `${btn.danger} h-10`}
                      >
                        {r.off ? "Switch on" : "Switch off"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <form
          className={card}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const body = Object.fromEntries(["name", "slug", "managerName", "username", "password"].map((k) => [k, f.get(k)]));
            if (await run(() => api("/api/dev/restaurants", { method: "POST", body }))) {
              form.reset();
              router.refresh();
            }
          }}
        >
          <h2 className="font-display text-[19px] font-bold">Add a restaurant</h2>
          <label className="mt-4 block text-[14px] font-semibold">
            Restaurant name
            <input name="name" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Code
            <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,30}" autoComplete="off" autoCapitalize="none" spellCheck={false} className={field} />
            <span className="mt-1 block text-[13px] font-normal text-muted">Lower case, like hikay or kusina-dos.</span>
          </label>
          <p className="mt-5 text-[14px] font-semibold">Its first manager</p>
          <label className="mt-3 block text-[14px] font-semibold">
            Name
            <input name="managerName" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Username
            <input name="username" required autoComplete="off" autoCapitalize="none" spellCheck={false} className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Password
            <input name="password" type="password" required minLength={6} autoComplete="new-password" className={field} />
            <span className="mt-1 block text-[13px] font-normal text-muted">At least 6 characters. Give it to the manager.</span>
          </label>
          <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full`}>
            Add restaurant
          </button>
        </form>
      </div>
      {dialog}
    </>
  );
}
