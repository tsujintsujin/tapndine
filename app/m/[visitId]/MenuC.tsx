"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
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
import { BagIcon, BellIcon, CheckIcon, CloseIcon, MinusIcon, PeopleIcon, PlusIcon, SearchIcon } from "@/app/components/Icons";
import type { Notes, OrderLine } from "./MenuApp";
import { sectionsOf, type Section } from "./MenuB";
import Sheet from "./Sheet";
import { DishImage, SpiceMeter } from "./parts";

// ---------------------------------------------------------------------------
// Design C, the split menu: one screen in two columns, the categories down
// the left and every dish in a list on the right, with a counter on each
// row. No home page. The header holds search and the waiter; the bar at the
// foot holds the order. Spec: .claude/design-c/SPEC.md.
//
// All the ordering logic lives in MenuApp; this file only draws it. The
// colours are the .theme-c tokens in globals.css (forest navy, mango coral),
// replaced by the restaurant's palette when it picked one.

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-c", display: "swap" });

export default function MenuC({
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
  /** The dish whose details are open (?d=). */
  dish: Dish | undefined;
  orderOpen: boolean;
  onDish: (id: string) => void;
  /** + on a row: straight in, or the choices when a size must be picked. */
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
  // The phone's status bar matches the header: navy, or the picked palette.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const before = meta.content;
    const forest = getComputedStyle(document.querySelector(".theme-c") ?? document.documentElement).getPropertyValue("--forest").trim();
    meta.content = forest ? `rgb(${forest.replaceAll(" ", ",")})` : "#163A5F";
    return () => {
      meta.content = before;
    };
  }, []);

  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const needle = fold(q.trim());

  const all = useMemo(() => sectionsOf(menu), [menu]);
  const sections = useMemo<Section[]>(
    () =>
      needle
        ? all
            .map((s) => ({
              ...s,
              dishIds: s.dishIds.filter((id) => {
                const d = menu.dishes[id];
                return fold(d.name).includes(needle) || fold(d.shortDescription).includes(needle);
              }),
            }))
            .filter((s) => s.dishIds.length > 0)
        : all,
    [all, needle, menu]
  );

  const qtyOf = (id: string) => lines.reduce((n, l) => n + (l.dish.id === id ? l.qty : 0), 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);

  /** − on a row: one off its line; with the dish in the order under different picks, the order opens to choose which. */
  const less = (id: string) => {
    const mine = lines.filter((l) => l.dish.id === id);
    if (mine.length === 1) setQty(mine[0].key, mine[0].qty - 1);
    else onOrder();
  };

  const listRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(sections[0]?.id ?? "");
  // While a tapped category's scroll runs, the sections it passes must not light up in turn.
  const jumping = useRef(false);

  const onListScroll = () => {
    const list = listRef.current;
    if (!list || jumping.current) return;
    const top = list.getBoundingClientRect().top + 4;
    let current = sections[0]?.id ?? "";
    for (const s of sections) {
      const el = list.querySelector<HTMLElement>(`[data-sec="${s.id}"]`);
      if (el && el.getBoundingClientRect().top <= top) current = s.id;
    }
    setActive(current);
  };

  // Keep the lit category in view in its column.
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (!rail || !item) return;
    if (item.offsetTop < rail.scrollTop || item.offsetTop + item.offsetHeight > rail.scrollTop + rail.clientHeight) {
      rail.scrollTo({ top: item.offsetTop - rail.clientHeight / 3, behavior: "smooth" });
    }
  }, [active]);

  // A search changes which sections there are: start again from the first.
  useEffect(() => {
    setActive(sections[0]?.id ?? "");
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
    setTimeout(done, 900); // no scrollend event, or nothing to scroll
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: el.offsetTop, behavior: smooth ? "smooth" : "auto" });
  };

  const inCategory = (s: Section) => s.dishIds.reduce((n, id) => n + qtyOf(id), 0);
  const hasSent = !!sent && sent.batches.length > 0;

  return (
    <div className={`${sans.variable} theme-c fixed inset-0 bg-wash text-ink`}>
      <div className="mx-auto flex h-full max-w-[960px] flex-col bg-white md:shadow-[0_0_0_1px_rgb(var(--line))]">
        <header className="shrink-0 bg-forest pt-[env(safe-area-inset-top)] text-white">
          <div className="flex h-[68px] items-center gap-3 px-4">
            {menu.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={menu.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[19px] font-extrabold leading-tight tracking-[-0.01em]">{menu.businessName}</h1>
              {(menu.tableLabel || onNickname) && (
                <div className="flex min-h-6 items-center gap-2 text-[13px] text-white/75">
                  {menu.tableLabel && <span className="shrink-0">{menu.tableLabel}</span>}
                  {onNickname && (
                    <button type="button" onClick={onNickname} className="-my-1 min-h-8 truncate rounded-md px-1 font-semibold text-white underline decoration-white/40 underline-offset-2 active:bg-white/10">
                      {nickname ? `Hi ${nickname}` : "Add your name"}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => (searching ? (setSearching(false), setQ("")) : setSearching(true))}
              aria-label={searching ? "Close search" : "Search the menu"}
              aria-expanded={searching}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10 active:bg-white/20"
            >
              {searching ? <CloseIcon width={20} height={20} /> : <SearchIcon width={20} height={20} />}
            </button>
            {onCall && (
              <button
                type="button"
                onClick={onCall}
                aria-label={calling ? "Call your waiter, a call is waiting" : "Call your waiter or ask for the bill"}
                className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-mango px-3 text-[15px] font-bold text-ink active:brightness-95"
              >
                <BellIcon width={18} height={18} />
                Waiter
                {calling && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white ring-2 ring-forest" aria-hidden />}
              </button>
            )}
          </div>
          {searching && (
            <div className="px-4 pb-3">
              <label className="relative block">
                <span className="sr-only">Search the menu</span>
                <SearchIcon width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && (setSearching(false), setQ(""))}
                  placeholder="Dish name or ingredient"
                  enterKeyHint="search"
                  autoComplete="off"
                  className="h-11 w-full rounded-lg bg-white pl-10 pr-3 text-[16px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-mango [&::-webkit-search-cancel-button]:hidden"
                />
              </label>
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          {sections.length > 1 && (
            <nav ref={railRef} aria-label="Categories" className="no-scrollbar relative w-[92px] shrink-0 overflow-y-auto bg-wash md:w-[160px]">
              {sections.map((s) => {
                const on = s.id === active;
                const n = inCategory(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-cat={s.id}
                    aria-current={on ? "true" : undefined}
                    onClick={() => showSection(s.id)}
                    className={`relative flex min-h-[60px] w-full flex-col items-start justify-center gap-1 px-2.5 py-2 text-left text-[13px] font-semibold leading-tight md:px-4 md:text-[15px] ${
                      on ? "bg-white text-forest" : "text-muted active:bg-white/60"
                    }`}
                  >
                    {on && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-forest" />}
                    <span className="[overflow-wrap:anywhere]">{s.name}</span>
                    {n > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-mango px-1 text-[11px] font-bold text-ink">
                        <span className="sr-only">, in your order: </span>
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          <div ref={listRef} onScroll={onListScroll} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {sections.length === 0 ? (
              <p className="px-6 pt-10 text-center text-[15px] text-muted">No dishes match &ldquo;{q.trim()}&rdquo;. Try another word.</p>
            ) : (
              sections.map((s) => (
                <section key={s.id} data-sec={s.id} aria-labelledby={`c-sec-${s.id}`}>
                  <h2
                    id={`c-sec-${s.id}`}
                    className="sticky top-0 z-[1] border-b border-line bg-white/95 px-3 py-2.5 font-display text-[15px] font-extrabold backdrop-blur md:px-5"
                  >
                    {s.name}
                  </h2>
                  <ul className="px-3 md:grid md:grid-cols-2 md:gap-x-6 md:px-5">
                    {s.dishIds.map((id) => (
                      <li key={id} className="border-b border-line">
                        <Row
                          dish={menu.dishes[id]}
                          qty={qtyOf(id)}
                          onOpen={() => onDish(id)}
                          onMore={() => onQuickAdd(id)}
                          onLess={() => less(id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
            <div className="h-6" />
          </div>
        </div>

        <button
          type="button"
          onClick={onOrder}
          className="flex shrink-0 items-center gap-3 bg-forest px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 text-left text-white active:bg-forest-soft"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
            <BagIcon width={20} height={20} />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-mango px-1 text-[11px] font-bold text-ink">{count}</span>
            )}
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold">
            {count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : hasSent ? "Sent orders" : <span className="font-normal text-white/70">Tap + to add dishes</span>}
          </span>
          {(count > 0 || hasSent) && (
            <span className="shrink-0 text-right leading-tight">
              <span className="block font-display text-[18px] font-extrabold">{formatPrice(count > 0 ? total : sent!.subtotal)}</span>
              <span className="block text-[12px] font-semibold text-mango">{count > 0 ? "Review" : "See them"}</span>
            </span>
          )}
        </button>
      </div>

      <Sheet open={!!dish} onClose={onCloseDish} from="bottom" half label={dish?.name ?? "Dish"}>
        {dish && (
          <DishSheet key={dish.id} dish={dish} inOrder={qtyOf(dish.id)} onAdd={(n, picks) => onAdd(dish.id, n, picks)} onClose={onCloseDish} />
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

/**
 * One dish: photo on the left, name, a line on it and its tags, then the
 * price and the counter. The photo and name open the details.
 */
function Row({ dish, qty, onOpen, onMore, onLess }: { dish: Dish; qty: number; onOpen: () => void; onMore: () => void; onLess: () => void }) {
  const tags = [dish.bestSeller && "Best seller", dish.isNew && "New"].filter(Boolean) as string[];
  const needsPick = mustPick(dish);
  return (
    <article className="flex gap-3 py-3">
      <button type="button" onClick={onOpen} tabIndex={-1} aria-hidden className="shrink-0 self-start">
        <DishImage dish={dish} className="h-[76px] w-[76px] rounded-xl" soldOutLabel={false} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3>
          <button type="button" onClick={onOpen} className="text-left text-[15px] font-bold leading-snug">
            {dish.name}
          </button>
        </h3>
        {dish.shortDescription && <p className="line-clamp-2 text-[13px] leading-snug text-muted">{dish.shortDescription}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-0.5 text-[12px] text-muted">
            <PeopleIcon width={13} height={13} />
            {servesLabel(dish.servesMin, dish.servesMax).replace(/ (people|person)$/, "")}
          </span>
          {dish.available &&
            tags.map((t) => (
              <span key={t} className="rounded bg-mango-soft px-1.5 py-0.5 text-[11px] font-bold text-ink">
                {t}
              </span>
            ))}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="text-[15px] font-extrabold">{formatPrice(dish.priceCents)}</span>
          {!dish.available ? (
            <span className="text-[12px] font-semibold text-chili">Not available today</span>
          ) : qty > 0 ? (
            <span className="flex h-10 shrink-0 items-center rounded-lg bg-forest text-white" role="group" aria-label={`${dish.name}, ${qty} in your order`}>
              <button type="button" onClick={onLess} aria-label={`One less ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-lg active:bg-white/15">
                <MinusIcon width={18} height={18} />
              </button>
              <span className="w-5 text-center text-[15px] font-bold tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button type="button" onClick={onMore} aria-label={`One more ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-lg active:bg-white/15">
                <PlusIcon width={18} height={18} />
              </button>
            </span>
          ) : needsPick ? (
            <button type="button" onClick={onMore} className="h-10 shrink-0 rounded-lg border-2 border-forest px-3 text-[14px] font-bold text-forest active:bg-leaf-tint">
              Choose
            </button>
          ) : (
            <button
              type="button"
              onClick={onMore}
              aria-label={`Add ${dish.name} to order`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-forest text-forest active:bg-leaf-tint"
            >
              <PlusIcon width={20} height={20} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------

/**
 * Details and choices in a half sheet: photo and the facts at the top,
 * choices as a grid of buttons, add-ons and spice behind one line, what's in
 * it, then how many and Add.
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
  const [extrasOpen, setExtrasOpen] = useState(false);
  const picks = resolvePicks(dish, [...picked]);
  const ready = dish.available && picks !== null;
  const unit = dish.priceCents + extraCents(picks ?? []);
  const pick = (o: DishOption) => setPicked((prev) => togglePick(dish, prev, o));
  const extrasTitle = addons.length && spices.length ? "Add-ons and spice" : addons.length ? "Add-ons" : "Spice";
  const chosenExtras = [...addons, ...spices]
    .filter((o) => picked.has(o.id))
    .map((o) => o.name)
    .join(", ");

  return (
    <div className="flex max-h-[85dvh] flex-col text-ink">
      <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-3">
        <div className="flex gap-3">
          <DishImage dish={dish} eager className="h-24 w-24 shrink-0 rounded-xl" soldOutLabel={false} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.01em]">{dish.name}</h2>
            <p className="mt-0.5 text-[17px] font-bold">{formatPrice(dish.priceCents)}</p>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
              <PeopleIcon width={15} height={15} />
              Serves {servesLabel(dish.servesMin, dish.servesMax)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-wash active:bg-line">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        {dish.spiceLevel !== null && (
          <div className="mt-3">
            <SpiceMeter level={dish.spiceLevel} />
          </div>
        )}
        {dish.description && <p className="mt-3 text-[15px] leading-relaxed">{dish.description}</p>}

        {sizes.length > 0 && <Grid title="Size" required={dish.sizeRequired} options={sizes} picked={picked} onPick={pick} round />}
        {/* Set meals: one pick from each list ("Drink", "Side"), always required. */}
        {lists.map((l) => (
          <Grid key={l.name} title={l.name} required options={l.options} picked={picked} onPick={pick} round />
        ))}

        {addons.length + spices.length > 0 && (
          <div className="mt-5 rounded-xl border border-line">
            <button type="button" aria-expanded={extrasOpen} onClick={() => setExtrasOpen(!extrasOpen)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-forest text-white" aria-hidden>
                {extrasOpen ? <MinusIcon width={16} height={16} /> : <PlusIcon width={16} height={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{extrasTitle}</span>
                {chosenExtras && <span className="block text-[13px] text-muted">{chosenExtras}</span>}
              </span>
            </button>
            {extrasOpen && (
              <div className="border-t border-line px-3 pb-3">
                {addons.length > 0 && <Grid title="Add-ons" options={addons} picked={picked} onPick={pick} round={false} small />}
                {spices.length > 0 && <Grid title="Spice" options={spices} picked={picked} onPick={pick} round small />}
              </div>
            )}
          </div>
        )}

        {dish.ingredients.length > 0 && (
          <p className="mt-5 text-[14px] leading-relaxed text-muted">
            <span className="font-bold text-ink">What&apos;s in it: </span>
            {dish.ingredients.map((i) => i.name).join(", ")}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        {inOrder > 0 && <p className="mb-2 text-center text-[13px] text-muted">{inOrder} already in your order</p>}
        <div className="flex gap-2.5">
          {dish.available && (
            <div className="flex h-12 shrink-0 items-center rounded-lg border-2 border-line" role="group" aria-label="How many">
              <button type="button" disabled={n <= 1} onClick={() => setN(n - 1)} aria-label="One less" className="grid h-full w-11 place-items-center active:bg-wash disabled:text-muted/50">
                <MinusIcon width={18} height={18} />
              </button>
              <span className="w-6 text-center text-[16px] font-bold tabular-nums" aria-live="polite">
                {n}
              </span>
              <button type="button" disabled={n >= 20} onClick={() => setN(n + 1)} aria-label="One more" className="grid h-full w-11 place-items-center active:bg-wash disabled:text-muted/50">
                <PlusIcon width={18} height={18} />
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              onAdd(n, picks!);
              onClose();
            }}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-forest px-4 text-[16px] font-bold text-white active:bg-forest-soft disabled:bg-wash disabled:text-muted"
          >
            {!dish.available ? (
              "Not available today"
            ) : !picks ? (
              `Choose a ${missingPick(dish, picked) ?? "size"}`
            ) : (
              <>
                <span className="truncate">{n > 1 ? `Add ${n}` : "Add"}</span>
                <span className="shrink-0">· {formatPrice(unit * n)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Choices as a two-column grid of buttons: pick one (round) or any (not round). */
function Grid({
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
  small?: boolean;
}) {
  const done = options.some((o) => picked.has(o.id));
  return (
    <div role={round ? "radiogroup" : "group"} aria-label={title} className={small ? "mt-3" : "mt-5"}>
      <div className="flex items-center gap-2">
        <h3 className={small ? "text-[13px] font-bold text-muted" : "text-[16px] font-bold"}>{title}</h3>
        {required && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${done ? "bg-leaf-tint text-forest" : "bg-mango text-ink"}`}>{done ? "Picked" : "Required"}</span>
        )}
        <span className="ml-auto text-[12px] text-muted">{round ? "Pick 1" : "Pick any"}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = picked.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role={round ? "radio" : "checkbox"}
              aria-checked={on}
              onClick={() => onPick(o)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-center text-[14px] font-semibold leading-tight ${
                on ? "border-forest bg-leaf-tint text-forest" : "border-line bg-white active:bg-wash"
              }`}
            >
              <span className="flex items-center gap-1">
                {on && <CheckIcon width={14} height={14} />}
                {o.name}
              </span>
              {o.priceCents > 0 && <span className="text-[12px] font-medium text-muted">+{formatPrice(o.priceCents)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The order as a plain list to check over, then Send; what was sent before under it. */
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
    <div className="flex h-full flex-col text-ink">
      <div className="shrink-0 bg-forest pt-[env(safe-area-inset-top)] text-white sm:pt-0">
        <div className="flex h-14 items-center justify-between pl-4 pr-2">
          <h2 className="font-display text-[19px] font-extrabold">Your order</h2>
          <button type="button" onClick={onClose} aria-label="Close your order" className="grid h-11 w-11 place-items-center rounded-lg active:bg-white/10">
            <CloseIcon width={22} height={22} />
          </button>
        </div>
      </div>

      {lines.length === 0 && !hasSent ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <BagIcon width={36} height={36} className="text-muted/60" />
          <p className="mt-3 text-[17px] font-bold">Nothing added yet</p>
          <p className="mt-1 text-[15px] text-muted">Tap + next to a dish to add it.</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
            {lines.length > 0 && (
              <ul aria-label="Not sent yet">
                {lines.map(({ key, dish, label, unitCents, qty }, i) => (
                  <li key={key} className="border-b border-line py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-[15px] font-bold leading-snug">
                        <span className="tabular-nums">{qty}×</span> {dish.name}
                      </p>
                      <p className="shrink-0 text-[15px] font-semibold tabular-nums">{formatPrice(unitCents * qty)}</p>
                    </div>
                    {label && <p className="text-[13px] text-muted">{label}</p>}
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="flex h-9 items-center rounded-lg border border-line">
                        <button type="button" onClick={() => setQty(key, qty - 1)} aria-label={`One less ${dish.name}`} className="grid h-9 w-9 place-items-center rounded-lg active:bg-wash">
                          <MinusIcon width={16} height={16} />
                        </button>
                        <span className="w-5 text-center text-[14px] font-bold tabular-nums">{qty}</span>
                        <button type="button" onClick={() => setQty(key, qty + 1)} aria-label={`One more ${dish.name}`} className="grid h-9 w-9 place-items-center rounded-lg active:bg-wash">
                          <PlusIcon width={16} height={16} />
                        </button>
                      </span>
                      {canSend && <Note id={`note-c-${i}`} note={notes[key] ?? ""} onNote={(t) => setNote(key, t)} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {hasSent && (
              <section aria-label="Sent to your waiter" className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[15px] font-bold">Sent to your waiter</h3>
                  <span className="rounded bg-wash px-2 py-0.5 text-[12px] font-bold text-forest">{sent!.nickname ?? `Guest ${sent!.number}`}</span>
                </div>
                {sent!.batches.map((b) => (
                  <div key={b.id} className="mt-3 rounded-xl bg-wash px-3 py-2.5">
                    <p className="flex items-center justify-between gap-2 text-[13px] font-semibold">
                      <span>{formatTime(b.sentAt)}</span>
                      {b.seenAt ? (
                        <span className="flex items-center gap-1 text-forest">
                          <CheckIcon width={14} height={14} />
                          Your waiter has it
                        </span>
                      ) : (
                        <span className="text-muted">Waiting for your waiter</span>
                      )}
                    </p>
                    <ul className="mt-1">
                      {b.lines.map((l) => (
                        <li key={l.id} className="flex items-baseline justify-between gap-3 py-0.5 text-[14px]">
                          <span className="min-w-0">
                            <span className="font-semibold tabular-nums">{l.qty}×</span> {l.name}
                            {l.options && <span className="block text-[12px] text-muted">{l.options}</span>}
                            {l.note && <span className="block text-[12px] italic text-muted">“{l.note}”</span>}
                          </span>
                          <span className="shrink-0 text-muted">{formatPrice(l.priceCents * l.qty)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="mt-3 flex justify-between text-[15px] font-bold">
                  <span>Sent so far</span>
                  <span>{formatPrice(sent!.subtotal)}</span>
                </p>
              </section>
            )}
          </div>

          <div className="shrink-0 border-t border-line px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
            {lines.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[16px] font-semibold">{hasSent ? "To send" : "Total"}</span>
                  <span className="font-display text-[22px] font-extrabold">{formatPrice(total)}</span>
                </div>
                {canSend ? (
                  <>
                    <p className="mt-1 flex items-center justify-between gap-2 text-[13px] text-muted">
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
                        <button type="button" onClick={onNickname} className="-my-2 h-10 shrink-0 rounded-lg px-2 font-semibold text-forest active:bg-wash">
                          {nickname ? "Change" : "Add name"}
                        </button>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={onSend}
                      disabled={sending}
                      className="mt-2.5 flex h-12 w-full items-center justify-center rounded-lg bg-mango text-[16px] font-extrabold text-ink active:brightness-95 disabled:opacity-60"
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
                    This is a demo menu. In a restaurant with tappetite, Send to waiter goes right here and your order lands
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
                  <span className="text-[16px] font-semibold">Your total so far</span>
                  <span className="font-display text-[22px] font-extrabold">{formatPrice(sent!.subtotal)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">Want more? Add dishes, then send again.</p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** "Note" next to a line's counter; it opens a labelled box. The note goes to the waiter with the dish. */
function Note({ id, note, onNote }: { id: string; note: string; onNote: (t: string) => void }) {
  const [open, setOpen] = useState(note !== "");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 items-center gap-1 rounded-lg px-1.5 text-[13px] font-semibold text-forest active:bg-wash">
        <PlusIcon width={14} height={14} />
        Note
      </button>
    );
  }
  return (
    <span className="min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
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
        placeholder="Note: no egg, less spicy"
        className="block h-9 w-full rounded-lg border border-line bg-white px-2.5 text-[16px] outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
      />
    </span>
  );
}
