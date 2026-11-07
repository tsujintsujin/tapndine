"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_PHOTOS, type AdminCategory, type AdminDish, type DishInput } from "@/lib/menu-admin";
import { randomId } from "@/lib/ids";
import { OPTION_KINDS, sizeTitle, type DishOption, type OptionKind } from "@/lib/options";
import { formatPrice, servesLabel } from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  ChiliIcon,
  CloseIcon,
  ImageIcon,
  INGREDIENT_ICONS,
  INGREDIENT_LABELS,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@/app/components/Icons";
import { btn, card, PageHead } from "../kit";
import { api, useConfirm } from "../ui";
import { Switch } from "./MenuBoard";

const EMPTY: DishInput = {
  name: "",
  shortDescription: "",
  description: "",
  priceCents: 0,
  imageUrl: null,
  moreImages: [],
  spiceLevel: 0,
  servesMin: 1,
  servesMax: 1,
  available: true,
  featured: false,
  bestSeller: false,
  isNew: true,
  categoryIds: [],
  ingredients: [],
  options: [],
  sizeRequired: true,
  sizeLabel: null,
};
const KINDS = Object.keys(INGREDIENT_LABELS);
const MAX_PHOTO = 10 * 1024 * 1024; // Cloudinary's free-plan limit per image

const field =
  "mt-1.5 block w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const label = "block text-[14px] font-semibold";

