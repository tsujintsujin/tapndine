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
  mustPick,
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
  ChevronRight,
  ChiliIcon,
  CloseIcon,
  INGREDIENT_ICONS,
  MenuIcon,
  MinusIcon,
  PeopleIcon,
  PlusIcon,
  SearchIcon,
} from "@/app/components/Icons";
import { closeParam, setParams } from "./history";
import type { Notes, OrderLine } from "./MenuApp";
import Sheet from "./Sheet";
import { DishImage, SpiceMeter } from "./parts";

// ---------------------------------------------------------------------------
// Design B, "plate by plate": the menu is a vertical feed, one dish filling
// the phone, and a swipe brings the next. It opens on a cover with the
// restaurant and an index of its categories. A bar over the top holds the
// index, the call button and the order. Details and choices rise in a half
// sheet so the dish stays in view above them. Spec: .claude/design-b/SPEC.md.
//
// All the ordering logic lives in MenuApp; this file only draws it. The
// colours are the .theme-ube tokens in globals.css, so the dialogs MenuApp
// shares with Design A (nickname, call) pick them up too:
//   forest  ube, the cover and dishes without a photo
//   mango   calamansi, Add and Send
//   wash    lilac, quiet fills in the sheets

const serif = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  variable: "--font-serif",
  display: "swap",
});


export type Section = { id: string; name: string; dishIds: string[] };

/**
 * The categories in order. A dish in no category still shows, in a last
 * "More dishes"; a menu with no categories at all is one plain run.
 */
export function sectionsOf(menu: Menu): Section[] {
  const placed = new Set(menu.categories.flatMap((c) => c.dishIds));
  const loose = menu.dishOrder.filter((id) => !placed.has(id));
  const sections: Section[] = menu.categories.map((c) => ({ id: c.id, name: c.name, dishIds: c.dishIds }));
  if (loose.length) sections.push({ id: "more", name: sections.length ? "More dishes" : "Menu", dishIds: loose });
  return sections;
}

