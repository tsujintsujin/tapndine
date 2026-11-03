"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import { formatPrice } from "@/lib/format";
import { CloseIcon, EyeIcon, PlusIcon, SearchIcon } from "@/app/components/Icons";
import { btn, card, PageHead } from "../kit";
import { api } from "../ui";

export type HomeDish = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  available: boolean;
  featured: boolean;
  bestSeller: boolean;
  isNew: boolean;
};

/** What the menu home shows. `hero` null: the first dish on the menu. */
type Home = { hero: string | null; featured: string[]; fresh: string[] };
type Part = keyof Home;

const PREVIEW_URL = `${BASE_PATH}/m/preview`;
/** Where the preview opens after a change, so the manager sees it land (the ids MenuApp's rows carry). */
const SPOT: Record<Part, string> = { hero: "", featured: "&row=row-featured", fresh: "&row=row-new" };

/**
 * The manager's say over the menu home: the hero, and the dishes in the
 * Featured and New rows, beside a phone-sized preview of the real menu. Every
 * change saves straight away, then the preview reloads at what changed.
 */
export default function HomepageEditor({ dishes }: { dishes: HomeDish[] }) {
  const [home, setHome] = useState<Home>(() => ({
    hero: dishes.find((d) => d.featured)?.id ?? null,
    featured: dishes.filter((d) => d.bestSeller).map((d) => d.id),
    fresh: dishes.filter((d) => d.isNew).map((d) => d.id),
  }));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [picking, setPicking] = useState<Part | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const wide = useWide();
  const frame = useRef<HTMLIFrameElement>(null);
  const loads = useRef(0);

  useEffect(() => {
    if (status !== "Saved") return;
    const t = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const save = async (next: Home, part: Part) => {
    const before = home;
    setHome(next);
    setBusy(true);
    setError("");
    setStatus("Saving…");
    try {
      await api("/api/staff/homepage", { method: "POST", body: next });
      setStatus("Saved");
      // A new address, not a reload: a reload would put the preview back where it was scrolled.
      frame.current?.contentWindow?.location.replace(`${PREVIEW_URL}?at=${++loads.current}${SPOT[part]}`);
    } catch (e) {
      setHome(before);
      setStatus("");
      setError((e as Error).message);
    }
    setBusy(false);
  };

  if (!dishes.length) {
    return (
      <>
        <PageHead title="Homepage" sub="What guests see first when they open your menu." />
        <section className={`${card} mt-6`}>
          <h2 className="font-display text-[19px] font-bold">No dishes yet</h2>
          <p className="mt-1 text-[15px] text-muted">Add your dishes first, then pick which ones the menu home shows.</p>
          <Link href="/admin/menu" className={`${btn.primary} mt-4`}>
            Go to Menu
          </Link>
        </section>
      </>
    );
  }

  const byId = new Map(dishes.map((d) => [d.id, d]));
  // Guests see the rows in menu order; so does the manager.
  const inOrder = (ids: string[]) => dishes.filter((d) => ids.includes(d.id));
  const heroDish = (home.hero && byId.get(home.hero)) || dishes[0];
  const remove = (part: "featured" | "fresh", id: string) => save({ ...home, [part]: home[part].filter((x) => x !== id) }, part);

  return (
    <>
      <PageHead title="Homepage" sub="What guests see first when they open your menu. Changes save right away.">
        <button type="button" onClick={() => setPreviewOpen(true)} className={`${btn.secondary} xl:hidden`}>
          <EyeIcon width={20} height={20} />
          Preview as a guest
        </button>
        <p role="status" className="text-[14px] text-muted">
          {status}
        </p>
      </PageHead>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-chili/10 px-4 py-3 text-[15px] text-chili">
          {error}
        </p>
      )}

      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_328px] xl:items-start xl:gap-7">
        <div className="space-y-4">
          <section className={card} aria-labelledby="hero-title">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 basis-[220px]">
                <h2 id="hero-title" className="font-display text-[19px] font-bold">
                  Hero
                </h2>
                <p className="text-[14px] text-muted">The big photo at the top of the menu home.</p>
              </div>
              <button type="button" disabled={busy} onClick={() => setPicking("hero")} className={btn.secondary}>
                Change hero
              </button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Photo dish={heroDish} className="h-24 w-24 rounded-2xl sm:h-28 sm:w-28" />
              <div className="min-w-0">
                <p className="font-display text-[22px] font-bold leading-tight">{heroDish.name}</p>
                <p className="mt-0.5 text-[15px] font-semibold text-leaf">{formatPrice(heroDish.priceCents)}</p>
                <p className="mt-0.5 text-[14px] text-muted">
                  {!home.hero
                    ? "Not picked, so guests see your first dish."
                    : heroDish.available
                      ? "Available today"
                      : "Not available today: guests still see it, marked Not Available Today."}
                </p>
              </div>
            </div>
          </section>

          <RowCard
            id="featured"
            title="Featured dishes"
            note="More than 3 and guests swipe through them, round and round."
            dishes={inOrder(home.featured)}
            hero={heroDish.id}
            busy={busy}
            onChoose={() => setPicking("featured")}
            onRemove={(id) => remove("featured", id)}
          />
          <RowCard
            id="fresh"
            title="New on the menu"
            note="These also get a New tag in the whole menu."
            dishes={inOrder(home.fresh)}
            hero={heroDish.id}
            busy={busy}
            onChoose={() => setPicking("fresh")}
            onRemove={(id) => remove("fresh", id)}
          />
        </div>

        <aside aria-label="Preview" className="hidden xl:sticky xl:top-6 xl:block">
          <p className="text-[14px] font-semibold text-muted">What a guest sees on a phone</p>
          {/* A 390 x 844 phone at 80%, inside an 8px bezel. */}
          <div className="mt-3 h-[691px] w-[328px] overflow-hidden rounded-[40px] border-[8px] border-ink bg-white">
            {wide && (
              <iframe
                ref={frame}
                src={PREVIEW_URL}
                title="Preview of your menu"
                width={390}
                height={844}
                className="block origin-top-left scale-[0.8] border-0"
              />
            )}
          </div>
          <p className="mt-3 text-center text-[13px] text-muted">It changes as you do. Scroll and tap it like a phone.</p>
        </aside>
      </div>

      {picking && (
        <DishPicker
          part={picking}
          dishes={dishes}
          chosen={picking === "hero" ? [heroDish.id] : home[picking]}
          hero={heroDish.id}
          onClose={() => setPicking(null)}
          onSave={(ids) => {
            setPicking(null);
            save(picking === "hero" ? { ...home, hero: ids[0] } : { ...home, [picking]: ids }, picking);
          }}
        />
      )}
      {previewOpen && <PreviewDialog onClose={() => setPreviewOpen(false)} />}
    </>
  );
}

