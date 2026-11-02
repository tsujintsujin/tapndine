"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminCategory, AdminDish } from "@/lib/menu-admin";
import { formatPrice } from "@/lib/format";
import { ArrowUpRight, ChevronLeft, SearchIcon, TrashIcon } from "@/app/components/Icons";
import { btn, card, PageHead } from "../kit";
import { api, useConfirm } from "../ui";

const field =
  "mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";

/** Renames a category and picks which dishes are in it. Nothing saves until Save changes. */
export default function CategoryEditor({
  category,
  categories,
  dishes,
}: {
  category: AdminCategory;
  categories: AdminCategory[];
  dishes: AdminDish[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const start = useRef(dishes.filter((d) => d.categoryIds.includes(category.id)).map((d) => d.id));
  const [name, setName] = useState(category.name);
  const [parentId, setParentId] = useState(category.parentId);
  const subs = categories.filter((c) => c.parentId === category.id);
  const mains = categories.filter((c) => !c.parentId && c.id !== category.id);
  const [picked, setPicked] = useState<string[]>(start.current);
  const [query, setQuery] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  const dirty =
    name !== category.name ||
    parentId !== category.parentId ||
    picked.length !== start.current.length ||
    picked.some((id) => !start.current.includes(id));

  // Leaving with unsaved changes asks first (reload, close, or typing a URL).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!done.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const q = query.trim().toLowerCase();
  const shown = dishes.filter(
    (d) =>
      (!onlyPicked || picked.includes(d.id)) &&
      (!q || d.name.toLowerCase().includes(q) || d.shortDescription.toLowerCase().includes(q))
  );

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/staff/menu/categories/${category.id}`, { method: "PUT", body: { name, dishIds: picked, parentId } });
      done.current = true;
      router.push("/admin/categories");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${category.name}?`,
      body: `The tag comes off the guests' menu. Its dishes stay on the menu, just without this tag.${
        subs.length ? " Its sub-categories become main categories." : ""
      }`,
      confirmLabel: "Delete category",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/staff/menu/categories/${category.id}`, { method: "DELETE" });
      done.current = true;
      router.push("/admin/categories");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const chip = (on: boolean) =>
    `h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold ${
      on ? "bg-forest text-white" : "bg-paper text-muted hover:text-ink"
    }`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Link
        href="/admin/categories"
        className="inline-flex h-9 items-center gap-1 rounded-full pr-3 text-[14px] font-semibold text-muted hover:text-ink"
      >
        <ChevronLeft width={18} height={18} />
        Categories
      </Link>
      <PageHead title={name.trim() || "Untitled category"}>
        <Link href="/admin/categories" className={btn.secondary}>
          Cancel
        </Link>
        <button type="submit" disabled={busy || !dirty} className={btn.primary}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </PageHead>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className={`${card} lg:order-2`}>
          <h2 className="font-display text-[19px] font-bold">Name</h2>
          <label className="mt-3 block text-[14px] font-semibold">
            <span className="sr-only">Category name</span>
            <input
              required
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className={field}
            />
          </label>
          {subs.length > 0 ? (
            <p className="mt-3 text-[14px]">
              <span className="font-semibold">Sub-categories: </span>
              {subs.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/categories/${s.id}`} className="font-semibold text-leaf hover:underline">
                    {s.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : (
            <label className="mt-3 block text-[14px] font-semibold">
              Sits under
              <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)} className={field}>
                <option value="">Nothing, it&apos;s a main category</option>
                {mains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="mt-3 text-[13px] text-muted">
            Guests see it as a tag on the full menu{parentId ? ", after they tap the category it sits under" : ""}. With no dishes in it, it stays hidden. Its dishes show in the same
            order as on the{" "}
            <Link href="/admin/menu" className="font-semibold text-leaf hover:underline">
              Menu
            </Link>{" "}
            page; change the order there.
          </p>
          <button type="button" disabled={busy} onClick={remove} className={`${btn.danger} mt-3 -ml-4`}>
            <TrashIcon width={18} height={18} />
            Delete category
          </button>
        </section>

        <section className={`${card} lg:order-1`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-[19px] font-bold">Dishes</h2>
            <p className="text-[14px] text-muted">
              {picked.length} of {dishes.length} {subs.length > 0 && "directly "}in {name.trim() || "this category"}
            </p>
          </div>
          {subs.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">
              Dishes in its sub-categories already show here for guests. Tick a dish only if it fits no sub-category.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search dishes</span>
              <SearchIcon
                width={18}
                height={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes"
                className="h-11 w-full rounded-full bg-paper pl-11 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-leaf/30"
              />
            </label>
            <div className="flex gap-1.5">
              <button type="button" aria-pressed={!onlyPicked} onClick={() => setOnlyPicked(false)} className={chip(!onlyPicked)}>
                All dishes
              </button>
              <button type="button" aria-pressed={onlyPicked} onClick={() => setOnlyPicked(true)} className={chip(onlyPicked)}>
                In it ({picked.length})
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-muted">
              {dishes.length === 0 ? "No dishes on the menu yet." : onlyPicked && !q ? "No dishes in it yet. Tick some under All dishes." : "No dish matches."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {shown.map((d) => {
                const on = picked.includes(d.id);
                const inSub = subs.find((s) => d.categoryIds.includes(s.id));
                return (
                  <li key={d.id} className="flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl py-2.5 pr-2 hover:bg-paper">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setPicked((p) => (on ? p.filter((id) => id !== d.id) : [...p, d.id]))}
                        className="ml-1 h-5 w-5 shrink-0 cursor-pointer accent-forest"
                      />
                      {d.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.imageUrl}
                          alt=""
                          className={`h-12 w-12 shrink-0 rounded-xl object-cover ${d.available ? "" : "grayscale"}`}
                        />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded-xl bg-wash" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{d.name}</span>
                        <span className="block truncate text-[14px] text-muted">
                          {inSub && <span className="font-semibold text-leaf">{inSub.name} · </span>}
                          {d.shortDescription}
                          {!d.available && <span className="hidden font-semibold text-chili sm:inline"> · Not today</span>}
                        </span>
                        <span className="block text-[14px] font-semibold text-forest sm:hidden">
                          {formatPrice(d.priceCents)}
                          {!d.available && <span className="text-chili"> · Not today</span>}
                        </span>
                      </span>
                      <span className="hidden shrink-0 font-display text-[16px] font-bold sm:block">{formatPrice(d.priceCents)}</span>
                    </label>
                    <Link
                      href={`/admin/menu/${d.id}`}
                      aria-label={`Edit ${d.name}`}
                      title="Edit dish"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
                    >
                      <ArrowUpRight width={18} height={18} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      {dialog}
    </form>
  );
}
