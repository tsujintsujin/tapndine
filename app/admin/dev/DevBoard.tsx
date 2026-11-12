"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import type { Standing } from "@/lib/billing";
import type { Restaurant } from "@/lib/dev";
import { formatPrice } from "@/lib/format";
import { daysLeft } from "@/lib/trial";
import { btn, card } from "@/app/admin/kit";
import { api, useConfirm } from "@/app/admin/ui";
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
  /** The code typed in Add a restaurant: the owner's login starts with it. */
  const [slug, setSlug] = useState("");
  /** The login of the owner just added, to hand over. */
  const [added, setAdded] = useState("");
  const { confirm, dialog } = useConfirm();
  /** The restaurant whose Delete dialog is up. */
  const [deleting, setDeleting] = useState<Restaurant | null>(null);

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
                        {/* An ended trial is closed to guests, so not "Live"; its own badge says why. */}
                        {(r.off || r.trialEndsAt === null || daysLeft(r.trialEndsAt) > 0) && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                              r.off ? "bg-chili/10 text-chili" : "bg-leaf-tint text-leaf"
                            }`}
                          >
                            {r.off ? "Switched off" : "Live"}
                          </span>
                        )}
                        {r.trialEndsAt !== null && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                              daysLeft(r.trialEndsAt) ? "bg-mango-soft text-ink" : "bg-chili/10 text-chili"
                            }`}
                          >
                            {daysLeft(r.trialEndsAt)
                              ? `Free trial · ${daysLeft(r.trialEndsAt)} ${daysLeft(r.trialEndsAt) === 1 ? "day" : "days"} left`
                              : "Free trial ended"}
                          </span>
                        )}
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
                            window.location.href = `${BASE_PATH}/admin/dashboard`;
                          }
                        }}
                        className={`${btn.primary} h-10`}
                      >
                        Open
                      </button>
                      <Link href={`/admin/dev/billing/${r.id}`} className={`${btn.secondary} h-10`}>
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
                      <button type="button" disabled={busy} onClick={() => setDeleting(r)} className={`${btn.danger} h-10`}>
                        Delete
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
            let login = "";
            const ok = await run(async () => {
              login = (await api<{ username: string }>("/api/dev/restaurants", { method: "POST", body })).username;
            });
            if (ok) {
              form.reset();
              setSlug("");
              setAdded(login);
              router.refresh();
            }
          }}
        >
          <h2 className="font-display text-[19px] font-bold">Add a restaurant</h2>
          {added && (
            <p role="status" className="mt-3 rounded-xl bg-leaf-tint px-3.5 py-2.5 text-[14px] text-leaf">
              Added. Its owner logs in as <span className="font-semibold">{added}</span>.
            </p>
          )}
          <label className="mt-4 block text-[14px] font-semibold">
            Restaurant name
            <input name="name" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Code
            <input
              name="slug"
              required
              pattern="[a-z0-9][a-z0-9\-]{1,30}"
              onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={field}
            />
            <span className="mt-1 block text-[13px] font-normal text-muted">
              Lower case, like hikay or kusina-dos. Every login here starts with it.
            </span>
          </label>
          <p className="mt-5 text-[14px] font-semibold">Its owner</p>
          <label className="mt-3 block text-[14px] font-semibold">
            Name
            <input name="managerName" required maxLength={60} autoComplete="off" className={field} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">
            Username
            {/* The code is fixed: the owner logs in as <code>-<what is typed>. */}
            <span className="mt-1.5 flex h-12 items-center rounded-xl border border-line bg-white focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/20">
              {/* A fixed cap, not a percentage: a long code would otherwise widen the whole page on a phone. */}
              <span title={slug} className="max-w-[10rem] shrink-0 truncate pl-3.5 text-[15px] font-normal text-muted">
                {slug || "code"}
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
            <span className="mt-1 block text-[13px] font-normal text-muted">At least 6 characters. Give it to the owner.</span>
          </label>
          <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full`}>
            Add restaurant
          </button>
        </form>
      </div>
      {dialog}
      <DeleteDialog
        restaurant={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(photos) => {
          setDeleting(null);
          if (!photos) setError("Deleted. Its dish photos could not be removed from Cloudinary; they are still there.");
          router.refresh();
        }}
      />
    </>
  );
}

/** Delete for good: says what goes, and asks for the developer's own password. */
function DeleteDialog({
  restaurant,
  onClose,
  onDeleted,
}: {
  restaurant: Restaurant | null;
  onClose: () => void;
  onDeleted: (photos: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Keep the name up while it closes, after the parent has dropped it.
  const last = useRef(restaurant);
  if (restaurant) last.current = restaurant;
  const r = last.current;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (restaurant && !d.open) {
      setError("");
      d.showModal();
    } else if (!restaurant && d.open) d.close();
  }, [restaurant]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
      className="m-auto w-[min(380px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      {r && (
        <form
          key={restaurant?.id ?? "closed"}
          className="p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const password = new FormData(e.currentTarget).get("password");
            setBusy(true);
            setError("");
            try {
              const res = await api<{ photos: boolean }>(`/api/dev/restaurants/${r.id}`, { method: "DELETE", body: { password } });
              onDeleted(res.photos);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 id="delete-title" className="font-display text-[22px] font-bold leading-tight">
            Delete {r.name} for good?
          </h2>
          <p className="mt-1.5 text-[15px] text-muted">
            Its menu, dish photos, tables, menu links, orders, staff logins and billing are erased. This cannot be undone. To keep it
            without it running, switch it off instead.
          </p>
          <label className="mt-4 block text-[14px] font-semibold">
            Your password
            <input name="password" type="password" required autoFocus autoComplete="current-password" className={field} />
          </label>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-chili/10 px-3.5 py-2.5 text-[14px] text-chili">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 h-[52px] w-full rounded-xl bg-chili text-[17px] font-semibold text-white active:bg-chili/85 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete for good"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="mt-1 h-11 w-full rounded-xl text-[15px] font-medium text-muted active:bg-wash"
          >
            Cancel
          </button>
        </form>
      )}
    </dialog>
  );
}
