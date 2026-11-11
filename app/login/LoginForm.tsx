"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { Logo } from "@/app/admin/kit";
import { PLANS } from "@/lib/plans";
import { OWNER_MIN_PASSWORD, TRIAL_DAYS, TRIAL_STAFF, TRIAL_TABLES } from "@/lib/trial";

// Two panels on one card: the photo with the brand on the left, the form on
// the right. Below md the photo shrinks to a banner above the form.
//
// Log in (/login): an owner's email or a staff username, and the password; or
// Google for owners. Create an account (/start): email and password, proven
// once with an emailed code ("code"), or Google; then "restaurant" names it
// and picks the free trial or a plan to buy (/start/plans, paid with QR Ph;
// the account is made once it's paid). "Forgot password?" emails an owner a code
// ("reset"); a staff username's request goes to Justin as before.

const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3 text-[17px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const submit =
  "mt-6 h-[52px] w-full rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60";
const textLink = "rounded font-semibold text-leaf underline-offset-4 hover:underline";
const outline =
  "flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-line bg-white text-[17px] font-semibold text-ink hover:bg-paper active:bg-wash";
const heading = "font-display text-[28px] font-bold leading-tight tracking-tight";
const sub = "mt-1 text-[15px] leading-snug text-muted";

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

/** "Continue with Google", then a rule with "or". */
function GoogleFirst() {
  return (
    <>
      <a href={`${BASE_PATH}/api/auth/google`} className={`${outline} mt-7`}>
        <GoogleMark />
        Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3 text-[14px] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

/** A password box with a Show/Hide button inside it. */
function PasswordField({
  label,
  name,
  autoComplete,
  hint,
  minLength,
  value,
  onChange,
}: {
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  minLength?: number;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="mt-4 block text-[15px] font-medium">
      {label}
      <span className="relative mt-1.5 block">
        <input
          name={name}
          type={shown ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={200}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange && ((e) => onChange(e.target.value))}
          className={`${field} mt-0 pr-20`}
        />
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

/** What Google sign-in can come back with, by the ?error= it puts on /start. */
const START_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't finish. Try again, or use your email.",
  off: "This restaurant is switched off. Ask tappetite to switch it back on.",
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

type Mode = "login" | "forgot" | "sent" | "reset" | "start" | "code" | "restaurant";

/**
 * start: open on creating an account. pending: an email that is proven but has
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
  const [password, setPassword] = useState("");
  const [resent, setResent] = useState(false);
  const [restaurant, setRestaurant] = useState("");
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<"trial" | "buy">("trial");

  const go = (m: Mode) => {
    setMode(m);
    setError("");
  };
  const ownerReset = username.includes("@");

  /** Emails the sign-up code. firstAsk: from the form, where a code sent a moment ago counts as sent. */
  const sendCode = async (firstAsk = false) => {
    setBusy(true);
    setError("");
    const r = await post("/api/auth/email", { email, password });
    setBusy(false);
    if (firstAsk && r.data.recent) return true;
    if (r.error) setError(r.error);
    return !r.error;
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:py-10">
      <WarmBackdrop />
      {/* One fixed height on desktop for every step, so the card never resizes and the photo never re-crops. */}
      <div className="grid w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-20px_rgb(59_46_37/0.35)] ring-1 ring-black/5 md:h-[720px] md:max-w-5xl md:grid-cols-[1.1fr_1fr]">
        <div className="relative h-48 md:h-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE_PATH}/login/photo.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/0 to-black/10" />
          <div className="relative p-5 md:p-10">
            <h1>
              <Logo href="/login" light />
            </h1>
          </div>
        </div>

        <div className="flex flex-col px-6 py-8 sm:px-10 md:overflow-y-auto md:px-14 md:py-12">
          <div className="my-auto">
          {mode === "login" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                // Plain fetch, not api(): api() treats a 401 as "logged out" and
                // reloads this page, which would swallow "Wrong email, username or password."
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
              <h2 className={heading}>Log in</h2>
              <p className={sub}>Owners use their email. Staff use the username their manager gave them.</p>
              {google && <GoogleFirst />}
              <label className={`${google ? "" : "mt-7 "}block text-[15px] font-medium`}>
                Email or username
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
              <PasswordField label="Password" name="password" autoComplete="current-password" />
              <div className="mt-2.5 text-right text-[15px]">
                <button type="button" onClick={() => go("forgot")} className={textLink}>
                  Forgot password?
                </button>
              </div>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Logging in…" : "Log in"}
              </button>
              <p className="mt-5 text-center text-[15px] text-muted">
                New to tappetite?{" "}
                <button type="button" onClick={() => go("start")} className={textLink}>
                  Create an account
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
              <h2 className={heading}>Create your account</h2>
              <p className={sub}>
                For restaurant and cafe owners. Next you pick a free {TRIAL_DAYS}-day trial or buy a plan.
              </p>
              {google && <GoogleFirst />}
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
              <PasswordField
                label="Password"
                name="new-password"
                autoComplete="new-password"
                minLength={OWNER_MIN_PASSWORD}
                hint={`At least ${OWNER_MIN_PASSWORD} characters.`}
                value={password}
                onChange={setPassword}
              />
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Sending…" : "Create account"}
              </button>
              <p className="mt-5 text-center text-[15px] text-muted">
                Have an account?{" "}
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
                const r = await post("/api/auth/email/verify", { email, code, password });
                setBusy(false);
                if (r.error) return setError(r.error);
                go("restaurant");
              }}
            >
              <h2 className={heading}>Check your email</h2>
              <p className={sub}>
                We sent a 6-digit code to <span className="font-semibold text-ink">{email.trim()}</span> to confirm it&apos;s
                yours. It works for 10 minutes.
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
                {busy ? "Checking…" : "Confirm email"}
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
                setBusy(true);
                setError("");
                const buy = choice === "buy";
                const r = await post("/api/auth/signup", { restaurant, name, buy });
                if (r.error) {
                  setError(r.error);
                  setBusy(false);
                  return;
                }
                window.location.href = `${BASE_PATH}${buy ? "/start/plans" : "/admin/menu"}`;
              }}
            >
              <h2 className={heading}>Set up your restaurant</h2>
              <p className={sub}>
                Signed up as <span className="font-semibold text-ink">{email}</span>.
              </p>
              <label className="mt-7 block text-[15px] font-medium">
                Restaurant or cafe name
                <input
                  name="restaurant"
                  required
                  maxLength={60}
                  autoComplete="organization"
                  value={restaurant}
                  onChange={(e) => setRestaurant(e.target.value)}
                  className={field}
                />
              </label>
              <label className="mt-4 block text-[15px] font-medium">
                Your name
                <input
                  name="name"
                  required
                  maxLength={60}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                />
              </label>
              <fieldset className="mt-6">
                <legend className="text-[15px] font-medium">How do you want to start?</legend>
                <div className="mt-2 grid gap-3">
                  {(
                    [
                      ["trial", "Free trial", `${TRIAL_DAYS} days free, ${TRIAL_TABLES} table and ${TRIAL_STAFF} staff logins. No payment.`],
                      ["buy", "Buy a plan", `From ₱${Math.min(...PLANS.map((p) => p.monthly))} a month, or less by the year. Pay with QR Ph.`],
                    ] as const
                  ).map(([value, title, text]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border bg-white px-4 py-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf/40 ${
                        choice === value ? "border-leaf bg-leaf-tint/40 ring-1 ring-leaf" : "border-line hover:border-leaf/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="choice"
                        value={value}
                        checked={choice === value}
                        onChange={() => setChoice(value)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--leaf))]"
                      />
                      <span>
                        <span className="block text-[17px] font-semibold text-ink">{title}</span>
                        <span className="block text-[14px] leading-snug text-muted">{text}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? (choice === "buy" ? "Opening plans…" : "Setting up…") : choice === "buy" ? "Choose a plan" : "Start free trial"}
              </button>
            </form>
          )}


          {mode === "forgot" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                if (ownerReset) {
                  const r = await post("/api/auth/reset", { email: username.trim() });
                  setBusy(false);
                  if (r.error) return setError(r.error);
                  setPassword("");
                  return go("reset");
                }
                const r = await post("/api/staff/forgot", { username, contact });
                setBusy(false);
                if (r.error) return setError(r.error);
                go("sent");
              }}
            >
              <h2 className={heading}>Forgot your password?</h2>
              <p className={sub}>
                {ownerReset
                  ? "We'll email you a code to set a new password."
                  : "Owners: type your email. Staff: type your username and how to reach you, and we'll send you a new password."}
              </p>
              <label className="mt-7 block text-[15px] font-medium">
                Email or username
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
              {!ownerReset && (
                <label className="mt-4 block text-[15px] font-medium">
                  Phone number or email to reach you
                  <input
                    required
                    maxLength={200}
                    autoComplete="email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className={field}
                  />
                </label>
              )}
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Sending…" : ownerReset ? "Email me a code" : "Send request"}
              </button>
              <p className="mt-5 text-center text-[15px]">
                <button type="button" onClick={() => go("login")} className={textLink}>
                  Back to log in
                </button>
              </p>
            </form>
          )}

          {mode === "reset" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get("code") ?? "");
                setBusy(true);
                setError("");
                const r = await post("/api/auth/reset/verify", { email: username.trim(), code, password });
                if (r.error) {
                  setError(r.error);
                  setBusy(false);
                  return;
                }
                window.location.href = `${BASE_PATH}/admin/dashboard`;
              }}
            >
              <h2 className={heading}>Set a new password</h2>
              <p className={sub}>
                If <span className="font-semibold text-ink">{username.trim()}</span> has an account, we emailed it a 6-digit
                code. It works for 10 minutes.
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
              <PasswordField
                label="New password"
                name="new-password"
                autoComplete="new-password"
                minLength={OWNER_MIN_PASSWORD}
                hint={`At least ${OWNER_MIN_PASSWORD} characters.`}
                value={password}
                onChange={setPassword}
              />
              <ErrorNote error={error} />
              <button type="submit" disabled={busy} className={submit}>
                {busy ? "Saving…" : "Save password and log in"}
              </button>
              <p className="mt-5 text-center text-[15px]">
                <button type="button" onClick={() => go("forgot")} className={textLink}>
                  Use a different email
                </button>
              </p>
            </form>
          )}

          {mode === "sent" && (
            <div role="status">
              <h2 className={heading}>Request sent</h2>
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
      </div>
    </main>
  );
}
