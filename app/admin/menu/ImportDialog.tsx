"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/app/components/Icons";
import { csvTemplate } from "@/lib/menu-csv";
import { btn } from "../kit";
import { api } from "../ui";

type Result = { errors: string[] } | { added: number; skipped: string[] };

/**
 * Bulk menu upload: download the CSV template, fill it in a spreadsheet,
 * upload it back. Every dish goes in, or none do and each problem is listed.
 */
export default function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setResult(null);
      setError("");
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const close = () => !busy && onClose();

  const getTemplate = () => {
    const url = URL.createObjectURL(new Blob([csvTemplate()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tapndine-menu-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (f: File) => {
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const r = await api<Result>("/api/staff/menu/import", { method: "POST", body: { csv: await f.text() } });
      setResult(r);
      if ("added" in r && r.added) router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      // Picking the same file again (after fixing it) should upload again.
      if (file.current) file.current.value = "";
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="import-title"
      onCancel={(e) => {
        // Cancelling the file picker fires a cancel that bubbles up to here.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[min(460px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="import-title" className="font-display text-[22px] font-bold leading-tight">
            Import menu
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-wash hover:text-ink"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <p className="mt-1.5 text-[15px] text-muted">
          Get the template, fill in one row per dish in Excel or Google Sheets, save it as CSV, then upload it. Add photos to each dish afterward.
        </p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <button type="button" onClick={getTemplate} disabled={busy} className={btn.secondary}>
            Get template
          </button>
          <button type="button" onClick={() => file.current?.click()} disabled={busy} className={btn.primary}>
            {busy ? "Uploading…" : "Upload CSV"}
          </button>
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
            {error}
          </p>
        )}

        {result && "errors" in result && (
          <div role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-chili">
            <p className="text-[15px] font-semibold">Nothing was added. Fix these and upload again:</p>
            <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-y-auto pl-5 text-[14px]">
              {result.errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {result && "added" in result && (
          <div role="status" className="mt-4 rounded-2xl bg-leaf-tint px-4 py-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-forest">
              <CheckIcon width={18} height={18} />
              {result.added === 1 ? "Added 1 dish." : `Added ${result.added} dishes.`}
            </p>
            {result.skipped.length > 0 && (
              <p className="mt-1 text-[14px] text-muted">
                Already on the menu, so skipped: {result.skipped.join(", ")}.
              </p>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
