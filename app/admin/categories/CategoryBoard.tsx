"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminCategory, AdminDish } from "@/lib/menu-admin";
import { ChevronRight, GripIcon, PlusIcon } from "@/app/components/Icons";
import { btn, PageHead } from "../kit";
import { api } from "../ui";

/**
 * Every category, in the order guests see the tags on the full menu. Click
 * one to rename it or pick its dishes; drag the handle (or focus it and press
 * the arrow keys) to move it.
 */
export default function CategoryBoard({ categories, dishes }: { categories: AdminCategory[]; dishes: AdminDish[] }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  // The order before a drag started, to put back if the drag is abandoned.
  const before = useRef<AdminCategory[] | null>(null);

  useEffect(() => setList(categories), [categories]);

  const saveOrder = async (next: AdminCategory[]) => {
    setError("");
    try {
      await api("/api/staff/menu/categories/order", { method: "POST", body: { ids: next.map((c) => c.id) } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setList(categories);
    }
  };

  const move = (from: number, to: number) => {
    const next = [...list];
    const [c] = next.splice(from, 1);
    next.splice(to, 0, c);
    return next;
  };

  const empty = list.filter((c) => c.dishCount === 0).length;

  return (
    <>
      <PageHead
        title="Categories"
        sub={`${list.length} ${list.length === 1 ? "category" : "categories"}, the tags guests filter the full menu by`}
      >
        <button
          type="button"
          onClick={() => {
            setError("");
            setAdding(true);
          }}
          className={btn.primary}
        >
          <PlusIcon width={18} height={18} />
          Add category
        </button>
      </PageHead>

      {adding && (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 rounded-[22px] bg-white p-5 shadow-[0_1px_2px_rgb(16_52_42/0.06)]"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get("name");
            setBusy(true);
            setError("");
            try {
              const { id } = await api<{ id: string }>("/api/staff/menu/categories", { method: "POST", body: { name } });
              // Straight on to picking its dishes.
              router.push(`/admin/categories/${id}`);
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }}
          onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
        >
          <label className="block min-w-0 flex-1 basis-60 text-[14px] font-semibold">
            New category
            <input
              name="name"
              required
              maxLength={30}
              autoFocus
              autoComplete="off"
              placeholder="Desserts"
              className="mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
            />
          </label>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => setAdding(false)} className={btn.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={btn.primary}>
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgb(16_52_42/0.06)]">
        <div className="hidden grid-cols-[32px_minmax(0,1fr)_220px_24px] items-center gap-4 border-b border-line px-4 py-3 text-[13px] text-muted md:grid">
          <span />
          <span>Category</span>
          <span>Dishes</span>
          <span />
        </div>
        {list.length === 0 ? (
          <p className="px-4 py-12 text-center text-[15px] text-muted">No categories yet. Add the first one.</p>
        ) : (
          <ul>
            {list.map((c, i) => {
              const inIt = dishes.filter((d) => d.categoryIds.includes(c.id));
              return (
                <li
                  key={c.id}
                  onDragOver={(e) => {
                    if (!dragId || dragId === c.id) return;
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
                  className={`grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 border-b border-line px-3 py-2 last:border-0 md:gap-4 md:px-4 ${
                    dragId === c.id ? "bg-leaf-tint opacity-70" : "hover:bg-paper"
                  }`}
                >
                  <button
                    type="button"
                    draggable
                    aria-label={`Move ${c.name}. Use the up and down arrow keys.`}
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      before.current = list;
                      setDragId(c.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.id);
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
                      const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
                      if (to < 0 || to >= list.length) return;
                      e.preventDefault();
                      const next = move(i, to);
                      setList(next);
                      saveOrder(next);
                      // Keep focus on the handle as the row moves.
                      requestAnimationFrame(() => (document.querySelector(`[data-grip="${c.id}"]`) as HTMLElement | null)?.focus());
                    }}
                    data-grip={c.id}
                    className="grid h-10 w-8 cursor-grab place-items-center rounded-lg text-muted hover:bg-wash hover:text-ink active:cursor-grabbing"
                  >
                    <GripIcon width={18} height={18} />
                  </button>

                  <Link
                    href={`/admin/categories/${c.id}`}
                    draggable={false}
                    className="grid min-h-14 grid-cols-[minmax(0,1fr)_24px] items-center gap-3 rounded-lg py-1 md:grid-cols-[minmax(0,1fr)_220px_24px] md:gap-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className={`block text-[14px] ${c.dishCount ? "text-muted" : "text-chili"}`}>
                        {c.dishCount === 0
                          ? "No dishes, so guests don't see it"
                          : `${c.dishCount} ${c.dishCount === 1 ? "dish" : "dishes"}`}
                      </span>
                    </span>
                    <span className="hidden items-center md:flex">
                      {inIt.slice(0, 5).map((d) =>
                        d.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={d.id}
                            src={d.imageUrl}
                            alt=""
                            title={d.name}
                            draggable={false}
                            className="-ml-2 h-10 w-10 rounded-full border-2 border-white object-cover first:ml-0"
                          />
                        ) : (
                          <span key={d.id} title={d.name} className="-ml-2 h-10 w-10 rounded-full border-2 border-white bg-wash first:ml-0" />
                        )
                      )}
                      {inIt.length > 5 && (
                        <span className="-ml-2 grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-paper text-[12px] font-semibold text-muted">
                          +{inIt.length - 5}
                        </span>
                      )}
                    </span>
                    <ChevronRight width={20} height={20} className="text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {empty > 0 && (
        <p className="mt-3 text-[13px] text-muted">
          A category with no dishes stays off the guests&apos; menu until you put a dish in it.
        </p>
      )}
    </>
  );
}
