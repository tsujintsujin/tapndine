"use client";

import { useRouter } from "next/navigation";
import type { Range } from "@/lib/reports";

/** Narrows the dashboard to one table. */
export default function TablePicker({
  range,
  tables,
  current,
}: {
  range: Range;
  tables: { id: string; label: string }[];
  current: string | null;
}) {
  const router = useRouter();
  return (
    <label data-guide="period" className="relative">
      <span className="sr-only">Table</span>
      <select
        value={current ?? ""}
        onChange={(e) =>
          router.push(`/admin/dashboard?range=${range}${e.target.value ? `&table=${e.target.value}` : ""}`)
        }
        className="h-11 appearance-none rounded-full border border-forest/80 bg-white pl-5 pr-10 text-[15px] font-semibold text-forest outline-none"
      >
        <option value="">All tables</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-forest" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
