"use client";

import { useState } from "react";
import { btn, card } from "../kit";
import { switchGuide } from "../Guide";

/** Opens the guide again: every page, shown on Cove Café. */
export default function GuideCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className={`${card} mt-4 flex flex-wrap items-center gap-4`} aria-labelledby="guide-title">
      <div className="min-w-0 flex-1 basis-[240px]">
        <h2 id="guide-title" className="font-display text-lg font-bold leading-tight">
          Guide
        </h2>
        <p className="text-[14px] text-muted">A walk through every page, shown on Cove Café. Nothing in it is saved.</p>
        {error && (
          <p role="alert" className="mt-1 text-[14px] text-chili">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          await switchGuide(true).catch((e) => {
            setError((e as Error).message);
            setBusy(false);
          });
        }}
        className={btn.secondary}
      >
        {busy ? "Opening…" : "See guide"}
      </button>
    </section>
  );
}
