"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { Logo } from "../kit";
import { api } from "../ui";

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
          try {
            await api("/api/staff/login", {
              method: "POST",
              body: { username: f.get("username"), password: f.get("password") },
            });
            window.location.href = `${BASE_PATH}/staff`;
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
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
        <p role="alert" className="mt-3 min-h-5 text-[15px] text-chili">
          {error}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-[52px] w-full rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
