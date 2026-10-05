"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { Logo } from "../kit";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const field =
    "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3 text-[17px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

  return (
    <main className="flex min-h-dvh flex-col">
      <WarmBackdrop />
      <div className="bg-forest pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto max-w-sm px-6 pb-8 pt-10">
          <h1>
            <Logo href="/staff/login" light />
          </h1>
        </div>
        <div className="banig" aria-hidden="true" />
      </div>

      <form
        className="mx-auto w-full max-w-sm px-6 pt-8"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          // Plain fetch, not api(): api() treats a 401 as "logged out" and
          // reloads this page, which would swallow "Wrong username or password."
          try {
            const res = await fetch(`${BASE_PATH}/api/staff/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: f.get("username"), password: f.get("password") }),
            });
            if (res.ok) {
              window.location.href = `${BASE_PATH}/staff/dashboard`;
              return;
            }
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            setError(data.error ?? "Couldn't log in. Try again.");
          } catch {
            setError("No connection. Check the internet and try again.");
          }
          setBusy(false);
        }}
      >
        <label className="block text-[15px] font-medium">
          Username
          <input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} className={field} />
        </label>
        <label className="mt-4 block text-[15px] font-medium">
          Password
          <input name="password" type="password" required autoComplete="current-password" className={field} />
        </label>
        <div role="alert" aria-live="assertive">
          {error && (
            <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-chili/25 bg-chili/10 px-3.5 py-3 text-[15px] font-medium text-chili">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-px shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.5v.01" />
              </svg>
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-5 h-[52px] w-full rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