/** Adds a dish (dish null) or edits one. Everything a guest sees about it, in one form. */
export default function DishEditor({
  dish,
  categories,
  currentHero,
  menu,
}: {
  dish: AdminDish | null;
  categories: AdminCategory[];
  /** Another dish that is the hero now, which picking this one would replace. */
  currentHero: string | null;
  /** Every dish on the menu, for set meal choices. */
  menu: MenuPick[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const start = useRef<DishInput>(dish ? { ...dish } : EMPTY);
  const [x, setX] = useState<DishInput>(start.current);
  const [price, setPrice] = useState(dish ? String(dish.priceCents / 100) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  const set = <K extends keyof DishInput>(k: K, v: DishInput[K]) => setX((p) => ({ ...p, [k]: v }));
  // Options as typed; x.options is only filled in on Save.
  const startOpts = useRef({
    rows: (dish?.options ?? []).map<OptRow>((o) => ({
      id: o.id,
      kind: o.kind,
      gid: o.group ?? "",
      ref: o.ref ?? "",
      group: o.group ?? "",
      name: o.name,
      price: o.priceCents ? String(o.priceCents / 100) : "",
    })),
    on: Object.fromEntries(OPTION_KINDS.map((k) => [k, !!dish?.options.some((o) => o.kind === k)])) as OptsOn,
  });
  const [optRows, setOptRows] = useState(startOpts.current.rows);
  const [optOn, setOptOn] = useState(startOpts.current.on);
  const dirty =
    JSON.stringify(x) !== JSON.stringify(start.current) ||
    price !== (dish ? String(dish.priceCents / 100) : "") ||
    JSON.stringify([optRows, optOn]) !== JSON.stringify([startOpts.current.rows, startOpts.current.on]);

  // Leaving with unsaved changes asks first (reload, close, or typing a URL).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!done.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The cover is imageUrl; the rest are moreImages. Edited as one list.
  const photos = [x.imageUrl, ...x.moreImages].filter((u): u is string => !!u);
  const setPhotos = (f: (list: string[]) => string[]) =>
    setX((p) => {
      const list = f([p.imageUrl, ...p.moreImages].filter((u): u is string => !!u));
      return { ...p, imageUrl: list[0] ?? null, moreImages: list.slice(1) };
    });
  /** Swaps photo i with the one after it. */
  const swap = (i: number) => setPhotos((l) => l.map((u, n) => (n === i ? l[i + 1] : n === i + 1 ? l[i] : u)));

  const uploadAll = async (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    if (!files.length || room <= 0) return;
    setError("");
    for (const f of files.slice(0, room)) if (!(await upload(f))) return;
    if (files.length > room) setError(`Up to ${MAX_PHOTOS} photos. Only the first ${room === 1 ? "one was" : `${room} were`} added.`);
  };

  const upload = async (file: File): Promise<boolean> => {
    if (!file.type.startsWith("image/")) return (setError("That file isn't a photo. Use a JPG, PNG or WebP."), false);
    if (file.size > MAX_PHOTO) return (setError("That photo is over 10 MB. Use a smaller one."), false);
    setUploading(true);
    let ok = false;
    try {
      const s = await api<{ url: string; apiKey: string; timestamp: number; signature: string; folder: string }>(
        "/api/staff/menu/upload",
        { method: "POST", body: {} }
      );
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", s.apiKey);
      form.append("timestamp", String(s.timestamp));
      form.append("signature", s.signature);
      form.append("folder", s.folder);
      const r = await fetch(s.url, { method: "POST", body: form });
      const j = (await r.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
      if (!r.ok || !j.secure_url) throw new Error(j.error?.message ?? "The photo didn't upload. Try again.");
      // Same delivery as the other photos: best format and quality per phone.
      const url = j.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
      setPhotos((l) => [...l, url].slice(0, MAX_PHOTOS));
      ok = true;
    } catch (e) {
      setError(e instanceof TypeError ? "No connection. Check the internet and try again." : (e as Error).message);
    }
    setUploading(false);
    return ok;
  };

  const save = async () => {
    const pesos = Number(price.replace(/[₱,\s]/g, ""));
    if (!Number.isFinite(pesos) || pesos < 0 || price.trim() === "") return setError("Enter a price.");
    // A set switched off saves no options; a row without a name is skipped.
    const options: DishOption[] = [];
    for (const r of optRows) {
      if (!optOn[r.kind] || !r.name.trim() || (r.kind === "choice" && !r.ref)) continue;
      const add = r.price.trim() === "" ? 0 : Number(r.price.replace(/[₱,\s]/g, ""));
      if (!Number.isFinite(add) || add < 0) return setError(`Check the price of ${r.name.trim()}.`);
      const group = r.kind === "choice" ? r.group.trim() : null;
      if (group === "") return setError(`Give the list with ${r.name.trim()} a name, like Drink.`);
      options.push({ id: r.id, kind: r.kind, group, ref: r.kind === "choice" ? r.ref : null, name: r.name, priceCents: Math.round(add * 100) });
    }
    setBusy(true);
    setError("");
    const body = { ...x, priceCents: Math.round(pesos * 100), options };
    try {
      if (dish) await api(`/api/staff/menu/dishes/${dish.id}`, { method: "PUT", body });
      else await api("/api/staff/menu/dishes", { method: "POST", body });
      done.current = true;
      // The menu page shows "<name> changes saved" once it opens.
      try {
        sessionStorage.setItem("dish-saved", x.name);
      } catch {}
      router.push("/admin/menu");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!dish) return;
    const ok = await confirm({
      title: `Remove ${dish.name}?`,
      body: "It comes off the guests' menu for good. Past orders and statistics keep it. To hide it for today only, switch off Available today instead.",
      confirmLabel: "Remove dish",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/staff/menu/dishes/${dish.id}`, { method: "DELETE" });
      done.current = true;
      router.push("/admin/menu");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const back = (
    <Link href="/admin/menu" className="inline-flex h-9 items-center gap-1 rounded-full pr-3 text-[14px] font-semibold text-muted hover:text-ink">
      <ChevronLeft width={18} height={18} />
      Menu
    </Link>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {back}
      <PageHead title={dish ? dish.name || "Untitled dish" : "New dish"}>
        <Link href="/admin/menu" className={btn.secondary}>
          Cancel
        </Link>
        <button type="submit" disabled={busy || uploading} className={btn.primary}>
          {busy ? "Saving…" : dish ? "Save changes" : "Add dish"}
        </button>
      </PageHead>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className={card}>
            <h2 className="font-display text-[19px] font-bold">Name and price</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className={label}>
                Name
                <input
                  required
                  maxLength={60}
                  value={x.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={`${field} h-12`}
                  placeholder="Kare-Kare"
                />
              </label>
              <label className={label}>
                Price
                <span className="relative mt-1.5 block">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">₱</span>
                  <input
                    required
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`${field} mt-0 h-12 pl-8 tabular-nums`}
                    placeholder="495"
                  />
                </span>
              </label>
            </div>
            <label className={`${label} mt-4`}>
              One-line description
              <input
                required
                maxLength={80}
                value={x.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                className={`${field} h-12`}
                placeholder="Oxtail in peanut sauce"
              />
              <span className="mt-1 flex justify-between text-[13px] font-normal text-muted">
                <span>Shown under the name on the menu</span>
                <span className="tabular-nums">{x.shortDescription.length}/80</span>
              </span>
            </label>
            <label className={`${label} mt-4`}>
              Full description
              <textarea
                maxLength={600}
                rows={4}
                value={x.description}
                onChange={(e) => set("description", e.target.value)}
                className={`${field} py-3 leading-relaxed`}
                placeholder="What it is, how it's cooked, what it comes with."
              />
              <span className="mt-1 flex justify-between text-[13px] font-normal text-muted">
                <span>Shown when a guest opens the dish</span>
                <span className="tabular-nums">{x.description.length}/600</span>
              </span>
            </label>
          </section>

          <section className={card}>
            <h2 className="font-display text-[19px] font-bold">Categories</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              A dish can sit in several.{" "}
              <Link href="/admin/categories" className="font-semibold text-leaf hover:underline">
                Manage categories
              </Link>
            </p>
            {categories.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">No categories yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = x.categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set("categoryIds", on ? x.categoryIds.filter((i) => i !== c.id) : [...x.categoryIds, c.id])
                      }
                      className={`h-10 rounded-full px-4 text-[14px] font-semibold ${
                        on ? "bg-forest text-white" : "border border-line bg-white text-ink hover:border-forest"
                      }`}
                    >
                      {c.parentId && `${categories.find((p) => p.id === c.parentId)?.name} › `}
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="font-display text-[19px] font-bold">Ingredients</h2>
            <p className="mt-0.5 text-[13px] text-muted">The icon tells guests at a glance what&apos;s in it.</p>
            <ul className="mt-3 space-y-2">
              {x.ingredients.map((ing, i) => {
                const update = (patch: Partial<typeof ing>) =>
                  set("ingredients", x.ingredients.map((v, j) => (j === i ? { ...v, ...patch } : v)));
                return (
                  <li key={i} className="flex items-center gap-2">
                    <KindPicker kind={ing.kind} onPick={(kind) => update({ kind })} />
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Ingredient</span>
                      <input
                        maxLength={40}
                        value={ing.name}
                        onChange={(e) => update({ name: e.target.value })}
                        placeholder="Oxtail"
                        className={`${field} mt-0 h-11`}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${ing.name || "ingredient"}`}
                      onClick={() => set("ingredients", x.ingredients.filter((_, j) => j !== i))}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-chili/10 hover:text-chili"
                    >
                      <CloseIcon width={18} height={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {x.ingredients.length < 20 && (
              <button
                type="button"
                onClick={() => set("ingredients", [...x.ingredients, { name: "", kind: "vegetable" }])}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-leaf hover:bg-leaf-tint"
              >
                <PlusIcon width={18} height={18} />
                Add ingredient
              </button>
            )}
          </section>

          <OptionsCard
            rows={optRows}
            on={optOn}
            sizeRequired={x.sizeRequired}
            sizeLabel={x.sizeLabel ?? ""}
            spiceLevel={x.spiceLevel}
            onRows={setOptRows}
            onOn={setOptOn}
            onSizeRequired={(v) => set("sizeRequired", v)}
            onSizeLabel={(v) => set("sizeLabel", v || null)}
            menu={menu.filter((m) => m.id !== dish?.id)}
          />

          <section className={card}>
            <h2 className="font-display text-[19px] font-bold">Spice and portion</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <fieldset>
                <legend className={label}>Spice level</legend>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const lit = x.spiceLevel !== null && n <= x.spiceLevel;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} of 5`}
                        aria-pressed={x.spiceLevel === n}
                        onClick={() => set("spiceLevel", x.spiceLevel === n ? 0 : n)}
                        className={`grid h-10 w-10 place-items-center rounded-full hover:bg-chili/10 ${lit ? "text-chili" : "text-line"}`}
                      >
                        <ChiliIcon lit={lit} width={24} height={24} />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-1.5 text-[13px]">
                  {[
                    { v: 0 as number | null, t: "Not spicy" },
                    { v: null, t: "Doesn't apply (drinks)" },
                  ].map((o) => (
                    <button
                      key={String(o.v)}
                      type="button"
                      aria-pressed={x.spiceLevel === o.v}
                      onClick={() => set("spiceLevel", o.v)}
                      className={`h-8 rounded-full px-3 font-semibold ${
                        x.spiceLevel === o.v ? "bg-forest text-white" : "bg-paper text-muted hover:text-ink"
                      }`}
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className={label}>Serves</legend>
                <div className="mt-2 flex items-center gap-3">
                  <Stepper
                    label="From"
                    value={x.servesMin}
                    min={1}
                    max={x.servesMax}
                    onChange={(v) => set("servesMin", v)}
                  />
                  <span className="text-muted">to</span>
                  <Stepper
                    label="Up to"
                    value={x.servesMax}
                    min={x.servesMin}
                    max={30}
                    onChange={(v) => set("servesMax", v)}
                  />
                </div>
                <p className="mt-2 text-[13px] text-muted">Guests see &ldquo;{servesLabel(x.servesMin, x.servesMax)}&rdquo;</p>
              </fieldset>
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <section
            className={`${card} ${dragOver ? "ring-2 ring-leaf" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!uploading) uploadAll([...e.dataTransfer.files]);
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-[19px] font-bold">Photos</h2>
              <span className="text-[13px] text-muted">
                {photos.length} of {MAX_PHOTOS}
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((u, i) => (
                <li key={u}>
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-wash">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} className={`h-full w-full object-cover ${x.available ? "" : "grayscale"}`} />
                    {i === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-forest">Cover</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {/* Swapping neighbours left or right reaches every order. */}
                    {photos.length > 1 && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => swap(i === 0 ? 0 : i - 1)}
                        aria-label={i === 0 ? "Move cover photo right" : i === 1 ? "Make photo 2 the cover" : `Move photo ${i + 1} left`}
                        className="grid h-11 min-w-0 flex-1 place-items-center rounded-full border border-forest/80 bg-white text-forest hover:bg-leaf-tint disabled:opacity-60"
                      >
                        {i === 0 ? <ChevronRight width={18} height={18} /> : <ChevronLeft width={18} height={18} />}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => setPhotos((l) => l.filter((_, n) => n !== i))}
                      aria-label={i === 0 ? "Remove cover photo" : `Remove photo ${i + 1}`}
                      className={`grid h-11 shrink-0 place-items-center rounded-full text-chili hover:bg-chili/10 disabled:opacity-60 ${photos.length > 1 ? "w-11" : "flex-1"}`}
                    >
                      <TrashIcon width={17} height={17} />
                    </button>
                  </div>
                </li>
              ))}
              {photos.length < MAX_PHOTOS && (
                <li>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="relative grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-line bg-paper text-center text-muted hover:border-leaf/60"
                  >
                    {uploading ? (
                      <span className="text-[13px] font-semibold text-forest" role="status">
                        Uploading…
                      </span>
                    ) : (
                      <span>
                        <ImageIcon width={26} height={26} className="mx-auto" />
                        <span className="mt-1 block text-[13px] font-semibold text-ink">Add photo</span>
                      </span>
                    )}
                  </button>
                </li>
              )}
            </ul>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                uploadAll([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <p className="mt-3 text-[13px] text-muted">
              Guests swipe through these on the dish. The cover also shows on the menu, the home page and your dashboard. Drop photos here or tap Add photo.
            </p>
          </section>

          <section className={card}>
            <h2 className="font-display text-[19px] font-bold">On the menu</h2>
            <ul className="mt-2 divide-y divide-line">
              <Toggle
                on={x.available}
                onChange={() => set("available", !x.available)}
                title="Available today"
                note={x.available ? "Guests can order it" : "Guests see “Not Available Today”"}
              />
              <Toggle
                on={x.featured}
                onChange={() => set("featured", !x.featured)}
                title="Hero"
                note={x.featured && currentHero ? `Replaces ${currentHero} at the top of the menu home` : "The big photo at the top of the menu home"}
              />
              <Toggle
                on={x.bestSeller}
                onChange={() => set("bestSeller", !x.bestSeller)}
                title="Featured"
                note="In the Featured dishes row on the menu home"
              />
              <Toggle
                on={x.isNew}
                onChange={() => set("isNew", !x.isNew)}
                title="New"
                note="Marked New, and in the New on the menu row"
              />
            </ul>
          </section>

          <Preview x={x} price={price} rows={optRows.filter((r) => optOn[r.kind] && r.name.trim())} />

          {dish && (
            <button type="button" disabled={busy} onClick={remove} className={`${btn.danger} w-full`}>
              <TrashIcon width={18} height={18} />
              Remove dish from the menu
            </button>
          )}
        </div>
      </div>
      {dialog}
    </form>
  );
}

/** The ingredient's icon; pressing it opens every icon with its name to pick another. */
function KindPicker({ kind, onPick }: { kind: string; onPick: (kind: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const Icon = INGREDIENT_ICONS[kind];

  // A press anywhere else, or Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      box.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Icon: ${INGREDIENT_LABELS[kind] ?? kind}. Change`}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-11 w-11 place-items-center rounded-xl bg-paper text-forest hover:bg-leaf-tint ${open ? "ring-2 ring-leaf/40" : ""}`}
      >
        {Icon && <Icon width={22} height={22} />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 grid w-[min(19rem,calc(100vw-72px))] grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-2 shadow-[0_12px_32px_rgb(16_52_42/0.16)]"
        >
          {KINDS.map((k) => {
            const KIcon = INGREDIENT_ICONS[k];
            const on = k === kind;
            return (
              <button
                key={k}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  onPick(k);
                  setOpen(false);
                }}
                className={`flex h-11 items-center gap-2.5 rounded-xl px-2.5 text-left text-[14px] font-semibold ${
                  on ? "bg-leaf-tint text-forest" : "text-ink hover:bg-paper"
                }`}
              >
                <KIcon width={20} height={20} className="shrink-0 text-forest" />
                <span className="truncate">{INGREDIENT_LABELS[k]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, title, note }: { on: boolean; onChange: () => void; title: string; note: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-muted">{note}</span>
      </span>
      <Switch on={on} label={title} onChange={onChange} />
    </li>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const b = "grid h-10 w-10 place-items-center rounded-full text-forest hover:bg-leaf-tint disabled:opacity-30";
  return (
    <span className="flex items-center rounded-full border border-line bg-white" role="group" aria-label={label}>
      <button type="button" aria-label={`${label}: fewer`} disabled={value <= min} onClick={() => onChange(value - 1)} className={b}>
        <MinusIcon width={18} height={18} />
      </button>
      <span className="w-7 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`${label}: more`} disabled={value >= max} onClick={() => onChange(value + 1)} className={b}>
        <PlusIcon width={18} height={18} />
      </button>
    </span>
  );
}

/** The dish as a guest sees it in the menu grid, updating as you type, with its options under it. */
function Preview({ x, price, rows }: { x: DishInput; price: string; rows: OptRow[] }) {
  const sizes = rows.filter((r) => r.kind === "size");
  const lists = [...new Set(rows.filter((r) => r.kind === "choice").map((r) => r.gid))].map((gid) => {
    const items = rows.filter((r) => r.kind === "choice" && r.gid === gid);
    return { gid, name: items[0].group.trim() || "List", items };
  });
  const locked = (sizes.length > 0 && x.sizeRequired) || lists.length > 0;
  const sizesTitle = sizeTitle(x);
  const extras = rows.filter((r) => r.kind === "addon" || (r.kind === "spice" && (x.spiceLevel ?? 0) > 0));
  const extrasTitle = [
    rows.some((r) => r.kind === "addon") && "Add-ons",
    extras.some((r) => r.kind === "spice") && "spice",
  ]
    .filter(Boolean)
    .join(" and ");
  const cents = Math.round(Number(price.replace(/[₱,\s]/g, "")) * 100);
  return (
    <section className={card}>
      <h2 className="font-display text-[19px] font-bold">How guests see it</h2>
      {/* In the guests' own colours, not the dashboard's. */}
      <div className="theme-warm mx-auto mt-3 w-44 text-ink">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-wash">
          {x.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={x.imageUrl} alt="" className={`h-full w-full object-cover ${x.available ? "" : "grayscale opacity-60"}`} />
          )}
          {!x.available && (
            <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2 py-0.5 text-[11px] font-medium text-white">
              Not Available Today
            </span>
          )}
          {x.isNew && x.available && (
            <span className="absolute left-2 top-2 rounded-full bg-mango px-2 py-0.5 text-[11px] font-semibold text-ink">New</span>
          )}
        </div>
        <p className="mt-2 truncate font-display font-bold">{x.name || "Dish name"}</p>
        <p className="flex justify-between text-[13px]">
          <span className="font-semibold text-leaf">{Number.isFinite(cents) && price ? formatPrice(cents) : "₱–"}</span>
          <span className="text-muted">{servesLabel(x.servesMin, x.servesMax)}</span>
        </p>
      </div>
      {sizes.length + lists.length + extras.length > 0 && (
        <div className="theme-warm mt-4 rounded-2xl bg-paper p-3 text-[14px] text-ink">
          {sizes.length > 0 && (
            <>
              <p className="flex items-center justify-between font-bold">
                {sizesTitle}
                {x.sizeRequired && <span className="rounded-full bg-mango px-2 py-0.5 text-[11px] text-forest">Required</span>}
              </p>
              <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                {sizes.map((r, i) => {
                  const on = !x.sizeRequired && i === 0;
                  return (
                    <li key={i} className={`flex items-center gap-2 px-2.5 py-2 ${on ? "bg-leaf-tint" : ""}`}>
                      <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-leaf bg-leaf" : "border-muted/50"}`} />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      {r.price && Number(r.price) > 0 && <span className="text-muted">+₱{r.price}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {lists.map((l) => (
            <div key={l.gid} className="mt-2">
              <p className="flex items-center justify-between font-bold">
                {l.name}
                <span className="rounded-full bg-mango px-2 py-0.5 text-[11px] text-forest">Required</span>
              </p>
              <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                {l.items.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 px-2.5 py-2">
                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted/50" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    {r.price && Number(r.price) > 0 && <span className="text-muted">+₱{r.price}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {extras.length > 0 && (
            <p className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2 font-semibold">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-leaf-tint">
                <PlusIcon width={12} height={12} />
              </span>
              {extrasTitle.charAt(0).toUpperCase() + extrasTitle.slice(1)}
            </p>
          )}
          <p
            className={`mt-2 grid h-10 place-items-center rounded-lg font-semibold ${
              locked ? "bg-wash text-muted" : "bg-leaf text-white"
            }`}
          >
            {!locked ? "Add to order" : `Choose a ${(sizes.length && x.sizeRequired ? sizesTitle : lists[0].name).toLowerCase()}`}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * An option row as typed: the price stays text until Save, so "1." or "" don't jump around.
 * For a choose-one list, gid ties a row to its list while the list's name is retyped.
 */
type OptRow = { id: string; kind: OptionKind; gid: string; group: string; ref: string; name: string; price: string };
/** A menu dish offered as a set meal choice. */
type MenuPick = { id: string; name: string; priceCents: number; available: boolean };
type OptsOn = Record<OptionKind, boolean>;

const SETS: Record<OptionKind, { title: string; help: string; add: string; placeholder: string }> = {
  size: { title: "Sizes", help: "Guest picks one size.", add: "Add size", placeholder: "Sharing" },
  choice: {
    title: "Set meal choices",
    help: "Lists of dishes from your menu; the guest picks one from each, like a drink with the meal.",
    add: "Add choice",
    placeholder: "Iced tea",
  },
  addon: { title: "Add-ons", help: "Extras the guest can tick, as many as they like.", add: "Add add-on", placeholder: "Extra egg" },
  spice: { title: "Spice choices", help: "Less or extra spicy. Only shown on dishes with a spice level.", add: "Add choice", placeholder: "Less spicy" },
};

const MAX_LISTS = 5;

/** Sizes, set meal lists, add-ons and spice choices for this dish: each switched on only when the dish needs it. */
function OptionsCard({
  rows,
  on,
  sizeRequired,
  sizeLabel,
  spiceLevel,
  onRows,
  onOn,
  onSizeRequired,
  onSizeLabel,
  menu,
}: {
  rows: OptRow[];
  on: OptsOn;
  sizeRequired: boolean;
  /** What the sizes are called, as typed; "" is "Size". */
  sizeLabel: string;
  spiceLevel: number | null;
  onRows: (rows: OptRow[]) => void;
  onOn: (on: OptsOn) => void;
  onSizeRequired: (v: boolean) => void;
  onSizeLabel: (v: string) => void;
  menu: MenuPick[];
}) {
  const sizeWord = sizeTitle({ sizeLabel }).toLowerCase();
  const seg = (active: boolean) =>
    `flex h-9 min-w-[52px] items-center justify-center rounded-full px-3.5 text-[14px] font-semibold ${
      active ? "bg-forest text-white" : "text-muted hover:text-ink"
    }`;
  const update = (row: OptRow, patch: Partial<OptRow>) => onRows(rows.map((r) => (r === row ? { ...r, ...patch } : r)));
  const newRow = (kind: OptionKind, gid = "", group = ""): OptRow => ({ id: "", kind, gid, group, ref: "", name: "", price: "" });
  const newList = () => newRow("choice", randomId(), "");

  /** Name, "+₱" price and remove, one line per choice. */
  const rowList = (mine: OptRow[], placeholder: string, label: string) => (
    <ul className="mt-3 space-y-2">
      {mine.map((r, i) => (
        // On a phone a set meal choice's dish gets the whole line, its price under it.
        <li key={i} className={`flex items-center gap-1.5 sm:gap-2 ${r.kind === "choice" ? "flex-wrap sm:flex-nowrap" : ""}`}>
          <label className={`min-w-0 flex-1 ${r.kind === "choice" ? "basis-full sm:basis-0" : ""}`}>
            <span className="sr-only">{label}: {r.kind === "choice" ? "dish" : "name"}</span>
            {r.kind === "choice" ? (
              // A set meal choice is a dish already on the menu; the price beside it is the combo price.
              <select
                value={r.ref}
                onChange={(e) => update(r, { ref: e.target.value, name: menu.find((m) => m.id === e.target.value)?.name ?? "" })}
                autoFocus={!r.id && !r.ref && i === mine.length - 1 && !!r.group}
                className={`${field} mt-0 h-11 pr-8 ${r.ref ? "" : "text-muted"}`}
              >
                <option value="">Pick a dish</option>
                {menu.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {formatPrice(m.priceCents)}
                    {m.available ? "" : " (sold out today)"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                maxLength={40}
                value={r.name}
                onChange={(e) => update(r, { name: e.target.value })}
                placeholder={placeholder}
                // A row just added is ready to type in.
                autoFocus={!r.id && !r.name && i === mine.length - 1}
                className={`${field} mt-0 h-11`}
              />
            )}
          </label>
          <label className="relative block w-[84px] shrink-0 sm:w-36">
            <span className="sr-only">{r.name || label}: adds to the price</span>
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">+₱</span>
            <input
              inputMode="decimal"
              value={r.price}
              onChange={(e) => update(r, { price: e.target.value })}
              placeholder="0"
              className={`${field} mt-0 h-11 pl-8 pr-2 tabular-nums`}
            />
          </label>
          <button
            type="button"
            aria-label={`Remove ${r.name || "choice"}`}
            onClick={() => onRows(rows.filter((x) => x !== r))}
            className="-mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-chili/10 hover:text-chili sm:mr-0"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </li>
      ))}
    </ul>
  );
  const addButton = (text: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-leaf hover:bg-leaf-tint"
    >
      <PlusIcon width={18} height={18} />
      {text}
    </button>
  );

  return (
    <section className={card}>
      <h2 className="font-display text-[19px] font-bold">Options</h2>
      <p className="mt-0.5 text-[13px] text-muted">
        All off to start. Switch on only what this dish needs. Prices are what each choice adds to the dish&apos;s price.
      </p>
      <div className="mt-3 space-y-3">
        {OPTION_KINDS.map((kind) => {
          const set = SETS[kind];
          const mine = rows.filter((r) => r.kind === kind);
          const lists = [...new Set(mine.map((r) => r.gid))];
          return (
            <div key={kind} className="rounded-2xl border border-line bg-paper p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{set.title}</span>
                  <span className="block text-[13px] text-muted">{set.help}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold">
                  {on[kind] ? "On" : "Off"}
                  <Switch
                    on={on[kind]}
                    label={set.title}
                    onChange={() => {
                      onOn({ ...on, [kind]: !on[kind] });
                      // Switching on an empty set starts it with a row to type in;
                      // switching off drops rows left empty, so nothing counts as changed.
                      if (!on[kind] && mine.length === 0) onRows([...rows, kind === "choice" ? newList() : newRow(kind)]);
                      if (on[kind]) onRows(rows.filter((r) => r.kind !== kind || r.name.trim()));
                    }}
                  />
                </span>
              </div>
              {on[kind] && kind === "choice" && (
                <>
                  {lists.map((gid) => {
                    const items = mine.filter((r) => r.gid === gid);
                    const name = items[0]?.group ?? "";
                    return (
                      <div key={gid} className="mt-3 rounded-xl bg-white p-3">
                        <label className="block text-[14px] font-semibold">
                          List name
                          <input
                            maxLength={30}
                            value={name}
                            onChange={(e) => onRows(rows.map((r) => (r.gid === gid && r.kind === "choice" ? { ...r, group: e.target.value } : r)))}
                            placeholder="Drink"
                            autoFocus={!name && items.every((r) => !r.id && !r.name)}
                            className={`${field} h-11`}
                          />
                        </label>
                        <p className="mt-1 text-[13px] text-muted">The guest must pick one. The price beside each is what it adds in this meal.</p>
                        {rowList(items, set.placeholder, name || "Choice")}
                        {items.length < 20 && addButton(set.add, () => onRows([...rows, newRow("choice", gid, name)]))}
                      </div>
                    );
                  })}
                  {lists.length < MAX_LISTS && addButton("Add another list", () => onRows([...rows, newList()]))}
                </>
              )}
              {on[kind] && kind !== "choice" && (
                <>
                  {kind === "spice" && !spiceLevel && (
                    <p className="mt-3 rounded-xl bg-mango-soft px-3 py-2 text-[13px]">
                      This dish has no spice level, so guests won&apos;t see these. Set one under Spice and portion.
                    </p>
                  )}
                  {kind === "size" && (
                    <label className="mt-3 block rounded-xl bg-white px-3 py-2.5 text-[14px] font-semibold">
                      Called
                      <input
                        maxLength={20}
                        value={sizeLabel}
                        onChange={(e) => onSizeLabel(e.target.value)}
                        placeholder="Size"
                        className={`${field} h-11 sm:max-w-xs`}
                      />
                      <span className="mt-1 block text-[13px] font-normal text-muted">
                        The heading guests see. Leave it as Size, or name what they pick: Meat, Flavor.
                      </span>
                    </label>
                  )}
                  {kind === "size" && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
                      <span className="min-w-0 text-[14px]">
                        <span className="block font-semibold">Guest must pick a {sizeWord}</span>
                        <span className="block text-[13px] text-muted">
                          {sizeRequired ? "Add stays locked until they pick." : `The first ${sizeWord} is picked for them; they can change it.`}
                        </span>
                      </span>
                      <span role="group" aria-label={`Guest must pick a ${sizeWord}`} className="flex shrink-0 rounded-full bg-paper p-1">
                        <button type="button" aria-pressed={sizeRequired} onClick={() => onSizeRequired(true)} className={seg(sizeRequired)}>
                          Yes
                        </button>
                        <button type="button" aria-pressed={!sizeRequired} onClick={() => onSizeRequired(false)} className={seg(!sizeRequired)}>
                          No
                        </button>
                      </span>
                    </div>
                  )}
                  {rowList(mine, set.placeholder, set.title)}
                  {mine.length < 20 && addButton(set.add, () => onRows([...rows, newRow(kind)]))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
