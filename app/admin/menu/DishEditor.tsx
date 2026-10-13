"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminCategory, AdminDish, DishInput } from "@/lib/menu-admin";
import { formatPrice, servesLabel } from "@/lib/format";
import {
  ChevronLeft,
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
  spiceLevel: 0,
  servesMin: 1,
  servesMax: 1,
  available: true,
  featured: false,
  bestSeller: false,
  isNew: true,
  categoryIds: [],
  ingredients: [],
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
}: {
  dish: AdminDish | null;
  categories: AdminCategory[];
  /** Another dish that is the hero now, which picking this one would replace. */
  currentHero: string | null;
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
  const dirty = JSON.stringify(x) !== JSON.stringify(start.current) || price !== (dish ? String(dish.priceCents / 100) : "");

  // Leaving with unsaved changes asks first (reload, close, or typing a URL).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!done.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const upload = async (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) return setError("That file isn't a photo. Use a JPG, PNG or WebP.");
    if (file.size > MAX_PHOTO) return setError("That photo is over 10 MB. Use a smaller one.");
    setUploading(true);
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
      set("imageUrl", j.secure_url.replace("/upload/", "/upload/f_auto,q_auto/"));
    } catch (e) {
      setError(e instanceof TypeError ? "No connection. Check the internet and try again." : (e as Error).message);
    }
    setUploading(false);
  };

  const save = async () => {
    const pesos = Number(price.replace(/[₱,\s]/g, ""));
    if (!Number.isFinite(pesos) || pesos < 0 || price.trim() === "") return setError("Enter a price.");
    setBusy(true);
    setError("");
    const body = { ...x, priceCents: Math.round(pesos * 100) };
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
          <section className={card}>
            <h2 className="font-display text-[19px] font-bold">Photo</h2>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) upload(f);
              }}
              className={`relative mt-3 aspect-[4/3] overflow-hidden rounded-2xl ${
                dragOver ? "ring-2 ring-leaf ring-offset-2" : ""
              } ${x.imageUrl ? "bg-wash" : "border-2 border-dashed border-line bg-paper"}`}
            >
              {x.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.imageUrl} alt="" className={`h-full w-full object-cover ${x.available ? "" : "grayscale"}`} />
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 grid place-items-center text-center text-muted"
                >
                  <span>
                    <ImageIcon width={36} height={36} className="mx-auto" />
                    <span className="mt-2 block text-[14px] font-semibold text-ink">Upload a photo</span>
                    <span className="block text-[13px]">or drop one here</span>
                  </span>
                </button>
              )}
              {uploading && (
                <div className="absolute inset-0 grid place-items-center bg-white/80 text-[15px] font-semibold text-forest" role="status">
                  Uploading…
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            {x.imageUrl && (
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${btn.secondary} h-10 flex-1`}>
                  Replace photo
                </button>
                <button type="button" disabled={uploading} onClick={() => set("imageUrl", null)} className={`${btn.danger} h-10`}>
                  Remove
                </button>
              </div>
            )}
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

          <Preview x={x} price={price} />

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

/** The dish as a guest sees it in the menu grid, updating as you type. */
function Preview({ x, price }: { x: DishInput; price: string }) {
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
    </section>
  );
}
