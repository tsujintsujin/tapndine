"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StaffListing } from "@/lib/staff";
import { btn, card, PageHead } from "../kit";
import Shell from "../Shell";
import { api, useConfirm } from "../ui";

/** Who can log in, add a waiter, disable a waiter. Inside the manager's dashboard frame. */
export default function ManageStaff({ me, name, staff }: { me: string; name: string; staff: StaffListing[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const field =
    "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
  const th = "py-3 text-left text-[13px] font-medium text-muted";
  const waiters = staff.filter((s) => s.role === "waiter").length;

  return (
    <Shell name={name}>
      <PageHead title="Staff" sub={`${staff.length} ${staff.length === 1 ? "login" : "logins"}, ${waiters} ${waiters === 1 ? "waiter" : "waiters"}`} />

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={card}>
          <h2 className="font-display text-[19px] font-bold">Who can log in</h2>
          <table className="mt-2 w-full text-[15px]">
            <thead className="hidden sm:table-header-group">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Username</th>
                <th className={th}>Role</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-3 pr-3">
                    <span className="block font-semibold">
                      {s.name}
                      {s.id === me && <span className="font-normal text-muted"> (you)</span>}
                    </span>
                    {/* On phones the other columns fold under the name. */}
                    <span className="block text-[13px] text-muted sm:hidden">
                      {s.username}, {s.role === "manager" ? "Manager" : "Waiter"}
                    </span>
                  </td>
                  <td className="hidden py-3 pr-3 text-muted sm:table-cell">{s.username}</td>
                  <td className="hidden py-3 pr-3 sm:table-cell">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        s.role === "manager" ? "bg-mango-soft text-ink" : "bg-leaf-tint text-leaf"
                      }`}
                    >
                      {s.role === "manager" ? "Manager" : "Waiter"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
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
                        className={`${btn.danger} h-10`}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <form
          className={card}
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
          <h2 className="font-display text-[19px] font-bold">Add a waiter</h2>
          <label className="mt-4 block text-[14px] font-semibold">
            Name
            <input name="name" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Username
            <input name="username" required autoComplete="off" autoCapitalize="none" spellCheck={false} className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Password
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
            <span className="mt-1 block text-[13px] font-normal text-muted">At least 8 characters. Give it to the waiter.</span>
          </label>
          <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full`}>
            Add waiter
          </button>
        </form>
      </div>
      {dialog}
    </Shell>
  );
}
