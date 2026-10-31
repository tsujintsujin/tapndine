"use client";

import { Fraunces } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dish, Menu } from "@/lib/menu";
import type { GuestOrders } from "@/lib/orders";
import { fold, formatPrice, formatTime, servesLabel } from "@/lib/format";
import {
  choiceLists,
  extraCents,
  missingPick,
  offered,
  resolvePicks,
  startPicks,
  togglePick,
  type DishOption,
} from "@/lib/options";
import {
  BagIcon,
  BellIcon,
  CheckIcon,
  ChiliIcon,
  CloseIcon,
  INGREDIENT_ICONS,
  MinusIcon,
  PeopleIcon,
  PlusIcon,
  SearchIcon,
} from "@/app/components/Icons";
import type { Notes, OrderLine } from "./MenuApp";
import Sheet from "./Sheet";
import { DishImage, SpiceMeter } from "./parts";

// ---------------------------------------------------------------------------
// Design B: ube and calamansi. One long menu instead of a home page and a
// separate grid: an ube band with the restaurant and its picks to swipe, then
// every category in turn, one dish per row with its photo on the right. Tabs
// stick to the top and follow the scroll. The order and the call button sit
// in a dock at the bottom. Dish names are set in Fraunces.
//
// All the ordering logic lives in MenuApp; this file only draws it. The
// colours are the .theme-ube tokens in globals.css, so the dialogs MenuApp
// shares with Design A (nickname, call) pick them up too:
//   forest  ube, the band and the order bar
//   leaf    ube, pressed things in the shared dialogs
//   mango   calamansi, the add buttons and Send
//   wash    lilac, quiet fills

const serif = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  variable: "--font-serif",
  display: "swap",
});

/** The phone's status bar matches the ube band while this design is open. */
const UBE = "#3D2358";

