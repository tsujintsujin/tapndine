"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { Logo } from "@/app/admin/kit";

// Two panels on one card: the photo with the brand on the left, the form on
// the right. Below md the photo shrinks to a banner above the form.
// "Forgot password?" swaps the form for a reset request emailed to Justin.

const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3 text-[17px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const submit =
  "mt-6 h-[52px] w-full rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60";
const textLink = "rounded font-semibold text-leaf underline-offset-4 hover:underline";

function ErrorNote({ error }: { error: string }) {
  return (
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
  );
}

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [contact, setContact] = useState("");

  const go = (m: typeof mode) => {
    setMode(m);
    setError("");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
      <WarmBackdrop />
      <div className="grid w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-20px_rgb(59_46_37/0.35)] ring-1 ring-black/5 md:max-w-5xl md:grid-cols-[1.1fr_1fr]">
        <div className="relative h-48 md:h-auto md:min-h-[600px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE_PATH}/login/photo.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/0 to-black/10" />
          <div className="relative p-5 md:p-10">
            <h1>
              <Logo href="/login" light />
            </h1>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 md:px-14 md:py-12">
          {mode === "login" && (
            <form
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
                    window.location.href = `${BASE_PATH}/admin/dashboard`;
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
              <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">Log in</h2>
              <p className="mt-1 text-[15px] text-muted">For your restaurant&apos;s staff and managers.</p>
              <label className="mt-7 block text-[15px] font-medium">
                Username
                <input
                  name="username"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={field}
                />
              </label>
              <label className="mt-4 block text-[15px] font-medium">
                Password
                <input name="password" type="password" required autoComplete="current-password" className={field} />
              </label>
              <div className="mt-2.5 text-right text-[15px]">
                <button type="button" onClick={() => go("forgot")} className={textLink}>
                  Forgot password?
                </button>
              </div>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Logging in…" : "Log in"}
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const res = await fetch(`${BASE_PATH}/api/staff/forgot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, contact }),
                  });
                  if (res.ok) {
                    setBusy(false);
                    go("sent");
                    return;
                  }
                  const data = (await res.json().catch(() => ({}))) as { error?: string };
                  setError(data.error ?? "Couldn't send the request. Try again.");
                } catch {
                  setError("No connection. Check the internet and try again.");
                }
                setBusy(false);
              }}
            >
              <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">Forgot your password?</h2>
              <p className="mt-1 text-[15px] text-muted">
                Tell us your username and how to reach you. We&apos;ll reset it and send you a new one.
              </p>
              <label className="mt-7 block text-[15px] font-medium">
                Username
                <input
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={field}
                />
              </label>
              <label className="mt-4 block text-[15px] font-medium">
                Phone number or email
                <input
                  required
                  maxLength={200}
                  autoComplete="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className={field}
                />
              </label>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Sending…" : "Send request"}
              </button>
              <p className="mt-5 text-center text-[15px]">
                <button type="button" onClick={() => go("login")} className={textLink}>
                  Back to log in
                </button>
              </p>
            </form>
          )}

          {mode === "sent" && (
            <div role="status">
              <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">Request sent</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-muted">
                We&apos;ll reset the password for <span className="font-semibold text-ink">{username.trim()}</span> and send the
                new one to <span className="font-semibold text-ink">{contact.trim()}</span>.
              </p>
              <button type="button" onClick={() => go("login")} className={submit}>
                Back to log in
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
