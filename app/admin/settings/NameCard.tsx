"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckIcon } from "@/app/components/Icons";
import { btn, card } from "../kit";
import { api } from "../ui";

/** The same limit /api/staff/name holds to. */
const MAX = 35;

const field =
  "block h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-[16px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20 aria-[invalid=true]:border-chili";

/** The restaurant's name at the top of the guests' menu (and on these screens). */
export default function NameCard({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2500);
    return () => clearTimeout(t);
  }, [done]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone(false);
    setBusy(true);
    try {
      await api("/api/staff/name", { method: "POST", body: { name: value } });
      const next = value.trim();
      setValue(next);
      setSaved(next);
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof TypeError ? "No connection. Check the internet and try again." : (err as Error).message);
    }
    setBusy(false);
  };

  return (
    <section className={`${card} mt-6 flex flex-wrap items-center gap-x-6 gap-y-3`} aria-labelledby="name-title">
      <div className="min-w-0 flex-1 basis-[260px]">
        <h2 id="name-title" className="font-display text-lg font-bold leading-tight">
          <label htmlFor="cafe-name">Café name</label>
        </h2>
        <p id="cafe-name-help" className="text-[14px] text-muted">
          Guests see it at the top of the menu. Phones fit about 20 characters, fewer with a logo.
        </p>
      </div>
      <div className="w-full md:w-[420px]">
        <form onSubmit={save} className="flex gap-2">
          <input
            id="cafe-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            maxLength={MAX}
            autoComplete="organization"
            aria-invalid={!!error}
            aria-describedby={error ? "cafe-name-help cafe-name-error" : "cafe-name-help"}
            className={field}
          />
          <button type="submit" disabled={busy || value.trim() === saved} className={btn.primary}>
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
        {error ? (
          <p id="cafe-name-error" role="alert" className="mt-2 text-[14px] text-chili">
            {error}
          </p>
        ) : (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-forest empty:mt-0">
            {done && (
              <>
                <CheckIcon width={16} height={16} aria-hidden />
                Saved. Guests see the new name.
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