export default function MenuB({
  menu,
  nickname,
  canSend,
  demo,
  lines,
  notes,
  setNote,
  setQty,
  sent,
  calling,
  dish,
  orderOpen,
  onDish,
  onQuickAdd,
  onAdd,
  onCloseDish,
  onOrder,
  onCloseOrder,
  onNickname,
  onCall,
  sending,
  sendError,
  onSend,
  children,
}: {
  menu: Menu;
  /** "" when the guest skipped it or was never asked. */
  nickname: string;
  canSend: boolean;
  demo: boolean;
  lines: OrderLine[];
  notes: Notes;
  setNote: (key: string, text: string) => void;
  setQty: (key: string, qty: number) => void;
  sent: GuestOrders | null;
  /** A call from this table is waiting for the waiter. */
  calling: boolean;
  /** The dish whose sheet is open (?d=). */
  dish: Dish | undefined;
  orderOpen: boolean;
  onDish: (id: string) => void;
  /** The + on a row: straight in, or the sheet when a size must be picked. */
  onQuickAdd: (id: string) => void;
  onAdd: (dishId: string, n: number, picks: DishOption[]) => void;
  onCloseDish: () => void;
  onOrder: () => void;
  onCloseOrder: () => void;
  /** Missing where there is no waiter. */
  onNickname?: () => void;
  onCall?: () => void;
  sending: boolean;
  sendError: string;
  onSend: () => void;
  /** MenuApp's shared dialogs and notice, inside this theme. */
  children: React.ReactNode;
}) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const before = meta.content;
    meta.content = UBE;
    return () => {
      meta.content = before;
    };
  }, []);

  const inOrder = (id: string) => lines.reduce((n, l) => n + (l.dish.id === id ? l.qty : 0), 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);

  return (
    <div className={`${serif.variable} theme-ube min-h-dvh bg-paper text-ink`}>
      <Band menu={menu} nickname={nickname} onNickname={onNickname} />
      <Picks menu={menu} onDish={onDish} onAdd={onQuickAdd} />

      {/* Room for the dock; see Design A's main for the 100lvh - 100svh. */}
      <main className="pb-[calc(104px_+_env(safe-area-inset-bottom)_+_100lvh_-_100svh)]">
        <MenuList menu={menu} inOrder={inOrder} onDish={onDish} onAdd={onQuickAdd} />
      </main>

      <Dock count={count} total={total} sent={sent} calling={calling} onOrder={onOrder} onCall={onCall} />

      <Sheet open={!!dish} onClose={onCloseDish} from="bottom" label={dish?.name ?? "Dish"}>
        {dish && (
          <DishSheet
            key={dish.id}
            dish={dish}
            inOrder={inOrder(dish.id)}
            onAdd={(n, picks) => onAdd(dish.id, n, picks)}
            onClose={onCloseDish}
          />
        )}
      </Sheet>

      <Sheet open={orderOpen} onClose={onCloseOrder} from="bottom" label="Your order">
        <OrderSheet
          lines={lines}
          setQty={setQty}
          notes={notes}
          setNote={setNote}
          sent={sent}
          canSend={canSend}
          demo={demo}
          sending={sending}
          sendError={sendError}
          onSend={onSend}
          nickname={nickname}
          onNickname={onNickname}
          onClose={onCloseOrder}
        />
      </Sheet>

      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The ube band: logo, name, the table and who is ordering. The picks overlap its foot. */
function Band({ menu, nickname, onNickname }: { menu: Menu; nickname: string; onNickname?: () => void }) {
  return (
    <header className="bg-forest pb-[104px] pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex max-w-2xl items-center gap-3.5 px-5 pt-6">
        {menu.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={menu.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[30px] font-semibold leading-tight tracking-[-0.01em] [font-variation-settings:'SOFT'_100]">
            {menu.businessName}
          </h1>
          <div className="mt-0.5 flex min-h-8 flex-wrap items-center gap-x-3 text-[15px] text-white/75">
            {menu.tableLabel && <span>{menu.tableLabel}</span>}
            {onNickname && (
              <button
                type="button"
                onClick={onNickname}
                aria-label={nickname ? `Ordering as ${nickname}, change name` : "Add your name"}
                className="-my-1 flex h-9 items-center rounded-full bg-white/15 px-3 font-medium text-white active:bg-white/20"
              >
                {nickname ? `Hi ${nickname}` : "Add your name"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Today's pick, then best sellers, then new dishes, once each. */
function pickList(menu: Menu): { dish: Dish; tag: string }[] {
  const all = menu.dishOrder.map((id) => menu.dishes[id]);
  const seen = new Set<string>();
  const out: { dish: Dish; tag: string }[] = [];
  const take = (d: Dish, tag: string) => {
    if (seen.has(d.id) || out.length >= 8) return;
    seen.add(d.id);
    out.push({ dish: d, tag });
  };
  all.filter((d) => d.featured).forEach((d) => take(d, "Today's pick"));
  all.filter((d) => d.bestSeller).forEach((d) => take(d, "Best seller"));
  all.filter((d) => d.isNew).forEach((d) => take(d, "New"));
  return out;
}

/** Tall photo cards to swipe, starting inside the band. */
function Picks({ menu, onDish, onAdd }: { menu: Menu; onDish: (id: string) => void; onAdd: (id: string) => void }) {
  const picks = pickList(menu);
  if (!picks.length) return <div className="-mt-[80px]" />;
  return (
    <section aria-labelledby="picks-title" className="-mt-[96px]">
      <h2 id="picks-title" className="mx-auto max-w-2xl px-5 font-display text-[20px] italic text-white/90">
        The kitchen&apos;s picks
      </h2>
      <ul className="no-scrollbar mx-auto mt-3 flex max-w-2xl snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-5">
        {picks.map(({ dish: d, tag }) => (
          <li key={d.id} className="w-[min(62vw,232px)] shrink-0 snap-start">
            <article className="relative flex h-full flex-col rounded-[26px] bg-white p-2 shadow-[0_14px_32px_rgb(30_21_48/0.16)]">
              <DishImage dish={d} eager className="aspect-[4/5] rounded-[20px]" soldOutLabel={false} />
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-forest">
                {d.available ? tag : "Not available today"}
              </span>
              <div className="flex flex-1 items-end gap-2 px-2 pb-1 pt-2.5">
                <h3 className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onDish(d.id)}
                    className="text-left after:absolute after:inset-0 after:rounded-[26px] after:content-['']"
                  >
                    <span className="line-clamp-2 font-display text-[18px] font-semibold leading-tight">{d.name}</span>
                    <span className="mt-1 block text-[15px] font-semibold text-forest">{formatPrice(d.priceCents)}</span>
                  </button>
                </h3>
                {d.available && <AddButton name={d.name} onAdd={() => onAdd(d.id)} />}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The round calamansi +, over everything else in its card or row. */
function AddButton({ name, onAdd, className = "" }: { name: string; onAdd: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add ${name} to order`}
      className={`relative z-[1] grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mango text-ink shadow-[0_4px_10px_rgb(30_21_48/0.18)] active:brightness-95 ${className}`}
    >
      <PlusIcon width={22} height={22} strokeWidth={2.4} />
    </button>
  );
}

// ---------------------------------------------------------------------------

type Section = { id: string; name: string; dishIds: string[] };

/**
 * The categories in order. A dish in no category still shows, in a last
 * "More dishes"; a menu with no categories at all is one plain list.
 */
function sectionsOf(menu: Menu): Section[] {
  const placed = new Set(menu.categories.flatMap((c) => c.dishIds));
  const loose = menu.dishOrder.filter((id) => !placed.has(id));
  const sections: Section[] = menu.categories.map((c) => ({ id: c.id, name: c.name, dishIds: c.dishIds }));
  if (loose.length) sections.push({ id: "more", name: sections.length ? "More dishes" : "Menu", dishIds: loose });
  return sections;
}

/** The sticky tabs (and search), then every section of the menu. */
function MenuList({
  menu,
  inOrder,
  onDish,
  onAdd,
}: {
  menu: Menu;
  inOrder: (id: string) => number;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const sections = useMemo(() => sectionsOf(menu), [menu]);
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // While a tapped tab's smooth scroll runs, the sections it passes must not
  // light their own tabs one after another.
  const jumping = useRef(false);

  // The tab of the section under the bar lights up as the page scrolls.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (jumping.current) return;
        const line = (barRef.current?.getBoundingClientRect().bottom ?? 0) + 12;
        let current = sections[0]?.id ?? "";
        for (const s of sections) {
          const el = document.getElementById(`sec-${s.id}`);
          if (el && el.getBoundingClientRect().top <= line) current = s.id;
        }
        setActive(current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [sections]);

  // Keep the lit tab in sight in the row, without moving the page.
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!row || !tab) return;
    const left = tab.offsetLeft - row.clientWidth / 2 + tab.offsetWidth / 2;
    row.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  const barHeight = () => barRef.current?.offsetHeight ?? 0;

  const jumpTo = (id: string) => {
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    setActive(id);
    jumping.current = true;
    const done = () => {
      jumping.current = false;
      window.removeEventListener("scrollend", done);
    };
    window.addEventListener("scrollend", done);
    // Browsers without scrollend, or no scroll needed at all.
    setTimeout(done, 900);
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - barHeight() + 1, behavior: "smooth" });
  };

  const openSearch = () => {
    setSearching(true);
    // The box sits at the top with the results under it.
    const top = (anchorRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    if (window.scrollY < top) window.scrollTo(0, top);
  };
  const closeSearch = () => {
    setSearching(false);
    setQ("");
  };

  const needle = fold(q.trim());
  const results = needle
    ? menu.dishOrder.filter((id) => {
        const d = menu.dishes[id];
        return fold(d.name).includes(needle) || fold(d.shortDescription).includes(needle);
      })
    : [];

  return (
    <>
      <div ref={anchorRef} />
      <div ref={barRef} className="sticky top-0 z-20 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-1 border-b border-line px-3">
          {searching ? (
            <SearchBox value={q} onChange={setQ} onCancel={closeSearch} />
          ) : (
            <>
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search the menu"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-forest active:bg-wash"
              >
                <SearchIcon width={21} height={21} />
              </button>
              {sections.length > 1 && (
                <div ref={tabsRef} role="tablist" aria-label="Categories" className="no-scrollbar flex h-full flex-1 gap-1 overflow-x-auto">
                  {sections.map((s) => {
                    const on = s.id === active;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        data-tab={s.id}
                        onClick={() => jumpTo(s.id)}
                        className={`relative h-full shrink-0 px-3 text-[15px] font-semibold transition-colors ${
                          on ? "text-forest" : "text-muted"
                        }`}
                      >
                        {s.name}
                        <span
                          aria-hidden
                          className={`absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-forest transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {searching && needle ? (
        <section aria-label="Search results" className="mx-auto min-h-[60svh] max-w-2xl px-5">
          <p className="pb-1 pt-5 text-[15px] text-muted" aria-live="polite">
            {results.length
              ? `${results.length} ${results.length === 1 ? "dish" : "dishes"} for “${q.trim()}”`
              : `No dishes match “${q.trim()}”. Try another word.`}
          </p>
          <ul className="divide-y divide-line">
            {results.map((id) => (
              <li key={id}>
                <DishRow dish={menu.dishes[id]} count={inOrder(id)} onOpen={() => onDish(id)} onAdd={() => onAdd(id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mx-auto max-w-2xl px-5">
          {sections.map((s) => (
            <section
              key={s.id}
              id={`sec-${s.id}`}
              aria-labelledby={`sec-${s.id}-title`}
              className="pt-7"
            >
              <h2 id={`sec-${s.id}-title`} className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em]">{s.name}</span>
                <span className="shrink-0 text-[14px] text-muted">
                  {s.dishIds.length} {s.dishIds.length === 1 ? "dish" : "dishes"}
                </span>
              </h2>
              <ul className="divide-y divide-line">
                {s.dishIds.map((id) => (
                  <li key={id}>
                    <DishRow dish={menu.dishes[id]} count={inOrder(id)} onOpen={() => onDish(id)} onAdd={() => onAdd(id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function SearchBox({ value, onChange, onCancel }: { value: string; onChange: (v: string) => void; onCancel: () => void }) {
  return (
    <>
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search the menu</span>
        <SearchIcon width={19} height={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          placeholder="Dish name or ingredient"
          enterKeyHint="search"
          autoComplete="off"
          className="h-11 w-full rounded-full bg-wash pl-10 pr-3 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-forest/30 [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      <button type="button" onClick={onCancel} className="h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-forest active:bg-wash">
        Cancel
      </button>
    </>
  );
}

/**
 * One dish: name, a line on it, price, how many it feeds and its heat, with
 * the photo on the right and the + on the photo's corner. The whole row
 * opens the dish; the + adds it.
 */
function DishRow({ dish, count, onOpen, onAdd }: { dish: Dish; count: number; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="relative flex gap-4 py-4">
      <div className="min-w-0 flex-1">
        <h3>
          <button
            type="button"
            onClick={onOpen}
            className="text-left font-display text-[19px] font-semibold leading-snug after:absolute after:inset-0 after:content-['']"
          >
            {dish.name}
          </button>
        </h3>
        {dish.isNew && dish.available && (
          <span className="mt-1 inline-block rounded-full bg-mango-soft px-2 py-0.5 text-[12px] font-semibold text-ink">New</span>
        )}
        <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-muted">{dish.shortDescription}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
          {dish.available ? (
            <span className="text-[16px] font-bold">{formatPrice(dish.priceCents)}</span>
          ) : (
            <span className="font-semibold text-chili">Not available today</span>
          )}
          <span className="flex items-center gap-1 text-muted">
            <PeopleIcon width={15} height={15} />
            {servesLabel(dish.servesMin, dish.servesMax).replace(/ (people|person)$/, "")}
          </span>
          {!!dish.spiceLevel && (
            <span className="flex text-chili" role="img" aria-label={`Spice level ${dish.spiceLevel} of 5`}>
              {Array.from({ length: dish.spiceLevel }, (_, i) => (
                <ChiliIcon key={i} lit width={15} height={15} />
              ))}
            </span>
          )}
        </p>
      </div>
      <div className="relative w-[104px] shrink-0 self-start">
        <DishImage dish={dish} className="aspect-square rounded-[18px]" soldOutLabel={false} />
        {count > 0 && (
          <span className="absolute left-1.5 top-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-forest px-1.5 text-[13px] font-bold text-white ring-2 ring-white">
            <span className="sr-only">In your order: </span>
            {count}
          </span>
        )}
        {dish.available && <AddButton name={dish.name} onAdd={onAdd} className="absolute -bottom-2 -right-2 ring-[3px] ring-paper" />}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------

/**
 * The bottom dock: the call button, and once there is an order (or something
 * already sent) a bar with the count and total that opens it.
 */
function Dock({
  count,
  total,
  sent,
  calling,
  onOrder,
  onCall,
}: {
  count: number;
  total: number;
  sent: GuestOrders | null;
  calling: boolean;
  onOrder: () => void;
  onCall?: () => void;
}) {
  const hasSent = !!sent && sent.batches.length > 0;
  const bar = count > 0 || hasSent;
  return (
    <nav aria-label="Your order" className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[calc(12px+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-2xl items-center justify-end gap-2.5">
        {onCall && (
          <button
            type="button"
            onClick={onCall}
            aria-label={calling ? "Call your waiter, a call is waiting" : "Call your waiter or ask for the bill"}
            className={`relative flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-white text-forest shadow-[0_10px_26px_rgb(30_21_48/0.22)] ring-1 ring-line active:bg-wash ${
              bar ? "w-14" : "px-5"
            }`}
          >
            <BellIcon width={22} height={22} />
            {!bar && <span className="text-[16px] font-semibold">Call waiter</span>}
            {calling && <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-mango ring-2 ring-forest" aria-hidden />}
          </button>
        )}
        {bar && (
          <button
            type="button"
            onClick={onOrder}
            className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full bg-forest pl-2 pr-5 text-white shadow-[0_10px_26px_rgb(30_21_48/0.32)] active:bg-forest-soft"
          >
            <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-full bg-mango px-2 text-[16px] font-bold text-ink">
              {count > 0 ? count : <CheckIcon width={20} height={20} />}
            </span>
            <span className="min-w-0 truncate text-[16px] font-semibold">{count > 0 ? "View order" : "Sent orders"}</span>
            <span className="ml-auto shrink-0 font-display text-[20px] font-semibold">
              {formatPrice(count > 0 ? total : sent!.subtotal)}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------

/** The dish: photo across the top, details on a card rising over it, Add pinned at the foot. */
function DishSheet({
  dish,
  inOrder,
  onAdd,
  onClose,
}: {
  dish: Dish;
  inOrder: number;
  onAdd: (n: number, picks: DishOption[]) => void;
  onClose: () => void;
}) {
  const sizes = offered(dish, "size");
  const addons = offered(dish, "addon");
  const spices = offered(dish, "spice");
  const lists = choiceLists(dish);
  const [n, setN] = useState(1);
  const [picked, setPicked] = useState(() => startPicks(dish));
  const picks = resolvePicks(dish, [...picked]);
  const ready = dish.available && picks !== null;
  const unit = dish.priceCents + extraCents(picks ?? []);
  const pick = (o: DishOption) => setPicked((prev) => togglePick(dish, prev, o));

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative">
          <DishImage dish={dish} eager className="aspect-[4/3] w-full" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-[calc(12px+env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/95 text-ink shadow-[0_4px_12px_rgb(0_0_0/0.2)] active:bg-wash sm:top-3"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div className="relative -mt-7 rounded-t-[28px] bg-white px-5 pb-7 pt-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]">{dish.name}</h2>
            <p className="shrink-0 pt-1 font-display text-[24px] font-semibold text-forest">{formatPrice(dish.priceCents)}</p>
          </div>
          {dish.shortDescription && <p className="mt-1 font-display text-[17px] italic text-muted">{dish.shortDescription}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-wash px-3 text-[14px]">
              <PeopleIcon width={17} height={17} />
              Serves {servesLabel(dish.servesMin, dish.servesMax)}
            </span>
            {dish.spiceLevel !== null && (
              <span className="flex h-9 items-center rounded-full bg-wash px-3">
                <SpiceMeter level={dish.spiceLevel} />
              </span>
            )}
          </div>

          {dish.description && <p className="mt-4 text-[16px] leading-relaxed">{dish.description}</p>}

          {sizes.length > 0 && <Chips title="Size" required={dish.sizeRequired} options={sizes} picked={picked} onPick={pick} round />}
          {/* Set meals: one pick from each list ("Drink", "Side"), always required. */}
          {lists.map((l) => (
            <Chips key={l.name} title={l.name} required options={l.options} picked={picked} onPick={pick} round />
          ))}
          {addons.length + spices.length > 0 && <Extras addons={addons} spices={spices} picked={picked} onPick={pick} />}

          {dish.ingredients.length > 0 && (
            <>
              <h3 className="mt-7 font-display text-[20px] font-semibold">What&apos;s in it</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {dish.ingredients.map((ing, i) => {
                  const Icon = INGREDIENT_ICONS[ing.kind];
                  return (
                    <li key={i} className="flex h-9 items-center gap-1.5 rounded-full bg-wash pl-2.5 pr-3 text-[14px]">
                      {Icon && <Icon width={16} height={16} className="text-forest" />}
                      {ing.name}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-white px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        {inOrder > 0 && (
          <p className="mb-2 text-center text-[13px] text-muted" aria-live="polite">
            {inOrder} already in your order
          </p>
        )}
        <div className="flex gap-2.5">
          {dish.available && (
            <div className="flex h-14 shrink-0 items-center rounded-full bg-wash" role="group" aria-label="How many">
              <button
                type="button"
                disabled={n <= 1}
                onClick={() => setN(n - 1)}
                aria-label="One less"
                className="grid h-14 w-12 place-items-center rounded-full active:bg-line disabled:text-muted/50"
              >
                <MinusIcon width={20} height={20} />
              </button>
              <span className="w-6 text-center text-[18px] font-bold tabular-nums" aria-live="polite">
                {n}
              </span>
              <button
                type="button"
                disabled={n >= 20}
                onClick={() => setN(n + 1)}
                aria-label="One more"
                className="grid h-14 w-12 place-items-center rounded-full active:bg-line disabled:text-muted/50"
              >
                <PlusIcon width={20} height={20} />
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              onAdd(n, picks!);
              setN(1);
              setPicked(startPicks(dish));
            }}
            className="flex h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-mango px-5 text-[17px] font-bold text-ink active:brightness-95 disabled:justify-center disabled:bg-wash disabled:text-muted"
          >
            {!dish.available ? (
              "Not available today"
            ) : !picks ? (
              `Choose a ${missingPick(dish, picked) ?? "size"}`
            ) : (
              <>
                <span className="truncate">{n > 1 ? `Add ${n}` : "Add to order"}</span>
                <span className="shrink-0">{formatPrice(unit * n)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

/** A set of choices as pills that wrap: one pick (round) or any (not round). */
function Chips({
  title,
  required = false,
  options,
  picked,
  onPick,
  round,
  small = false,
}: {
  title: string;
  required?: boolean;
  options: DishOption[];
  picked: Set<string>;
  onPick: (o: DishOption) => void;
  round: boolean;
  /** Inside the add-ons box: a smaller heading. */
  small?: boolean;
}) {
  const done = options.some((o) => picked.has(o.id));
  return (
    <div role={round ? "radiogroup" : "group"} aria-label={title} className={small ? "mt-4" : "mt-6"}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={small ? "text-[14px] font-semibold text-muted" : "font-display text-[20px] font-semibold"}>
          {title}
          {small && <span className="font-normal">{round ? ", pick 1" : ", pick any"}</span>}
        </h3>
        {required ? (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${done ? "bg-wash text-forest" : "bg-mango text-ink"}`}>
            {done ? "Picked" : "Required"}
          </span>
        ) : (
          !small && <span className="text-[13px] text-muted">{round ? "Pick 1" : "Pick any"}</span>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = picked.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role={round ? "radio" : "checkbox"}
              aria-checked={on}
              onClick={() => onPick(o)}
              className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-colors ${
                on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink active:bg-wash"
              }`}
            >
              {on && !round && <CheckIcon width={16} height={16} />}
              {o.name}
              {o.priceCents > 0 && <span className={on ? "text-white/75" : "text-muted"}>+{formatPrice(o.priceCents)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Add-ons and spice behind one line, so a guest who wants the dish as it comes can skip them. */
function Extras({
  addons,
  spices,
  picked,
  onPick,
}: {
  addons: DishOption[];
  spices: DishOption[];
  picked: Set<string>;
  onPick: (o: DishOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = addons.length && spices.length ? "Add-ons and spice" : addons.length ? "Add-ons" : "Spice";
  const chosen = [...addons, ...spices]
    .filter((o) => picked.has(o.id))
    .map((o) => o.name)
    .join(", ");
  return (
    <div className="mt-6 rounded-[22px] border border-dashed border-forest/30 px-4 py-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center gap-3 text-left"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-white" aria-hidden>
          {open ? <MinusIcon width={16} height={16} /> : <PlusIcon width={16} height={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">{title}</span>
          {chosen && <span className="block text-[13px] text-muted">{chosen}</span>}
        </span>
      </button>
      {open && (
        <div className="pb-4">
          {addons.length > 0 && <Chips title="Add-ons" options={addons} picked={picked} onPick={onPick} round={false} small />}
          {spices.length > 0 && <Chips title="Spice" options={spices} picked={picked} onPick={onPick} round small />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrderSheet({
  lines,
  setQty,
  notes,
  setNote,
  sent,
  canSend,
  demo,
  sending,
  sendError,
  onSend,
  nickname,
  onNickname,
  onClose,
}: {
  lines: OrderLine[];
  setQty: (key: string, qty: number) => void;
  notes: Notes;
  setNote: (key: string, text: string) => void;
  sent: GuestOrders | null;
  canSend: boolean;
  demo: boolean;
  sending: boolean;
  sendError: string;
  onSend: () => void;
  nickname: string;
  onNickname?: () => void;
  onClose: () => void;
}) {
  const total = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
  const hasSent = !!sent && sent.batches.length > 0;

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-[calc(16px+env(safe-area-inset-top))] sm:pt-4">
        <h2 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.01em]">Your order</h2>
        <button type="button" onClick={onClose} aria-label="Close your order" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash active:bg-line">
          <CloseIcon width={20} height={20} />
        </button>
      </div>

      {lines.length === 0 && !hasSent ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center sm:py-16">
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-wash text-forest">
            <BagIcon width={32} height={32} />
          </span>
          <p className="mt-4 font-display text-[22px] font-semibold">Nothing added yet</p>
          <p className="mt-1 text-[15px] text-muted">Tap + on a dish to add it here.</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {lines.length > 0 && (
              <section aria-label="Not sent yet" className="px-5">
                {hasSent && <h3 className="pt-2 text-[14px] font-semibold text-muted">Not sent yet</h3>}
                <ul className="divide-y divide-line">
                  {lines.map(({ key, dish, label, unitCents, qty }, i) => (
                    <li key={key} className="flex gap-3 py-4">
                      <DishImage dish={dish} className="aspect-square w-16 shrink-0 self-start rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 font-display text-[17px] font-semibold leading-snug">{dish.name}</p>
                          <p className="shrink-0 font-semibold tabular-nums">{formatPrice(unitCents * qty)}</p>
                        </div>
                        {label && <p className="text-[14px] leading-snug text-muted">{label}</p>}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex h-10 items-center rounded-full bg-wash">
                            <button type="button" onClick={() => setQty(key, qty - 1)} aria-label={`One less ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-line">
                              <MinusIcon width={18} height={18} />
                            </button>
                            <span className="w-5 text-center font-bold tabular-nums">{qty}</span>
                            <button type="button" onClick={() => setQty(key, qty + 1)} aria-label={`One more ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-line">
                              <PlusIcon width={18} height={18} />
                            </button>
                          </div>
                        </div>
                        {canSend && <Note id={`note-b-${i}`} note={notes[key] ?? ""} onNote={(t) => setNote(key, t)} />}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hasSent && <SentTimeline sent={sent!} />}
          </div>

          <div className="shrink-0 border-t border-line px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            {lines.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[17px] font-medium">{hasSent ? "To send" : "Total"}</span>
                  <span className="font-display text-[28px] font-semibold">{formatPrice(total)}</span>
                </div>
                {canSend ? (
                  <>
                    <p className="mt-1 flex items-center justify-between gap-2 text-[14px] text-muted">
                      <span className="min-w-0 truncate">
                        {nickname ? (
                          <>
                            Sending as <span className="font-semibold text-ink">{nickname}</span>
                          </>
                        ) : (
                          "No name: your waiter sees a guest number"
                        )}
                      </span>
                      {onNickname && (
                        <button type="button" onClick={onNickname} className="-my-2 h-10 shrink-0 rounded-full px-3 font-semibold text-forest active:bg-wash">
                          {nickname ? "Change" : "Add name"}
                        </button>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={onSend}
                      disabled={sending}
                      className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-mango text-[17px] font-bold text-ink active:brightness-95 disabled:opacity-60"
                    >
                      {sending ? "Sending…" : "Send to waiter"}
                    </button>
                    {sendError && (
                      <p role="alert" className="mt-2 text-center text-sm text-chili">
                        {sendError}
                      </p>
                    )}
                  </>
                ) : demo ? (
                  <p className="mt-2 text-sm text-muted">
                    This is a demo menu. In a restaurant with tapndine, Send to waiter goes right here and your order lands
                    on the waiter&apos;s phone.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    This list stays on your phone. Show it to your waiter when you&apos;re ready to order.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[17px] font-medium">Your total so far</span>
                  <span className="font-display text-[28px] font-semibold">{formatPrice(sent!.subtotal)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">Want more? Add dishes, then send again.</p>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** "Add a note" under a line; it opens a labelled box. The note goes to the waiter with the dish. */
function Note({ id, note, onNote }: { id: string; note: string; onNote: (t: string) => void }) {
  const [open, setOpen] = useState(note !== "");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-1 mt-1 flex min-h-10 items-center gap-1 rounded-full px-1 text-[14px] font-semibold text-forest underline decoration-forest/30 underline-offset-4 active:bg-wash"
      >
        Add a note
      </button>
    );
  }
  return (
    <div className="mt-2">
      <label htmlFor={id} className="block text-[13px] font-semibold text-muted">
        Note for your waiter
      </label>
      <input
        id={id}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        onBlur={() => !note.trim() && setOpen(false)}
        maxLength={100}
        autoFocus={note === ""}
        enterKeyHint="done"
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="e.g. no egg, less spicy"
        className="mt-1 block h-11 w-full rounded-2xl border border-line bg-white px-3 text-[16px] outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
      />
    </div>
  );
}

/** What this phone already sent, one stop per send, each marked once the waiter has seen it. */
function SentTimeline({ sent }: { sent: GuestOrders }) {
  return (
    <section aria-label="Sent to your waiter" className="px-5 pb-5 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[22px] font-semibold">Sent to your waiter</h3>
        <span className="shrink-0 rounded-full bg-wash px-2.5 py-0.5 text-[13px] font-semibold text-forest">{sent.nickname ?? `Guest ${sent.number}`}</span>
      </div>
      <ol className="ml-2 mt-4 border-l-2 border-line">
        {sent.batches.map((b) => (
          <li key={b.id} className="relative pb-5 pl-6 last:pb-1">
            <span
              aria-hidden
              className={`absolute -left-[9px] top-1 grid h-4 w-4 place-items-center rounded-full ring-4 ring-white ${
                b.seenAt ? "bg-forest" : "animate-pulse bg-mango motion-reduce:animate-none"
              }`}
            />
            <p className="text-[15px] font-semibold">Sent at {formatTime(b.sentAt)}</p>
            <p className={`flex items-center gap-1 text-[13px] font-semibold ${b.seenAt ? "text-forest" : "text-muted"}`}>
              {b.seenAt ? (
                <>
                  <CheckIcon width={15} height={15} />
                  Your waiter has it
                </>
              ) : (
                "Waiting for your waiter to see it"
              )}
            </p>
            <ul className="mt-1.5">
              {b.lines.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-3 py-1 text-[15px]">
                  <span className="min-w-0">
                    <span className="font-semibold tabular-nums">{l.qty}×</span> {l.name}
                    {l.options && <span className="block text-[13px] text-muted">{l.options}</span>}
                    {l.note && <span className="block text-[13px] italic text-muted">“{l.note}”</span>}
                  </span>
                  <span className="shrink-0 text-muted">{formatPrice(l.priceCents * l.qty)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex justify-between border-t border-line pt-3 text-[15px] font-semibold">
        <span>Sent so far</span>
        <span>{formatPrice(sent.subtotal)}</span>
      </p>
    </section>
  );
}
