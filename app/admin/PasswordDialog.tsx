"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/app/components/Icons";
import { btn } from "./kit";
import { api } from "./ui";

/** The same minimum as OWNER_MIN_PASSWORD (lib/trial.ts), which the server holds to. */
const MIN = 8;

const field =
  "block h-12 w-full rounded-xl border border-line bg-white px-3.5 pr-20 text-[16px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

/** The owner's own password: the current one, then the new one. Other browsers are logged out. */
export default function PasswordDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/staff/password", { method: "POST", body: { current: f.get("current"), password: f.get("password") } });
      setDone(true);
    } catch (err) {
      setError(err instanceof TypeError ? "No connection. Check the internet and try again." : (err as Error).message);
    }
    setBusy(false);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="password-title"
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-[24px] border-0 bg-white p-0 text-ink shadow-[0_24px_60px_-20px_rgb(59_46_37/0.45)] backdrop:bg-forest/50"
    >
      <div className="p-6">
        <h2 id="password-title" className="font-display text-[24px] font-bold leading-tight">
          Change password
        </h2>
        {done ? (
          <>
            <p role="status" className="mt-3 flex items-center gap-2 text-[16px] font-semibold text-forest">
              <CheckIcon width={18} height={18} aria-hidden />
              Password changed.
            </p>
            <p className="mt-1 text-[15px] text-muted">Use it next time you log in. Other phones and computers were logged out.</p>
            <button type="button" onClick={() => ref.current?.close()} className={`${btn.primary} mt-6 w-full`}>
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <Password label="Current password" name="current" autoComplete="current-password" />
            <Password label="New password" name="password" autoComplete="new-password" minLength={MIN} hint={`At least ${MIN} characters.`} />
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-chili/10 px-3.5 py-3 text-[15px] font-medium text-chili">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={`${btn.primary} mt-6 w-full`}>
              {busy ? "Saving…" : "Change password"}
            </button>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="mt-1 h-11 w-full rounded-xl text-[15px] font-medium text-muted hover:bg-paper"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}

/** A password box with Show/Hide inside it, as on the login page. */
function Password({
  label,
  name,
  autoComplete,
  minLength,
  hint,
}: {
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  hint?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="mt-4 block text-[15px] font-medium">
      {label}
      <span className="relative mt-1.5 block">
        <input name={name} type={shown ? "text" : "password"} required minLength={minLength} maxLength={200} autoComplete={autoComplete} className={field} />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-1 right-1 rounded-lg px-3 text-[14px] font-semibold text-leaf hover:bg-paper"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </span>
      {hint && <span className="mt-1.5 block text-[14px] font-normal text-muted">{hint}</span>}
    </label>
  );
}