/** Wide enough for the preview beside the editor (Tailwind's xl). Phones and tablets open it on a button instead. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1280px)");
    const set = () => setWide(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  return wide;
}

function Photo({ dish, className }: { dish: HomeDish; className: string }) {
  return dish.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dish.imageUrl} alt="" draggable={false} className={`shrink-0 object-cover ${dish.available ? "" : "grayscale"} ${className}`} />
  ) : (
    <span className={`block shrink-0 bg-wash ${className}`} />
  );
}

/** One row of the menu home: its dishes as tiles, each with a way out, and the way to choose more. */
function RowCard({
  id,
  title,
  note,
  dishes,
  hero,
  busy,
  onChoose,
  onRemove,
}: {
  id: string;
  title: string;
  note: string;
  dishes: HomeDish[];
  hero: string;
  busy: boolean;
  onChoose: () => void;
  onRemove: (id: string) => void;
}) {
  const titleId = `${id}-title`;
  return (
    <section className={card} aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-[220px]">
          <h2 id={titleId} className="font-display text-[19px] font-bold">
            {title} <span className="font-sans text-[14px] font-semibold text-muted">{dishes.length}</span>
          </h2>
          <p className="text-[14px] text-muted">{note}</p>
        </div>
        <button type="button" disabled={busy} onClick={onChoose} className={btn.secondary}>
          <PlusIcon width={18} height={18} strokeWidth={2.2} />
          Choose dishes
        </button>
      </div>
      {dishes.length ? (
        <ul className="mt-4 grid grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-3 gap-y-4">
          {dishes.map((d) => (
            <li key={d.id} className="relative">
              <Photo dish={d} className={`aspect-square w-full rounded-[14px] ${d.id === hero ? "opacity-60" : ""}`} />
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(d.id)}
                aria-label={`Take ${d.name} off ${title}`}
                className="absolute -right-2.5 -top-2.5 grid h-11 w-11 place-items-center disabled:opacity-60"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgb(0_0_0/0.25)] hover:bg-wash">
                  <CloseIcon width={16} height={16} strokeWidth={2.4} />
                </span>
              </button>
              <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-tight">{d.name}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {d.id === hero ? "The hero, so it shows up top instead" : formatPrice(d.priceCents)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-[15px] text-muted">
          None yet. The row stays off the menu home until you choose some.
        </p>
      )}
    </section>
  );
}

const PICKER = {
  hero: { title: "Pick the hero", note: "The big photo at the top of the menu home." },
  featured: { title: "Featured dishes", note: "Tick the dishes for this row." },
  fresh: { title: "New on the menu", note: "Tick the dishes for this row." },
};

/** Every dish with a search over them: one to pick for the hero, any number for a row. */
function DishPicker({
  part,
  dishes,
  chosen,
  hero,
  onSave,
  onClose,
}: {
  part: Part;
  dishes: HomeDish[];
  chosen: string[];
  hero: string;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState(chosen);
  const [q, setQ] = useState("");
  const one = part === "hero";
  const { title, note } = PICKER[part];

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const query = q.trim().toLowerCase();
  const shown = dishes.filter((d) => d.name.toLowerCase().includes(query));
  const n = picked.length;

  return (
    <dialog
      ref={ref}
      aria-labelledby="picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto h-[min(720px,calc(100dvh-32px))] w-[min(520px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(16_52_42/0.35)] backdrop:bg-forest/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="picker-title" className="font-display text-[22px] font-bold leading-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-[15px] text-muted">{note}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-wash hover:text-ink"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <div className="px-5 pb-3 pt-4">
          <label htmlFor="picker-search" className="text-[13px] font-semibold text-muted">
            Search dishes
          </label>
          <div className="relative mt-1.5">
            <SearchIcon width={18} height={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="picker-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name of a dish"
              className="h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-3 text-[15px]"
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-3">
          {shown.map((d) => {
            const on = picked.includes(d.id);
            return (
              <li key={d.id}>
                <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl p-2 ${on ? "bg-leaf-tint" : "hover:bg-paper"}`}>
                  <input
                    type={one ? "radio" : "checkbox"}
                    name={one ? "hero" : undefined}
                    checked={on}
                    onChange={() => setPicked(one ? [d.id] : on ? picked.filter((x) => x !== d.id) : [...picked, d.id])}
                    className="h-5 w-5 shrink-0 accent-forest"
                  />
                  <Photo dish={d} className="h-12 w-12 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{d.name}</span>
                    <span className="block text-[13px] text-muted">
                      {!one && d.id === hero
                        ? "The hero, so it shows up top instead"
                        : `${formatPrice(d.priceCents)}${d.available ? "" : ", not available today"}`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
          {!shown.length && <li className="px-2 py-6 text-center text-[15px] text-muted">No dish called “{q.trim()}”.</li>}
        </ul>
        <div className="flex gap-2.5 border-t border-line px-5 pb-5 pt-3">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-full px-4 text-[15px] font-semibold text-forest hover:bg-wash">
            Cancel
          </button>
          <button type="button" disabled={one && !n} onClick={() => onSave(picked)} className={`${btn.primary} flex-1`}>
            {one ? "Save" : n ? `Save ${n} ${n === 1 ? "dish" : "dishes"}` : "Save with no dishes"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Phones and tablets: the menu as a guest sees it, over the whole screen. */
function PreviewDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="preview-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-ink p-0 backdrop:bg-ink/60"
    >
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 shrink-0 items-center justify-between pl-4 pr-2 text-white">
          <h2 id="preview-title" className="font-display text-[18px] font-bold">
            What guests see
          </h2>
          <button type="button" aria-label="Close preview" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
            <CloseIcon width={22} height={22} />
          </button>
        </div>
        <iframe src={PREVIEW_URL} title="Preview of your menu" className="mx-auto block min-h-0 w-full max-w-[430px] flex-1 border-0 bg-white sm:rounded-t-[24px]" />
      </div>
    </dialog>
  );
}
