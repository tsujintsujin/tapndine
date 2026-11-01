"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { Logo } from "@/app/admin/kit";

// Two panels on one card: the photo with the brand on the left, the form on
// the right. Below md the photo shrinks to a banner above the form.
// "Forgot password?" swaps the form for a reset request emailed to Justin.
// The same card signs a restaurant up for the free trial (/start), and logs
// its manager back in, with Google or a code emailed to them: "start", then
// "code", then for a new email "restaurant" (lib/signup.ts).

const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3 text-[17px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const submit =
  "mt-6 h-[52px] w-full rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60";
const textLink = "rounded font-semibold text-leaf underline-offset-4 hover:underline";
const outline =
  "flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-line bg-white text-[17px] font-semibold text-ink hover:bg-paper active:bg-wash";
const heading = "font-display text-[28px] font-bold leading-tight tracking-tight";

/** POST as JSON: the route's error message ("" when it worked) and its answer. */
async function post(path: string, body: unknown): Promise<{ error: string; data: Record<string, unknown> }> {
  try {
    const res = await fetch(`${BASE_PATH}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { error: res.ok ? "" : String(data.error ?? "Something went wrong. Try again."), data };
  } catch {
    return { error: "No connection. Check the internet and try again.", data: {} };
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

/** A thin rule with "or" in the middle. */
function OrRule() {
  return (
    <div className="my-5 flex items-center gap-3 text-[14px] text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** What Google sign-in can come back with, by the ?error= it puts on /start. */
const START_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't finish. Try again, or use your email.",
  off: "This restaurant is switched off. Ask tapndine to switch it back on.",
};

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

type Mode = "login" | "forgot" | "sent" | "start" | "code" | "restaurant";

/**
 * start: open on the trial sign-up. pending: an email that is proven but has
 * no restaurant yet (opens on naming it). google: show "Continue with Google".
 */
export default function LoginForm({
  start = false,
  pending = null,
  google = false,
  startError,
}: {
  start?: boolean;
  pending?: string | null;
  google?: boolean;
  startError?: string;
}) {
  const [mode, setMode] = useState<Mode>(pending ? "restaurant" : start ? "start" : "login");
  const [error, setError] = useState(startError ? (START_ERRORS[startError] ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState(pending ?? "");
  const [resent, setResent] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setError("");
  };

  /** Emails a code. firstAsk: from the email step, where a code sent a moment ago counts as sent. */
  const sendCode = async (firstAsk = false) => {
    setBusy(true);
    setError("");
    const r = await post("/api/auth/email", { email });
    setBusy(false);
    if (firstAsk && r.data.recent) return true;
    if (r.error) setError(r.error);
    return !r.error;
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
              <OrRule />
              <button type="button" onClick={() => go("start")} className={outline}>
                Sign in with email or Google
              </button>
              <p className="mt-4 text-center text-[15px] text-muted">
                New restaurant?{" "}
                <button type="button" onClick={() => go("start")} className={textLink}>
                  Try it free for 7 days
                </button>
              </p>
            </form>
          )}

          {mode === "start" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await sendCode(true)) {
                  setResent(false);
                  go("code");
                }
              }}
            >
              <h2 className={heading}>Try tapndine free</h2>
              <p className="mt-1 text-[15px] leading-snug text-muted">
                7 days, every feature, 1 table. Signed up already? Use the same email or Google account to get back in.
              </p>
              {google && (
                <>
                  <a href={`${BASE_PATH}/api/auth/google`} className={`${outline} mt-7`}>
                    <GoogleMark />
                    Continue with Google
                  </a>
                  <OrRule />
                </>
              )}
              <label className={`${google ? "" : "mt-7 "}block text-[15px] font-medium`}>
                Email
                <input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={field}
                />
              </label>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Sending…" : "Email me a code"}
              </button>
              <p className="mt-5 text-center text-[15px] text-muted">
                Have a username?{" "}
                <button type="button" onClick={() => go("login")} className={textLink}>
                  Log in
                </button>
              </p>
            </form>
          )}

          {mode === "code" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get("code") ?? "");
                setBusy(true);
                setError("");
                const r = await post("/api/auth/email/verify", { email, code });
                if (r.error) {
                  setError(r.error);
                  setBusy(false);
                  return;
                }
                if (r.data.next === "in") {
                  window.location.href = `${BASE_PATH}/admin/dashboard`;
                  return;
                }
                setBusy(false);
                go("restaurant");
              }}
            >
              <h2 className={heading}>Check your email</h2>
              <p className="mt-1 text-[15px] leading-snug text-muted">
                We sent a 6-digit code to <span className="font-semibold text-ink">{email.trim()}</span>. It works for 10
                minutes.
              </p>
              <label className="mt-7 block text-[15px] font-medium">
                Code
                <input
                  name="code"
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  className={`${field} text-center font-display text-[26px] font-bold tracking-[0.4em]`}
                />
              </label>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Checking…" : "Continue"}
              </button>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[15px]">
                <button type="button" onClick={() => go("start")} className={textLink}>
                  Use a different email
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => setResent(await sendCode())}
                  className={`${textLink} disabled:opacity-60`}
                >
                  Send a new code
                </button>
              </div>
              <p role="status" className="mt-3 min-h-[1.5em] text-center text-[14px] text-leaf">
                {resent && !error ? "New code sent. Check your inbox and spam folder." : ""}
              </p>
            </form>
          )}

          {mode === "restaurant" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                const r = await post("/api/auth/signup", { restaurant: f.get("restaurant"), name: f.get("name") });
                if (r.error) {
                  setError(r.error);
                  setBusy(false);
                  return;
                }
                window.location.href = `${BASE_PATH}/admin/menu`;
              }}
            >
              <h2 className={heading}>Name your restaurant</h2>
              <p className="mt-1 text-[15px] leading-snug text-muted">
                Signed in as <span className="font-semibold text-ink">{email}</span>. Your free week starts when you tap
                Start.
              </p>
              <label className="mt-7 block text-[15px] font-medium">
                Restaurant or cafe name
                <input name="restaurant" required maxLength={60} autoComplete="organization" className={field} />
              </label>
              <label className="mt-4 block text-[15px] font-medium">
                Your name
                <input name="name" required maxLength={60} autoComplete="name" className={field} />
              </label>
              <ul className="mt-5 space-y-1.5 rounded-xl bg-paper px-4 py-3 text-[14px] text-muted">
                <li>1 table with its QR code, ready to print</li>
                <li>Up to 2 waiter logins besides yours</li>
                <li>Every feature, free for 7 days. No card needed.</li>
              </ul>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Setting up…" : "Start free trial"}
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
