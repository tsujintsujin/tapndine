"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BASE_PATH } from "@/lib/base";

// Local testing aid, not part of the product: shows one URL at phone and
// tablet widths side by side, because a maximized desktop Chrome window
// cannot be resized to phone width. /dev/frames?u=/t/k7x9q2mp
const SIZES = [
  { w: 320, h: 640, label: "320 small phone" },
  { w: 390, h: 844, label: "390 phone" },
  { w: 768, h: 1024, label: "768 tablet" },
];

function Frames() {
  const u = useSearchParams().get("u") ?? `${BASE_PATH}/t/k7x9q2mp`;
  return (
    <div className="flex min-h-dvh items-start gap-6 overflow-x-auto bg-neutral-200 p-6">
      {SIZES.map((s) => (
        <figure key={s.w} className="shrink-0">
          <figcaption className="mb-2 text-sm text-neutral-600">{s.label}</figcaption>
          <iframe
            src={u}
            width={s.w}
            height={s.h}
            className="rounded-xl border border-neutral-400 bg-white"
            title={s.label}
          />
        </figure>
      ))}
    </div>
  );
}

export default function Page() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <Suspense>
      <Frames />
    </Suspense>
  );
}
