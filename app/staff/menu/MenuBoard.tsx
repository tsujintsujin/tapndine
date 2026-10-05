"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminCategory, AdminDish } from "@/lib/menu-admin";
import { formatPrice } from "@/lib/format";
import { GripIcon, PlusIcon, SearchIcon } from "@/app/components/Icons";
import { btn, PageHead } from "../kit";
import { api } from "../ui";

/**
 * Every dish, in menu order. Click a row to edit it; flip the switch to mark
 * it sold out for today; drag the handle (or focus it and press the arrow
 * keys) to change where it sits on the guests' menu.
 */
export default function MenuBoard({ dishes, categories }: { dishes: AdminDish[]; categories: AdminCategory[] }) {
  const router = useRouter();
  const [list, setList] = useState(dishes);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  // The order before a drag started, to put back if the drag is abandoned.
  const before = useRef<AdminDish[] | null>(null);

  useEffect(() => setList(dishes), [dishes]);

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const q = query.trim().toLowerCase();
  const shown = list.filter(
    (d) => (!cat || d.categoryIds.includes(cat)) && (!q || d.name.toLowerCase().includes(q) || d.shortDescription.toLowerCase().includes(q))
  );
  // Reordering a filtered view would be ambiguous, so it's whole-menu only.
  const canSort = !cat && !q;
  const soldOut = list.filter((d) => !d.available).length;

  const saveOrder = async (next: AdminDish[]) => {
    setError("");
    try {
      await api("/api/staff/menu/dishes/order", { method: "POST", body: { ids: next.map((d) => d.id) } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setList(dishes);
    }
  };

  const move = (from: number, to: number) => {
    const next = [...list];
    const [d] = next.splice(from, 1);
    next.splice(to, 0, d);
    return next;
  };

  const toggle = async (d: AdminDish) => {
    setError("");
    setList((l) => l.map((x) => (x.id === d.id ? { ...x, available: !d.available } : x)));
    try {
      await api(`/api/staff/menu/dishes/${d.id}/available`, { method: "POST", body: { available: !d.available } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setList((l) => l.map((x) => (x.id === d.id ? { ...x, available: d.available } : x)));
    }
  };

  return (
    <>
      <PageHead
        title="Menu"
        sub={`${list.length} dishes${soldOut ? `, ${soldOut} not available today` : ""}`}
      >
        <Link href="/staff/menu/new" className={btn.primary}>
          <PlusIcon width={18} height={18} />
          Add dish
        </Link>
      </PageHead>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search dishes</span>
          <SearchIcon width={18} height={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes"
            className="h-11 w-full rounded-full bg-white pl-11 pr-4 text-[15px] shadow-[0_1px_2px_rgb(16_52_42/0.06)] outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </label>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ id: null, name: "All" }, ...categories].map((c) => (
            <button
              key={c.id ?? "all"}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold ${
                cat === c.id ? "bg-forest text-white" : "bg-white text-muted shadow-[0_1px_2px_rgb(16_52_42/0.06)] hover:text-ink"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgb(16_52_42/0.06)]">
        <div className="hidden grid-cols-[32px_64px_minmax(0,1fr)_200px_96px_150px] items-center gap-4 border-b border-line px-4 py-3 text-[13px] text-muted md:grid">
          <span />
          <span />
          <span>Dish</span>
          <span>Categories</span>
          <span className="text-right">Price</span>
          <span>Available today</span>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-12 text-center text-[15px] text-muted">
            {list.length === 0 ? "No dishes yet. Add the first one." : "No dish matches."}
          </p>
        ) : (
          <ul>
            {shown.map((d) => {
              const i = list.indexOf(d);
              return (
                <li
                  key={d.id}
                  onDragOver={(e) => {
                    if (!dragId || dragId === d.id) return;
                    e.preventDefault();
                    // Move the dragged row here as soon as it passes over, so
                    // the list always shows where it will land.
                    const from = list.findIndex((x) => x.id === dragId);
                    setList(move(from, i));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    before.current = null;
                    setDragId(null);
                    saveOrder(list);
                  }}
                  className={`grid grid-cols-[32px_56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-3 last:border-0 md:grid-cols-[32px_64px_minmax(0,1fr)_200px_96px_150px] md:gap-4 md:px-4 ${
                    dragId === d.id ? "bg-leaf-tint opacity-70" : "hover:bg-paper"
                  }`}
                >
                  <button
                    type="button"
                    draggable={canSort}
                    disabled={!canSort}
                    aria-label={`Move ${d.name}. Use the up and down arrow keys.`}
                    title={canSort ? "Drag to reorder" : "Clear the search and filter to reorder"}
                    onDragStart={(e) => {
                      before.current = list;
                      setDragId(d.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", d.id);
                      const row = e.currentTarget.closest("li");
                      if (row) e.dataTransfer.setDragImage(row, 24, 24);
                    }}
                    onDragEnd={() => {
                      // Dropped outside the list: put it back.
                      if (before.current) setList(before.current);
                      before.current = null;
                      setDragId(null);
                    }}
                    onKeyDown={(e) => {
                      if (!canSort) return;
                      const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
                      if (to < 0 || to >= list.length) return;
                      e.preventDefault();
                      const next = move(i, to);
                      setList(next);
                      saveOrder(next);
                      // Keep focus on the handle as the row moves.
                      requestAnimationFrame(() => (document.querySelector(`[data-grip="${d.id}"]`) as HTMLElement | null)?.focus());
                    }}
                    data-grip={d.id}
                    className="grid h-10 w-8 cursor-grab place-items-center rounded-lg text-muted hover:bg-wash hover:text-ink active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
                  >
                    <GripIcon width={18} height={18} />
                  </button>

                  <Link href={`/staff/menu/${d.id}`} tabIndex={-1} aria-hidden="true">
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.imageUrl}
                        alt=""
                        draggable={false}
                        className={`h-14 w-14 rounded-2xl object-cover md:h-16 md:w-16 ${d.available ? "" : "grayscale"}`}
                      />
                    ) : (
                      <span className="block h-14 w-14 rounded-2xl bg-wash md:h-16 md:w-16" />
                    )}
                  </Link>

                  <Link href={`/staff/menu/${d.id}`} className="min-w-0 rounded-lg py-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold hover:underline">{d.name}</span>
                      {d.featured && <Badge tone="mango">Hero</Badge>}
                      {d.bestSeller && <Badge tone="leaf">Featured</Badge>}
                      {d.isNew && <Badge tone="leaf">New</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[14px] text-muted">{d.shortDescription}</span>
                    <span className="mt-0.5 block text-[14px] font-semibold text-forest md:hidden">{formatPrice(d.priceCents)}</span>
                  </Link>

                  <span className="hidden flex-wrap gap-1 md:flex">
                    {d.categoryIds.length === 0 ? (
                      <span className="text-[13px] text-muted">None</span>
                    ) : (
                      d.categoryIds.map((c) => (
                        <span key={c} className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
                          {catName.get(c)}
                        </span>
                      ))
                    )}
                  </span>

                  <span className="hidden text-right font-display text-[17px] font-bold md:block">{formatPrice(d.priceCents)}</span>

                  <span className="flex items-center gap-2.5">
                    <Switch on={d.available} label={`${d.name} available today`} onChange={() => toggle(d)} />
                    <span className={`hidden text-[13px] lg:inline ${d.available ? "text-muted" : "font-semibold text-chili"}`}>
                      {d.available ? "Available" : "Not today"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

export function Badge({ tone, children }: { tone: "mango" | "leaf"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === "mango" ? "bg-mango-soft text-ink" : "bg-leaf-tint text-leaf"
      }`}
    >
      {children}
    </span>
  );
}

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-leaf" : "bg-line"}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`}
      />
    </button>
  );
}
