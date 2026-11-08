"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import type { AdminCategory, AdminDish } from "@/lib/menu-admin";
import { ChevronRight, GripIcon, PlusIcon } from "@/app/components/Icons";
import { btn, PageHead, SkeletonList } from "../kit";
import { api } from "../ui";

/** Each main category with its sub-categories right after it, keeping their order. */
const nest = (list: AdminCategory[]) =>
  list.filter((c) => !c.parentId).flatMap((c) => [c, ...list.filter((s) => s.parentId === c.id)]);

/** Names a new category and says what it sits under. Goes straight on to picking its dishes. */
function AddCategoryDialog({
  parentId,
  mains,
  onClose,
}: {
  parentId: string | null;
  mains: AdminCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="add-category-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A tap on the backdrop lands on the dialog itself, not the card.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[min(420px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      <form
        className="p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const { id } = await api<{ id: string }>("/api/staff/menu/categories", {
              method: "POST",
              body: { name: form.get("name"), parentId: form.get("parentId") },
            });
            router.push(`/admin/categories/${id}`);
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <h2 id="add-category-title" className="font-display text-[22px] font-bold leading-tight">
          {parentId ? "Add sub-category" : "Add category"}
        </h2>
        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
            {error}
          </p>
        )}
        <label className="mt-4 block text-[14px] font-semibold">
          Name
          <input
            name="name"
            required
            maxLength={30}
            autoFocus
            autoComplete="off"
            placeholder={parentId ? "Coffee" : "Desserts"}
            className={field}
          />
        </label>
        <label className="mt-3 block text-[14px] font-semibold">
          Inside another category?
          <select name="parentId" defaultValue={parentId ?? ""} className={field}>
            <option value="">No, it&apos;s on its own</option>
            {mains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[13px] text-muted">For example, put Coffee inside Drinks.</p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btn.primary}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] font-normal outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

/**
 * Every category, in the order guests see the tags on the full menu, with
 * sub-categories under their main one. Click one to rename it or pick its
 * dishes; drag the handle (or focus it and press the arrow keys) to move it
 * among the rows on its level. A main category takes its sub-categories along.
 */
export default function CategoryBoard({ categories, dishes }: { categories: AdminCategory[]; dishes: AdminDish[] }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  // Open with the main category a new one will sit under, if any.
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  // The order before a drag started, to put back if the drag is abandoned.
  const before = useRef<AdminCategory[] | null>(null);
  // The row a drag last moved past. A main category with sub-categories is
  // taller than the row it swaps with, so the pointer can still be on that row
  // after the swap; moving again would make them flip back and forth.
  const lastOver = useRef<string | null>(null);

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

  const move = (id: string, onto: string) => {
    const next = [...list];
    const to = next.findIndex((c) => c.id === onto);
    const [c] = next.splice(next.findIndex((x) => x.id === id), 1);
    next.splice(to, 0, c);
    return nest(next);
  };

  const empty = list.filter((c) => c.dishCount === 0).length;
  const mains = list.filter((c) => !c.parentId);
  const subCount = list.length - mains.length;

  return (
    <>
      <PageHead
        title="Categories"
        sub={`${mains.length} ${mains.length === 1 ? "category" : "categories"}${
          subCount ? ` and ${subCount} sub-${subCount === 1 ? "category" : "categories"}` : ""
        }, the tags guests filter the full menu by`}
      >
        <button
          type="button"
          onClick={() => {
            setError("");
            setAdding({ parentId: null });
          }}
          data-guide="add-category"
          className={btn.primary}
        >
          <PlusIcon width={18} height={18} />
          Add category
        </button>
      </PageHead>

      {adding && <AddCategoryDialog parentId={adding.parentId} mains={mains} onClose={() => setAdding(null)} />}

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
          <SkeletonList
            title="Your categories go here"
            text="Group your dishes so guests find them fast: Rice meals, Drinks, Desserts."
          >
            {!adding && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setAdding({ parentId: null });
                }}
                className={btn.primary}
              >
                <PlusIcon width={18} height={18} />
                Add category
              </button>
            )}
          </SkeletonList>
        ) : (
          <ul data-guide="categories">
            {list.map((c, i) => {
              const ids = [c.id, ...list.filter((s) => s.parentId === c.id).map((s) => s.id)];
              const inIt = dishes.filter((d) => d.categoryIds.some((id) => ids.includes(id)));
              const lastSub = c.parentId && list[i + 1]?.parentId !== c.parentId;
              return (
                <Fragment key={c.id}>
                <li
                  data-guide={i < 3 ? "first-categories" : undefined}
                  onDragOver={(e) => {
                    const dragged = list.find((x) => x.id === dragId);
                    if (!dragged) return;
                    // A sub-category stays among its own; a main category moves
                    // past whole groups, so a sub-category row counts as its main.
                    const onto = dragged.parentId ? (c.parentId === dragged.parentId ? c.id : null) : (c.parentId ?? c.id);
                    if (!onto) return;
                    e.preventDefault();
                    if (onto === dragged.id) lastOver.current = null;
                    else if (onto !== lastOver.current) {
                      lastOver.current = onto;
                      // Move the dragged row here as soon as it passes over, so
                      // the list always shows where it will land.
                      setList(move(dragged.id, onto));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    before.current = null;
                    setDragId(null);
                    saveOrder(list);
                  }}
                  className={`grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 border-b border-line py-2 pr-3 last:border-0 md:gap-4 md:pr-4 ${
                    c.parentId ? "pl-7 md:pl-10" : "pl-3 md:pl-4"
                  } ${
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
                      lastOver.current = null;
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
                      const level = list.filter((x) => x.parentId === c.parentId);
                      const at = level.findIndex((x) => x.id === c.id);
                      const onto = e.key === "ArrowUp" ? level[at - 1] : e.key === "ArrowDown" ? level[at + 1] : undefined;
                      if (!onto) return;
                      e.preventDefault();
                      const next = move(c.id, onto.id);
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
                      <span className={`block truncate ${c.parentId ? "font-medium" : "font-semibold"}`}>{c.name}</span>
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
                {lastSub && (
                  <li className="border-b border-line py-1 pl-7 pr-3 last:border-0 md:pl-10 md:pr-4">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setAdding({ parentId: c.parentId });
                      }}
                      className="flex h-11 items-center gap-2 rounded-lg px-2 text-[14px] font-semibold text-leaf hover:bg-paper"
                    >
                      <PlusIcon width={16} height={16} />
                      Add sub-category
                    </button>
                  </li>
                )}
                </Fragment>
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
