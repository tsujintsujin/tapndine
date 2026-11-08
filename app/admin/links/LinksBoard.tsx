"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import type { LinksPage, TableLinks } from "@/lib/tables";
import { CheckIcon, CopyIcon, PencilIcon, PlusIcon, QrIcon, TrashIcon } from "@/app/components/Icons";
import { btn, card, PageHead } from "../kit";
import { api, useConfirm, useStaffInfo } from "../ui";

const field =
  "block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const iconBtn = "grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-wash hover:text-ink disabled:opacity-60";

/**
 * Every table and the link its NFC tag should hold. We only hand out the
 * link: the restaurant writes it to the tag with any NFC app.
 */
export default function LinksBoard({ tables, unplaced, limit }: LinksPage) {
  const full = tables.length >= limit;
  const trial = useStaffInfo().trialEndsAt !== null;
  const covers = `${trial ? "The free trial" : "Your plan"} covers ${limit} ${limit === 1 ? "table" : "tables"}`;
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirm();
  // The link as the manager reached this page, so it is right behind any proxy.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = (tag: string) => `${origin}${BASE_PATH}/t/${tag}`;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const replace = async (t: TableLinks) => {
    if (t.tags.length > 0) {
      const ok = await confirm({
        title: `New link for ${t.label}?`,
        body: "The old link stops working right away. Write the new link to this table's tag, or guests who tap it will see an unknown tag.",
        confirmLabel: "Make new link",
        danger: true,
      });
      if (!ok) return;
    }
    await run(() => api(`/api/staff/tables/${t.id}/link`, { method: "POST", body: {} }));
  };

  const remove = async (t: TableLinks) => {
    const ok = await confirm({
      title: `Delete ${t.label}?`,
      body: "It leaves the Tables page and its link stops working. Its past orders stay in the dashboard.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await run(() => api(`/api/staff/tables/${t.id}`, { method: "DELETE" }));
  };

  return (
    <>
      <PageHead title="Menu links" sub="Copy a table's link and write it to the tag on that table with any NFC app.">
        <button
          type="button"
          disabled={full}
          onClick={() => {
            setError("");
            setAdding(true);
          }}
          data-guide="add-table"
          className={btn.primary}
        >
          <PlusIcon width={18} height={18} />
          Add table
        </button>
      </PageHead>

      {full && (
        <p className="mt-4 rounded-2xl bg-mango-soft px-4 py-3 text-[15px]">
          {trial
            ? `${covers}, and it's set up. Pick a plan to add more tables.`
            : `${covers} and all ${limit} are set up. To add another, delete a table you don't use, or contact tapndine to move to a bigger plan.`}
        </p>
      )}

      {adding && !full && (
        <form
          className={`${card} mt-6 flex flex-wrap items-end gap-3`}
          onSubmit={async (e) => {
            e.preventDefault();
            const label = new FormData(e.currentTarget).get("label");
            if (await run(() => api("/api/staff/tables", { method: "POST", body: { label } }))) setAdding(false);
          }}
          onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
        >
          <label className="block min-w-0 flex-1 basis-60 text-[14px] font-semibold">
            New table
            <input name="label" required maxLength={40} autoFocus autoComplete="off" placeholder={`Table ${tables.length + 1}`} className={`${field} mt-1.5`} />
            <span className="mt-1 block text-[13px] font-normal text-muted">It gets its own link straight away.</span>
          </label>
          <div className="flex gap-2.5 pb-6">
            <button type="button" onClick={() => setAdding(false)} className={btn.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={btn.primary}>
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <section data-guide="links" className={`${card} mt-4`}>
        <h2 className="font-display text-[19px] font-bold">
          {tables.length} of {limit} tables
        </h2>
        <p className="text-[13px] text-muted">{covers}.</p>
        {tables.length === 0 && <p className="mt-2 text-[15px] text-muted">No tables yet. Add one to get its link.</p>}
        <ul className="mt-2">
          {tables.map((t, n) => (
            <li key={t.id} data-guide={n === 0 ? "first-link" : undefined} className="border-t border-line py-4 first:border-t-0">
              {editing === t.id ? (
                <form
                  className="flex flex-wrap items-center gap-2.5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const label = new FormData(e.currentTarget).get("label");
                    if (await run(() => api(`/api/staff/tables/${t.id}`, { method: "PUT", body: { label } }))) setEditing(null);
                  }}
                  onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                >
                  <label className="min-w-0 flex-1 basis-52">
                    <span className="sr-only">Table name</span>
                    <input name="label" required maxLength={40} defaultValue={t.label} autoFocus autoComplete="off" className={field} />
                  </label>
                  <button type="button" onClick={() => setEditing(null)} className={btn.secondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={busy} className={btn.primary}>
                    Save
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate font-display text-[18px] font-bold">{t.label}</span>
                  <button type="button" aria-label={`Rename ${t.label}`} disabled={busy} onClick={() => setEditing(t.id)} className={iconBtn}>
                    <PencilIcon width={19} height={19} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.label}`}
                    disabled={busy}
                    onClick={() => remove(t)}
                    className={`${iconBtn} hover:bg-chili/10 hover:text-chili`}
                  >
                    <TrashIcon width={19} height={19} />
                  </button>
                </div>
              )}

              {t.tags.length === 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-[15px] text-muted">No link yet.</span>
                  <button type="button" disabled={busy} onClick={() => replace(t)} className={`${btn.secondary} h-10`}>
                    Create link
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  {t.tags.map((tag) => (
                    <LinkRow key={tag} url={link(tag)} name={t.label} />
                  ))}
                  <button type="button" disabled={busy} onClick={() => replace(t)} className={`${btn.danger} h-10`}>
                    New link
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {unplaced.length > 0 && (
        <section className={`${card} mt-4`}>
          <h2 className="font-display text-[19px] font-bold">Menu for show</h2>
          <p className="mt-1 text-[14px] text-muted">These open your menu just to look at. Guests can&apos;t send orders from them.</p>
          <div className="mt-3 grid gap-2.5">
            {unplaced.map((tag) => (
              <LinkRow key={tag} url={link(tag)} name="Menu for show" />
            ))}
          </div>
        </section>
      )}
      {dialog}
    </>
  );
}

const pill =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[14px] font-semibold text-forest shadow-[0_1px_2px_rgb(16_52_42/0.08)] hover:bg-leaf-tint";

/** The link, selectable, with Copy and QR buttons. */
function LinkRow({ url, name }: { url: string; name: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <div className="flex min-w-0 flex-1 basis-72 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-wash py-1 pl-3.5 pr-1">
      <code className="min-w-0 flex-1 basis-48 select-all break-all py-2 text-[14px] text-ink">{url}</code>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            // No clipboard over plain http (a phone on the LAN): fall back to selecting it.
            (navigator.clipboard?.writeText(url) ?? Promise.reject()).then(
              () => setState("copied"),
              () => setState("failed")
            )
          }
          className={pill}
        >
          {state === "copied" ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
          {state === "copied" ? "Copied" : state === "failed" ? "Select it" : "Copy"}
        </button>
        <button
          type="button"
          aria-label={`QR code for ${name}`}
          onClick={async () => {
            const QR = await import("qrcode");
            setQr(await QR.toDataURL(url, { width: 1024, margin: 2 }));
          }}
          className={pill}
        >
          <QrIcon width={16} height={16} />
          QR
        </button>
      </div>
      <QrDialog src={qr} url={url} name={name} onClose={() => setQr(null)} />
    </div>
  );
}

/** The link as a QR image, for restaurants that want a printed code too. */
function QrDialog({ src, url, name, onClose }: { src: string | null; url: string; name: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (src && d && !d.open) d.showModal();
  }, [src]);

  return (
    <dialog
      ref={ref}
      aria-label={`QR code for ${name}`}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(380px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      {src && (
        <div className="p-5">
          <h2 className="font-display text-[22px] font-bold leading-tight">{name}</h2>
          <p className="mt-1 break-all text-[13px] text-muted">{url}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL */}
          <img src={src} alt={`QR code for ${url}`} className="mx-auto mt-3 aspect-square w-full max-w-[300px]" />
          <a
            href={src}
            download={`${name.replace(/[^\w-]+/g, "-")}-qr.png`}
            className="mt-4 flex h-[52px] w-full items-center justify-center rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark"
          >
            Download PNG
          </a>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="mt-1 h-11 w-full rounded-xl text-[15px] font-medium text-muted active:bg-wash"
          >
            Close
          </button>
        </div>
      )}
    </dialog>
  );
}
