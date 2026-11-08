"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StaffListing } from "@/lib/staff";
import { btn, card, PageHead } from "../kit";
import Shell from "../Shell";
import { api, useConfirm } from "../ui";

/** Who can log in, add a waiter or manager, remove one. Inside the manager's dashboard frame. */
export default function ManageStaff({
  me,
  name,
  slug,
  staff,
}: {
  me: string;
  name: string;
  /** The restaurant's code: every login here starts with it. */
  slug: string;
  staff: StaffListing[];
}) {
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
        <section data-guide="logins" className={card}>
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
                    {s.id !== me && (s.role === "waiter" || s.role === "manager") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Remove ${s.name}?`,
                            body: "They are logged out, can no longer log in, and leave this list. Their past orders keep their name.",
                            confirmLabel: "Remove",
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
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <form
          data-guide="add-login"
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
                body: { name: f.get("name"), username: f.get("username"), password: f.get("password"), role: f.get("role") },
              });
              form.reset();
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            }
            setBusy(false);
          }}
        >
          <h2 className="font-display text-[19px] font-bold">Add a login</h2>
          <fieldset className="mt-4">
            <legend className="text-[14px] font-semibold">Role</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["waiter", "manager"] as const).map((r) => (
                <label
                  key={r}
                  className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-white text-[15px] font-semibold has-[:checked]:border-leaf has-[:checked]:bg-leaf-tint has-[:checked]:text-leaf"
                >
                  <input type="radio" name="role" value={r} defaultChecked={r === "waiter"} className="sr-only" />
                  {r === "waiter" ? "Waiter" : "Manager"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-[14px] font-semibold">
            Name
            <input name="name" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Username
            {/* The code is fixed: they log in as <code>-<what is typed>. */}
            <span className="mt-1.5 flex h-12 items-center rounded-xl border border-line bg-white focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/20">
              {/* A fixed cap: a long code would otherwise widen the page on a phone. */}
              <span title={slug} className="max-w-[10rem] shrink-0 truncate pl-3.5 text-[15px] font-normal text-muted">
                {slug}
              </span>
              <span className="shrink-0 text-[15px] font-normal text-muted">-</span>
              <input
                name="username"
                required
                pattern="[a-z0-9._]{2,30}"
                title="2 to 30 lower-case letters, numbers, dots or underscores, no dashes"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-full w-0 min-w-0 flex-1 rounded-r-xl bg-transparent pr-3.5 text-[15px] font-normal outline-none"
                // The box around it shows focus; the page-wide focus outline would draw a second box inside.
                style={{ outline: "none" }}
              />
            </span>
            <span className="mt-1 block text-[13px] font-normal text-muted">Lower case, no dashes, like maria.</span>
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Password
            <input name="password" type="password" required minLength={6} autoComplete="new-password" className={field} />
            <span className="mt-1 block text-[13px] font-normal text-muted">At least 6 characters. Give it to them.</span>
          </label>
          <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full`}>
            Add login
          </button>
        </form>
      </div>
      {dialog}
    </Shell>
  );
}