/** One screen of the feed: a dish, the category it is shown under, and where it sits in it. */
type Slide = { key: string; dish: Dish; section: Section; pos: number };

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
  indexOpen,
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
  /** The dish whose details are open (?d=). */
  dish: Dish | undefined;
  orderOpen: boolean;
  /** The index sheet (?i=1). */
  indexOpen: boolean;
  onDish: (id: string) => void;
  /** Add on a dish screen: straight in, or the details when a size must be picked. */
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
    // The cover's colour: ube, or the restaurant's palette when it picked one.
    const forest = getComputedStyle(document.querySelector(".theme-ube") ?? document.documentElement).getPropertyValue("--forest").trim();
    meta.content = forest ? `rgb(${forest.replaceAll(" ", ",")})` : "#3D2358";
    return () => {
      meta.content = before;
    };
  }, []);

  const sections = useMemo(() => sectionsOf(menu), [menu]);
  const slides = useMemo<Slide[]>(
    () =>
      sections.flatMap((s) =>
        s.dishIds.map((id, i) => ({ key: `${s.id}:${id}`, dish: menu.dishes[id], section: s, pos: i + 1 }))
      ),
    [sections, menu]
  );

  const inOrder = (id: string) => lines.reduce((n, l) => n + (l.dish.id === id ? l.qty : 0), 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);

  const feedRef = useRef<HTMLDivElement>(null);
  // -1 is the cover; otherwise the slide on screen.
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root: feed, threshold: 0.6 }
    );
    feed.querySelectorAll("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slides]);

  /**
   * Bring a slide (or the cover, -1) to the screen. Straight there, not a
   * smooth scroll: that would flash every dish photo in between.
   */
  const jumpTo = (i: number) => {
    const el = feedRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    if (el) feedRef.current!.scrollTo({ top: el.offsetTop });
  };

  const openIndex = () => setParams((p) => p.set("i", "1"), "push");
  const pickFromIndex = (i: number) => {
    closeParam("i");
    jumpTo(i);
  };

  // Desktop: arrow keys and Page Up/Down work once the feed has focus.
  useEffect(() => feedRef.current?.focus({ preventScroll: true }), []);

  // Desktop: one notch of the mouse wheel turns to the next dish (the snap
  // alone springs back from a small turn). Touch scrolling is left alone.
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    let lockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      // ponytail: fixed 650 ms lock per turn; a trackpad's long fling turns one dish, not several.
      if (Date.now() < lockedUntil || Math.abs(e.deltaY) < 4) return;
      lockedUntil = Date.now() + 650;
      feed.scrollBy({ top: Math.sign(e.deltaY) * feed.clientHeight, behavior: "smooth" });
    };
    feed.addEventListener("wheel", onWheel, { passive: false });
    return () => feed.removeEventListener("wheel", onWheel);
  }, []);

  const slide = current >= 0 ? slides[current] : null;

  return (
    <div className={`${serif.variable} theme-ube fixed inset-0 bg-[#1b1024] text-white`}>
      <div className="relative mx-auto h-full max-w-[520px]">
        <div
          ref={feedRef}
          tabIndex={-1}
          aria-label="Menu, one dish per screen"
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none"
        >
          <Cover
            menu={menu}
            sections={sections}
            slides={slides}
            nickname={nickname}
            onNickname={onNickname}
            onSearch={openIndex}
            onJump={jumpTo}
          />
          {slides.map((s, i) => (
            <DishScreen
              key={s.key}
              index={i}
              slide={s}
              eager={i < 2}
              count={inOrder(s.dish.id)}
              onAdd={() => onQuickAdd(s.dish.id)}
              onDetails={() => onDish(s.dish.id)}
            />
          ))}
          {slides.length > 0 && <EndScreen onTop={() => jumpTo(-1)} onOrder={onOrder} count={count} />}
        </div>

        <TopBar
          slide={slide}
          of={slide ? slide.section.dishIds.length : 0}
          count={count}
          total={total}
          sent={sent}
          calling={calling}
          onIndex={current >= 0 ? openIndex : undefined}
          onCall={onCall}
          onOrder={onOrder}
        />
      </div>

      <Sheet open={!!dish} onClose={onCloseDish} from="bottom" half label={dish?.name ?? "Dish"}>
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

      <Sheet open={indexOpen} onClose={() => closeParam("i")} from="bottom" label="Menu index">
        <IndexSheet menu={menu} sections={sections} slides={slides} onPick={pickFromIndex} onClose={() => closeParam("i")} />
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

/**
 * The bar over the top of every screen: where you are on the left (a dish
 * screen only), then the index, the call button and the order. It stays put
 * while the dishes slide under it.
 */
function TopBar({
  slide,
  of,
  count,
  total,
  sent,
  calling,
  onIndex,
  onCall,
  onOrder,
}: {
  slide: Slide | null;
  of: number;
  count: number;
  total: number;
  sent: GuestOrders | null;
  calling: boolean;
  /** Missing on the cover, which is the index. */
  onIndex?: () => void;
  onCall?: () => void;
  onOrder: () => void;
}) {
  const hasSent = !!sent && sent.batches.length > 0;
  const round = "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/35 text-white ring-1 ring-white/25 backdrop-blur-md active:bg-black/50";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-[env(safe-area-inset-top)]">
      <div className="flex h-16 items-center gap-2 px-4">
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]" aria-live="polite">
          {slide && (
            <>
              {slide.section.name}
              <span className="font-normal text-white/75">
                {" "}
                {slide.pos} of {of}
              </span>
            </>
          )}
        </p>
        <div className="pointer-events-auto flex items-center gap-2">
          {onIndex && (
            <button type="button" onClick={onIndex} aria-label="Menu index and search" className={round}>
              <MenuIcon width={20} height={20} />
            </button>
          )}
          {onCall && (
            <button
              type="button"
              onClick={onCall}
              aria-label={calling ? "Call your waiter, a call is waiting" : "Call your waiter or ask for the bill"}
              className={`relative ${round}`}
            >
              <BellIcon width={20} height={20} />
              {calling && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-mango ring-2 ring-black/40" aria-hidden />}
            </button>
          )}
          <button
            type="button"
            onClick={onOrder}
            aria-label={count ? `Your order, ${count} items, ${formatPrice(total)}` : hasSent ? "Your sent orders" : "Your order"}
            className={
              count
                ? "flex h-11 items-center gap-2 rounded-full bg-mango pl-1.5 pr-4 text-ink shadow-[0_6px_18px_rgb(0_0_0/0.35)] active:brightness-95"
                : round
            }
          >
            {count ? (
              <>
                <span className="grid h-8 min-w-8 place-items-center rounded-full bg-ink px-1.5 text-[14px] font-bold text-mango">{count}</span>
                <span className="text-[15px] font-bold">{formatPrice(total)}</span>
              </>
            ) : (
              <BagIcon width={20} height={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The first screen: the restaurant, who is ordering, a search box, and every
 * category as a row that jumps to its first dish. It stops a little short of
 * the bottom so the first dish shows below it, a hint to swipe.
 */
function Cover({
  menu,
  sections,
  slides,
  nickname,
  onNickname,
  onSearch,
  onJump,
}: {
  menu: Menu;
  sections: Section[];
  slides: Slide[];
  nickname: string;
  onNickname?: () => void;
  onSearch: () => void;
  onJump: (i: number) => void;
}) {
  return (
    <section data-i={-1} aria-labelledby="cover-name" className="min-h-[calc(100%-88px)] snap-start bg-forest px-5 pb-8 pt-[calc(76px+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3.5">
        {menu.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={menu.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1" />
        )}
        <div className="min-w-0">
          <h1 id="cover-name" className="font-display text-[clamp(36px,11vw,48px)] font-semibold leading-[1.02] tracking-[-0.02em] [overflow-wrap:anywhere]">
            {menu.businessName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/75">
            {menu.tableLabel && <span>{menu.tableLabel}</span>}
            {onNickname && (
              <button type="button" onClick={onNickname} className="flex h-9 items-center rounded-full bg-white/15 px-3 font-medium text-white active:bg-white/25">
                {nickname ? `Hi ${nickname}` : "Add your name"}
              </button>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="mt-7 flex h-12 w-full items-center gap-3 rounded-2xl bg-white/10 px-4 text-left text-[16px] text-white/70 ring-1 ring-white/20 active:bg-white/20"
      >
        <SearchIcon width={20} height={20} />
        Find a dish
      </button>

      {sections.length > 1 && (
        <nav aria-label="Categories" className="mt-6">
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {sections.map((s) => {
              const first = slides.findIndex((x) => x.section.id === s.id);
              const photo = s.dishIds.map((id) => menu.dishes[id].imageUrl).find(Boolean);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => onJump(first)} className="flex min-h-[68px] w-full items-center gap-3.5 py-2 text-left active:bg-white/5">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 font-display text-[22px] font-semibold leading-tight">{s.name}</span>
                    <span className="shrink-0 text-[14px] text-white/60">{s.dishIds.length}</span>
                    <ChevronRight width={18} height={18} className="shrink-0 text-white/50" />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {slides.length > 0 && (
        <button type="button" onClick={() => onJump(0)} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white/80 active:bg-white/10">
          Swipe up for the first dish
        </button>
      )}
    </section>
  );
}

/**
 * One dish, filling the screen: the photo behind, and over a dark fade at
 * the foot its tags, name, a line on it, what it feeds, its heat and price,
 * then Add and Details. No photo: the name stands on ube instead.
 */
function DishScreen({
  index,
  slide,
  eager,
  count,
  onAdd,
  onDetails,
}: {
  index: number;
  slide: Slide;
  eager: boolean;
  count: number;
  onAdd: () => void;
  onDetails: () => void;
}) {
  const { dish } = slide;
  const tags = [dish.featured && "Today's pick", dish.bestSeller && "Best seller", dish.isNew && "New"].filter(Boolean) as string[];
  const needsPick = mustPick(dish);
  return (
    <article data-i={index} aria-label={dish.name} className="relative h-full snap-start snap-always overflow-hidden bg-forest">
      {dish.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.imageUrl}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${dish.available ? "" : "grayscale"}`}
        />
      )}
      {dish.imageUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(20_10_28/0.55)_0%,rgb(20_10_28/0)_18%,rgb(20_10_28/0)_42%,rgb(20_10_28/0.92)_78%)]"
        />
      )}

      {/* No photo: the name fills the space the photo would, set large in the serif. */}
      {!dish.imageUrl && (
        <div className="absolute inset-x-0 top-[calc(96px+env(safe-area-inset-top))] px-6">
          <p
            aria-hidden
            className="font-display text-[clamp(56px,17vw,88px)] font-semibold italic leading-[0.95] tracking-[-0.03em] text-white/90 [overflow-wrap:anywhere]"
          >
            {dish.name}
          </p>
          {dish.description && <p className="mt-6 line-clamp-6 text-[17px] leading-relaxed text-white/75">{dish.description}</p>}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        {(tags.length > 0 || count > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {count > 0 && (
              <span className="flex h-7 items-center gap-1 rounded-full bg-mango px-2.5 text-[13px] font-bold text-ink">
                <CheckIcon width={15} height={15} />
                {count} in your order
              </span>
            )}
            {tags.map((t) => (
              <span key={t} className="flex h-7 items-center rounded-full bg-white/15 px-2.5 text-[13px] font-semibold backdrop-blur-md">
                {t}
              </span>
            ))}
          </div>
        )}
        <h2
          className={`font-display text-[clamp(34px,10vw,46px)] font-semibold leading-[1.02] tracking-[-0.02em] [overflow-wrap:anywhere] ${
            dish.imageUrl ? "" : "sr-only"
          }`}
        >
          {dish.name}
        </h2>
        {dish.shortDescription && <p className="mt-2 text-[16px] leading-snug text-white/85">{dish.shortDescription}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/85">
          <span className="font-display text-[26px] font-semibold text-white">{formatPrice(dish.priceCents)}</span>
          <span className="flex items-center gap-1.5">
            <PeopleIcon width={17} height={17} />
            {servesLabel(dish.servesMin, dish.servesMax)}
          </span>
          {!!dish.spiceLevel && (
            <span className="flex text-[#ff7a5c]" role="img" aria-label={`Spice level ${dish.spiceLevel} of 5`}>
              {Array.from({ length: dish.spiceLevel }, (_, i) => (
                <ChiliIcon key={i} lit width={17} height={17} />
              ))}
            </span>
          )}
        </p>

        <div className="mt-5 flex gap-2.5">
          {dish.available ? (
            <button
              type="button"
              onClick={onAdd}
              className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-mango px-4 text-[17px] font-bold text-ink active:brightness-95"
            >
              {needsPick ? (
                <span className="truncate">Choose a {missingPick(dish, startPicks(dish)) ?? "size"}</span>
              ) : (
                <>
                  <PlusIcon width={20} height={20} strokeWidth={2.4} />
                  Add to order
                </>
              )}
            </button>
          ) : (
            <p className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white/15 text-[16px] font-semibold">Not available today</p>
          )}
          <button
            type="button"
            onClick={onDetails}
            className="h-14 shrink-0 rounded-2xl bg-white/15 px-5 text-[16px] font-semibold ring-1 ring-inset ring-white/40 backdrop-blur-md active:bg-white/25"
          >
            Details
          </button>
        </div>
      </div>
    </article>
  );
}

/** After the last dish: back to the top, or on to the order. */
function EndScreen({ onTop, onOrder, count }: { onTop: () => void; onOrder: () => void; count: number }) {
  return (
    <section className="flex h-[60%] snap-end flex-col items-center justify-center gap-3 bg-forest px-8 text-center">
      <p className="font-display text-[28px] font-semibold">That&apos;s the whole menu</p>
      {count > 0 && (
        <button type="button" onClick={onOrder} className="h-12 rounded-2xl bg-mango px-6 text-[16px] font-bold text-ink active:brightness-95">
          See your order
        </button>
      )}
      <button type="button" onClick={onTop} className="h-12 rounded-2xl px-6 text-[16px] font-semibold text-white/80 ring-1 ring-inset ring-white/30 active:bg-white/10">
        Back to the top
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Every dish as a row, by category, with a search box and a row of the
 * categories on top. A category scrolls the list to its section, and the one
 * in view stays lit as the list scrolls. Picking a dish goes to its screen.
 */
function IndexSheet({
  menu,
  sections,
  slides,
  onPick,
  onClose,
}: {
  menu: Menu;
  sections: Section[];
  slides: Slide[];
  onPick: (i: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const needle = fold(q.trim());
  const match = (d: Dish) => !needle || fold(d.name).includes(needle) || fold(d.shortDescription).includes(needle);
  const shown = sections
    .map((s) => ({ s, ids: s.dishIds.filter((id) => match(menu.dishes[id])) }))
    .filter((x) => x.ids.length > 0);

  const listRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(shown[0]?.s.id ?? "");
  // While a tapped category's scroll runs, the sections it passes must not light up in turn.
  const jumping = useRef(false);

  // The section at the top of the list lights its category.
  const onListScroll = () => {
    const list = listRef.current;
    if (!list || jumping.current) return;
    const top = list.getBoundingClientRect().top + 8;
    let current = shown[0]?.s.id ?? "";
    for (const { s } of shown) {
      const el = list.querySelector<HTMLElement>(`[data-sec="${s.id}"]`);
      if (el && el.getBoundingClientRect().top <= top) current = s.id;
    }
    setActive(current);
  };

  // Keep the lit category in sight in its row.
  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (row && tab) row.scrollTo({ left: tab.offsetLeft - row.clientWidth / 2 + tab.offsetWidth / 2, behavior: "smooth" });
  }, [active]);

  // A search changes which sections there are: start from the first.
  useEffect(() => {
    setActive(shown[0]?.s.id ?? "");
    listRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

  const showSection = (id: string) => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-sec="${id}"]`);
    if (!list || !el) return;
    setActive(id);
    jumping.current = true;
    const done = () => {
      jumping.current = false;
      list.removeEventListener("scrollend", done);
    };
    list.addEventListener("scrollend", done);
    setTimeout(done, 800); // no scrollend event, or nothing to scroll
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: el.offsetTop, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div className="flex h-full flex-col text-ink">
      <div className="shrink-0 px-5 pb-3 pt-[calc(16px+env(safe-area-inset-top))] sm:pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[30px] font-semibold leading-tight">Menu</h2>
          <button type="button" onClick={onClose} aria-label="Close the index" className="grid h-11 w-11 place-items-center rounded-full bg-wash active:bg-line">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">Find a dish</span>
          <SearchIcon width={19} height={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Dish name or ingredient"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full rounded-2xl bg-wash pl-10 pr-3 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-forest/30 [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        {shown.length > 1 && (
          <div ref={tabsRef} role="group" aria-label="Categories" className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
            {shown.map(({ s }) => {
              const on = s.id === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-tab={s.id}
                  aria-pressed={on}
                  onClick={() => showSection(s.id)}
                  className={`h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold transition-colors ${
                    on ? "bg-forest text-white" : "bg-wash text-ink active:bg-line"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div
        ref={listRef}
        onScroll={onListScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
      >
        {shown.length === 0 ? (
          <p className="pt-6 text-center text-[15px] text-muted">No dishes match &ldquo;{q.trim()}&rdquo;. Try another word.</p>
        ) : (
          shown.map(({ s, ids }) => (
            <section key={s.id} data-sec={s.id} aria-label={s.name} className="pt-4">
              <h3 className="font-display text-[20px] font-semibold">{s.name}</h3>
              <ul className="mt-1 divide-y divide-line">
                {ids.map((id) => {
                  const d = menu.dishes[id];
                  const i = slides.findIndex((x) => x.section.id === s.id && x.dish.id === id);
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => onPick(i)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-wash">
                        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-wash">
                          {d.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.imageUrl} alt="" loading="lazy" className={`h-full w-full object-cover ${d.available ? "" : "grayscale"}`} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[16px] font-semibold">{d.name}</span>
                          <span className="block truncate text-[13px] text-muted">{d.available ? d.shortDescription : "Not available today"}</span>
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold">{formatPrice(d.priceCents)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Details and choices for one dish, in a half sheet over its screen: what it
 * is and what's in it, sizes, set meal picks, add-ons and spice behind one
 * line, how many, and Add pinned at the foot.
 */
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
    <div className="flex max-h-[85dvh] flex-col text-ink">
      <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3">
        <div className="min-w-0">
          <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.01em]">{dish.name}</h2>
          <p className="mt-0.5 font-display text-[20px] font-semibold text-forest">{formatPrice(dish.priceCents)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash active:bg-line">
          <CloseIcon width={20} height={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        <div className="mt-3 flex flex-wrap gap-2">
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

      <div className="shrink-0 border-t border-line bg-white px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        {inOrder > 0 && (
          <p className="mb-2 text-center text-[13px] text-muted" aria-live="polite">
            {inOrder} already in your order
          </p>
        )}
        <div className="flex gap-2.5">
          {dish.available && (
            <div className="flex h-14 shrink-0 items-center rounded-2xl bg-wash" role="group" aria-label="How many">
              <button
                type="button"
                disabled={n <= 1}
                onClick={() => setN(n - 1)}
                aria-label="One less"
                className="grid h-14 w-12 place-items-center rounded-2xl active:bg-line disabled:text-muted/50"
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
                className="grid h-14 w-12 place-items-center rounded-2xl active:bg-line disabled:text-muted/50"
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
              onClose();
            }}
            className="flex h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-mango px-5 text-[17px] font-bold text-ink active:brightness-95 disabled:justify-center disabled:bg-wash disabled:text-muted"
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
    </div>
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
