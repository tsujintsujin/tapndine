"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StaffListing } from "@/lib/staff";
import { api, StaffNav, useConfirm } from "../ui";

/** The bare minimum: who can log in, add a waiter, disable a waiter. */
export default function ManageStaff({ me, staff }: { me: string; staff: StaffListing[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const field =
    "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3 text-[16px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

  return (
    <>
      <StaffNav isManager />
      <main className="mx-auto max-w-xl px-4 pb-12 pt-4">
        <h1 className="font-display text-[28px] font-bold leading-tight">Staff</h1>
        <h2 className="mt-5 font-display text-xl font-bold">Who can log in</h2>
        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {staff.map((s) => (
            <li key={s.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium leading-snug">
                  {s.name}
                  {s.id === me && <span className="font-normal text-muted"> (you)</span>}
                </p>
                <p className="text-[13px] text-muted">
                  {s.username} · {s.role === "manager" ? "Manager" : "Waiter"}
                </p>
              </div>
              {s.role === "waiter" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Disable ${s.name}?`,
                      body: "They are logged out, can no longer log in, and leave this list. Nothing is deleted: their past orders keep their name.",
                      confirmLabel: "Disable",
                      danger: true,
                    });
                    if (!ok) return;
                    setBusy(true);
                    setError("");
                    try {
                      await api(`/api/staff/waiters/${s.id}/disable`, { method: "POST", body: {} });
                      router.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                    setBusy(false);
                  }}
                  className="h-11 shrink-0 rounded-lg px-3 text-[15px] font-semibold text-chili active:bg-chili/10"
                >
                  Disable
                </button>
              )}
            </li>
          ))}
        </ul>

        <h2 className="mt-8 font-display text-xl font-bold">Add a waiter</h2>
        <form
          className="mt-2 rounded-2xl border border-line bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            setBusy(true);
            setError("");
            try {
              await api("/api/staff/waiters", {
                method: "POST",
                body: { name: f.get("name"), username: f.get("username"), password: f.get("password") },
              });
              form.reset();
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            }
            setBusy(false);
          }}
        >
          <label className="block text-[15px] font-medium">
            Name
            <input name="name" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[15px] font-medium">
            Username
            <input name="username" required autoComplete="off" autoCapitalize="none" spellCheck={false} className={field} />
          </label>
          <label className="mt-4 block text-[15px] font-medium">
            Password
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
            <span className="mt-1 block text-[13px] font-normal text-muted">At least 8 characters. Give it to the waiter.</span>
          </label>
          <p role="alert" className="mt-3 min-h-5 text-[15px] text-chili">
            {error}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 h-12 w-full rounded-xl bg-leaf text-[16px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60"
          >
            Add waiter
          </button>
        </form>
      </main>
      {dialog}
    </>
  );
}
