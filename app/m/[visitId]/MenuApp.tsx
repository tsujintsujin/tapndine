"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BASE_PATH } from "@/lib/base";
import type { Category, Dish, Menu } from "@/lib/menu";
import type { GuestOrders } from "@/lib/orders";
import { formatPrice, formatTime, servesLabel } from "@/lib/format";
import { randomId } from "@/lib/ids";
import Expired from "@/app/components/Expired";
import {
  BagIcon,
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  HomeIcon,
  INGREDIENT_ICONS,
  INGREDIENT_LABELS,
  MenuIcon,
  MinusIcon,
  PeopleIcon,
  PlusIcon,
} from "@/app/components/Icons";
import Sheet from "./Sheet";
import { DishImage, SpiceMeter } from "./parts";

// ---------------------------------------------------------------------------
// Where the customer is lives in the URL (?c= category, ?d= dish, ?o= order,
// ?nav= menu list), pushed with history.pushState so the phone's Back button
// closes a sheet or leaves a category instead of leaving the menu.
// `pushed` counts the entries this page added, so a close button knows
// whether Back is safe or would leave the page.
let pushed = 0;

function setParams(mutate: (p: URLSearchParams) => void, mode: "push" | "replace") {
  const p = new URLSearchParams(window.location.search);
  mutate(p);
  const qs = p.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "");
  if (mode === "push") {
    pushed++;
    window.history.pushState(null, "", url);
  } else {
    window.history.replaceState(null, "", url);
  }
}

/** Undo the last thing opened: Back if we added it, otherwise drop the param. */
function closeParam(key: string) {
  if (pushed > 0) window.history.back();
  else setParams((p) => p.delete(key), "replace");
}

// ---------------------------------------------------------------------------
// The list being built lives on this phone until Send to waiter; then it is a
// batch on the server and the list starts empty again.

type Order = Record<string, number>;

function useOrder(visitId: string) {
  const key = `tapndine:order:${visitId}`;
  const [order, setOrder] = useState<Order>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // Private mode or blocked storage: the list just starts empty.
    }
  }, [key]);

  const update = useCallback(
    (fn: (o: Order) => Order) => {
      setOrder((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [key]
  );

  const setQty = useCallback(
    (id: string, qty: number) =>
      update((o) => {
        const next = { ...o };
        if (qty <= 0) delete next[id];
        else next[id] = qty;
        return next;
      }),
    [update]
  );

  const clear = useCallback(() => update(() => ({})), [update]);

  return { order, setQty, clear };
}

/** What this phone has already sent, from the server. */
function useSent(visitId: string, onDead: () => void) {
  const [sent, setSent] = useState<GuestOrders | null>(null);
  const deadRef = useRef(onDead);
  deadRef.current = onDead;

  const load = useCallback(() => {
    fetch(`${BASE_PATH}/api/visits/${visitId}/order`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 410) return deadRef.current();
        if (r.ok) setSent(((await r.json()) as { sent: GuestOrders | null }).sent);
      })
      .catch(() => {
        // Offline for a moment: keep what we last had.
      });
  }, [visitId]);

  useEffect(load, [load]);
  return { sent, setSent, load };
}

/**
 * The name this phone orders under, so the waiter sees "Jecery", not
 * "Guest 2". Asked once per phone and kept on it.
 * undefined: not read yet. null: never asked here. "": skipped.
 */
const NICK_KEY = "tapndine:nickname";

function useNickname() {
  const [nick, setNick] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    try {
      setNick(localStorage.getItem(NICK_KEY));
    } catch {
      // Blocked storage: don't ask on every visit with no way to remember.
      setNick("");
    }
  }, []);
  const save = useCallback((v: string) => {
    setNick(v);
    try {
      localStorage.setItem(NICK_KEY, v);
    } catch {}
  }, []);
  return { nick, save };
}

// ---------------------------------------------------------------------------
// A menu link lives 1 h 30 min from the first tap (or until a waiter clears
// the table). Shows the expired screen once the server says it is dead.

function useVisitAlive(visitId: string, expiresAt: number) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const check = () =>
      fetch(`${BASE_PATH}/api/visits/${visitId}/touch`, { method: "POST" })
        .then((r) => r.json() as Promise<{ alive: boolean }>)
        .then((j) => {
          if (!j.alive) setExpired(true);
        })
        .catch(() => {
          // Offline for a moment: leave the menu up and try again later.
        });

    // Ask the server rather than trusting the clock: it has the real expiry,
    // and a cleared table ends the link early.
    const timer = setTimeout(check, Math.min(Math.max(0, expiresAt - Date.now()) + 1000, 2 ** 31 - 1));
    const onVisible = () => {
      // Phone unlocked after a while: find out straight away.
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [visitId, expiresAt]);

  return { expired, expire: () => setExpired(true) };
}

// ---------------------------------------------------------------------------

export default function MenuApp({
  visitId,
  menu,
  expiresAt,
  canSend,
}: {
  visitId: string;
  menu: Menu;
  expiresAt: number;
  /** False for a tag not placed at a table: there is no waiter to send to. */
  canSend: boolean;
}) {
  const params = useSearchParams();
  const categoryId = params.get("c");
  const dishId = params.get("d");
  const orderOpen = params.get("o") === "1";
  const navOpen = params.get("nav") === "1";

  const { expired, expire } = useVisitAlive(visitId, expiresAt);
  const { order, setQty, clear } = useOrder(visitId);
  const { sent, setSent, load: loadSent } = useSent(visitId, expire);
  const { nick, save: saveNick } = useNickname();
  const [nickOpen, setNickOpen] = useState(false);

  // First menu on this phone: ask what to call them. Only where there is a
  // waiter to send to.
  useEffect(() => {
    if (canSend && nick === null) setNickOpen(true);
  }, [canSend, nick]);

  // Opening My order picks up anything the waiter changed since.
  useEffect(() => {
    if (orderOpen) loadSent();
  }, [orderOpen, loadSent]);

  useEffect(() => {
    const onPop = () => {
      pushed = Math.max(0, pushed - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const category = categoryId ? menu.categories.find((c) => c.id === categoryId) : undefined;
  const dish = dishId ? menu.dishes[dishId] : undefined;

  // Leaving home remembers where you were; coming back puts you there again.
  // Recorded while home is on screen, because by the time a category renders
  // the page has already been re-laid out and scrollY no longer means home.
  const homeScroll = useRef(0);
  const lastView = useRef<string | null>(null);
  const currentView = useRef<string | null>(null);
  currentView.current = category?.id ?? null;
  useEffect(() => {
    const onScroll = () => {
      // Both must say home: mid-switch, the scroll events are the new view's.
      if (currentView.current === null && lastView.current === null) {
        homeScroll.current = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    const view = category?.id ?? null;
    if (view === lastView.current) return;
    window.scrollTo(0, view === null ? homeScroll.current : 0);
    lastView.current = view;
  }, [category?.id]);

  const [toast, setToast] = useState<Toast | null>(null);
  const addOne = (id: string) => {
    setQty(id, (order[id] ?? 0) + 1);
    // A fresh key each time, so adding twice in a row shows it again.
    setToast({ key: Date.now(), title: "Added to order", detail: menu.dishes[id]?.name ?? "" });
  };

  // One key per list sent, so a double tap or a retry cannot send it twice.
  // Changing the list makes it a different send.
  const sendKey = useRef<string | null>(null);
  useEffect(() => {
    sendKey.current = null;
  }, [order]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const send = async () => {
    sendKey.current ??= randomId();
    setSending(true);
    setSendError("");
    try {
      const r = await fetch(`${BASE_PATH}/api/visits/${visitId}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: sendKey.current,
          items: Object.entries(order).map(([dishId, qty]) => ({ dishId, qty })),
          nickname: nick || null,
        }),
      });
      if (r.status === 410) return expire();
      const j = (await r.json().catch(() => ({}))) as { sent?: GuestOrders | null; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not send. Try again.");
      setSent(j.sent ?? null);
      clear();
      setToast({ key: Date.now(), title: "Sent to your waiter", detail: `${itemCount} ${itemCount === 1 ? "item" : "items"}` });
    } catch (e) {
      setSendError(e instanceof TypeError ? "No connection. Check your signal and try again." : (e as Error).message);
    } finally {
      setSending(false);
    }
  };
  const openDish = (id: string) => setParams((p) => p.set("d", id), "push");
  const openCategory = (id: string) => setParams((p) => p.set("c", id), "push");
  const goHome = () => {
    if (category) closeParam("c");
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const itemCount = Object.values(order).reduce((a, b) => a + b, 0);
  const orderTotal = Object.entries(order).reduce(
    (sum, [id, qty]) => sum + (menu.dishes[id]?.priceCents ?? 0) * qty,
    0
  );

  if (expired) return <Expired />;

  return (
    <>
      <Header
        businessName={menu.businessName}
        tableLabel={menu.tableLabel}
        itemCount={itemCount}
        onMenu={() => setParams((p) => p.set("nav", "1"), "push")}
        onHome={goHome}
        onOrder={() => setParams((p) => p.set("o", "1"), "push")}
      />

      <main className={itemCount > 0 ? "pb-28" : "pb-16"}>
        <div key={category?.id ?? "home"} className="view-in">
          {category ? (
            <CategoryView category={category} menu={menu} order={order} onDish={openDish} onAdd={addOne} onBack={() => closeParam("c")} />
          ) : (
            <HomeView menu={menu} order={order} onDish={openDish} onAdd={addOne} onCategory={openCategory} />
          )}
        </div>
      </main>

      <AddedToast toast={toast} lifted={itemCount > 0} onDone={() => setToast(null)} />

      {itemCount > 0 && (
        <OrderBar count={itemCount} total={orderTotal} onOpen={() => setParams((p) => p.set("o", "1"), "push")} />
      )}

      <Sheet open={navOpen} onClose={() => closeParam("nav")} from="left" label="Menu">
        <MenuList
          menu={menu}
          current={category?.id ?? null}
          onClose={() => closeParam("nav")}
          onPick={(id) =>
            // Swap the menu list for the choice, so Back skips the list.
            setParams((p) => {
              p.delete("nav");
              if (id) p.set("c", id);
              else p.delete("c");
            }, "replace")
          }
        />
      </Sheet>

      <Sheet open={!!dish} onClose={() => closeParam("d")} from="bottom" label={dish?.name ?? "Dish"}>
        {dish && (
          <DishDetails
            dish={dish}
            inOrder={order[dish.id] ?? 0}
            onAdd={() => addOne(dish.id)}
            onClose={() => closeParam("d")}
          />
        )}
      </Sheet>

      <Sheet open={orderOpen} onClose={() => closeParam("o")} from="right" label="My order">
        <OrderList
          menu={menu}
          order={order}
          setQty={setQty}
          sent={sent}
          canSend={canSend}
          sending={sending}
          sendError={sendError}
          onSend={send}
          nickname={nick || ""}
          onNickname={() => setNickOpen(true)}
          onClose={() => closeParam("o")}
        />
      </Sheet>

      <NicknamePrompt
        open={nickOpen}
        initial={nick || ""}
        onDone={(v) => {
          saveNick(v);
          setNickOpen(false);
        }}
      />
    </>
  );
}

/**
 * "What should we call you?" A small native dialog over the menu. Skip (or
 * Esc) keeps whatever name the phone had, or none: the waiter then sees Guest #.
 */
function NicknamePrompt({ open, initial, onDone }: { open: boolean; initial: string; onDone: (v: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setValue(initial);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, initial]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="nick-title"
      onCancel={(e) => {
        e.preventDefault();
        onDone(initial);
      }}
      className="m-auto w-[min(380px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(16_52_42/0.35)] backdrop:bg-forest/60"
    >
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(value.replace(/\s+/g, " ").trim());
        }}
      >
        <h2 id="nick-title" className="font-display text-[24px] font-bold leading-tight">
          What should we call you?
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">Your waiter sees this name on your orders, so they know whose food is whose.</p>
        <label className="mt-4 block text-[15px] font-medium">
          Nickname
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            enterKeyHint="done"
            placeholder="e.g. Jecery"
            className="mt-1.5 block h-12 w-full rounded-xl border border-line bg-white px-3 text-[17px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
          />
        </label>
        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-4 h-[52px] w-full rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-50"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => onDone(initial)}
          className="mt-1 h-11 w-full rounded-xl text-[15px] font-medium text-muted active:bg-wash"
        >
          {initial ? "Cancel" : "Skip"}
        </button>
      </form>
    </dialog>
  );
}


// ---------------------------------------------------------------------------

function Header({
  businessName,
  tableLabel,
  itemCount,
  onMenu,
  onHome,
  onOrder,
}: {
  businessName: string;
  tableLabel: string | null;
  itemCount: number;
  onMenu: () => void;
  onHome: () => void;
  onOrder: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-forest pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto grid h-14 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-2">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-11 items-center gap-1.5 justify-self-start rounded-lg px-2 text-[15px] font-medium active:bg-white/10"
        >
          <MenuIcon width={22} height={22} />
          Menu
        </button>

        <button
          type="button"
          onClick={onHome}
          className="flex min-w-0 max-w-[40vw] flex-col items-center rounded-lg px-1 py-1 active:bg-white/10"
        >
          <span className="truncate font-display text-lg font-bold leading-tight">{businessName}</span>
          {tableLabel && <span className="text-xs leading-tight text-white/60">{tableLabel}</span>}
        </button>

        <button
          type="button"
          onClick={onOrder}
          aria-label={itemCount ? `My order, ${itemCount} items` : "My order"}
          className="flex h-11 items-center gap-3 justify-self-end rounded-lg px-2 text-[15px] font-medium active:bg-white/10"
        >
          <span className="relative">
            <BagIcon width={22} height={22} />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-mango px-1 text-[11px] font-bold leading-none text-forest">
                {itemCount}
              </span>
            )}
          </span>
          <span className="hidden xs:inline">My order</span>
        </button>
      </div>
      <div className="banig" aria-hidden="true" />
    </header>
  );
}

// ---------------------------------------------------------------------------

function HomeView({
  menu,
  order,
  onDish,
  onAdd,
  onCategory,
}: {
  menu: Menu;
  order: Order;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
  onCategory: (id: string) => void;
}) {
  const all = menu.dishOrder.map((id) => menu.dishes[id]);
  const featured = all.find((d) => d.featured) ?? all[0];
  const best = all.filter((d) => d.bestSeller && d.id !== featured?.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      {featured && (
        <section className="px-4 pt-5" aria-label="Featured dish">
          <DishCard
            dish={featured}
            size="hero"
            pick={`${menu.businessName}'s pick`}
            inOrder={order[featured.id] ?? 0}
            onOpen={() => onDish(featured.id)}
            onAdd={() => onAdd(featured.id)}
          />
        </section>
      )}

      {best.length > 0 && (
        <CardRow
          title="Best sellers"
          rowId="best"
          ids={best.map((d) => d.id)}
          menu={menu}
          order={order}
          onDish={onDish}
          onAdd={onAdd}
        />
      )}

      {menu.categories.map((c) => (
        <CardRow
          key={c.id}
          title={c.name}
          rowId={c.id}
          ids={c.dishIds}
          menu={menu}
          order={order}
          onDish={onDish}
          onAdd={onAdd}
          onSeeAll={() => onCategory(c.id)}
        />
      ))}
    </div>
  );
}

/**
 * A titled sideways row of dish cards. Phones swipe it; a mouse has no
 * sideways wheel and the scrollbar is hidden, so mouse users get arrows.
 */
function CardRow({
  title,
  rowId,
  ids,
  menu,
  order,
  onDish,
  onAdd,
  onSeeAll,
}: {
  title: string;
  rowId: string;
  ids: string[];
  menu: Menu;
  order: Order;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
  onSeeAll?: () => void;
}) {
  const titleId = `row-${rowId}`;
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const nudge = (dir: 1 | -1) => {
    const el = listRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const arrow =
    "hidden h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink disabled:opacity-30 [@media(hover:hover)_and_(pointer:fine)]:grid enabled:hover:border-ink";

  return (
    <section className="mt-9" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-2 px-4">
        <h2 id={titleId} className="font-display text-2xl font-bold">
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="rounded-lg px-2 py-2 text-[15px] font-semibold text-leaf active:bg-leaf-tint">
              See all {ids.length}
            </button>
          )}
          <button type="button" className={arrow} onClick={() => nudge(-1)} disabled={edges.start} aria-label={`Scroll ${title} left`}>
            <ChevronLeft width={18} height={18} />
          </button>
          <button type="button" className={arrow} onClick={() => nudge(1)} disabled={edges.end} aria-label={`Scroll ${title} right`}>
            <ChevronRight width={18} height={18} />
          </button>
        </div>
      </div>
      {/* py leaves room for the card shadow, which overflow would clip. */}
      <ul ref={listRef} className="no-scrollbar flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-px-4 px-4 pb-6 pt-3">
        {ids.map((id) => (
          <li key={id} className="w-[76%] min-w-[236px] max-w-[300px] shrink-0 snap-start">
            <DishCard
              dish={menu.dishes[id]}
              size="row"
              inOrder={order[id] ?? 0}
              onOpen={() => onDish(id)}
              onAdd={() => onAdd(id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

const CARD = {
  hero: {
    radius: "rounded-[28px]",
    pad: "px-5",
    name: "text-[32px] xs:text-[36px] leading-[1.05]",
    desc: "text-[15px] line-clamp-3",
    badge: "h-9 px-3.5 text-sm",
    button: "h-12 text-[16px]",
    bottom: "px-5 pb-5",
  },
  row: {
    radius: "rounded-[24px]",
    pad: "px-4",
    name: "text-[22px] leading-tight",
    desc: "text-[14px] line-clamp-3",
    badge: "h-8 px-3 text-[13px]",
    button: "h-11 text-[15px]",
    bottom: "px-4 pb-4",
  },
  grid: {
    radius: "rounded-[20px]",
    pad: "px-3",
    name: "text-[17px] leading-tight",
    desc: "text-[13px] line-clamp-2",
    badge: "h-7 px-2.5 text-[12px]",
    button: "h-10 text-[14px]",
    bottom: "px-3 pb-3",
  },
} as const;

/**
 * Every dish on the menu is one of these: the photo, then the same photo
 * blurred and darkened underneath so the card takes that dish's colours, with
 * the name, description, serving badge and Add to order on it.
 * Tapping the photo or name opens the full details; the button adds directly.
 */
function DishCard({
  dish,
  size,
  inOrder,
  pick,
  onOpen,
  onAdd,
}: {
  dish: Dish;
  size: keyof typeof CARD;
  inOrder: number;
  /** The featured dish's extra badge. */
  pick?: string;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const s = CARD[size];

  return (
    <article
      className={`relative isolate flex h-full flex-col overflow-hidden bg-[#2a2f26] text-white shadow-[0_10px_28px_rgb(20_28_22/0.22)] ${s.radius}`}
    >
      {/* The blurred continuation of the photo. object-bottom so the colours
          nearest the text are the ones at the bottom edge of the photo.
          ponytail: a live CSS blur per card; if cheap phones stutter, swap in
          a tiny pre-shrunk copy of each photo, which blurs for free. */}
      {dish.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 -z-20 h-full w-full scale-125 object-cover object-bottom blur-2xl saturate-150 ${dish.available ? "" : "grayscale"}`}
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/0 via-black/40 to-black/75" aria-hidden="true" />

      <button type="button" onClick={onOpen} className="block text-left">
        <DishImage
          dish={dish}
          eager={size === "hero"}
          className={`${size === "hero" ? "aspect-[4/3] sm:aspect-[16/9]" : "aspect-[4/3]"} [-webkit-mask-image:linear-gradient(to_bottom,black_62%,transparent)] [mask-image:linear-gradient(to_bottom,black_62%,transparent)]`}
        />
        <div className={`relative -mt-6 ${s.pad}`}>
          <h3 className={`font-display font-bold ${s.name}`}>{dish.name}</h3>
          <p className={`mt-1.5 text-white/80 ${s.desc}`}>{dish.description}</p>
        </div>
      </button>

      <div className={`mt-auto pt-3 ${s.bottom}`}>
        <div className="flex flex-wrap gap-1.5">
          {pick && (
            <span className={`inline-flex items-center rounded-full bg-mango font-bold text-forest ${s.badge}`}>{pick}</span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/15 font-medium backdrop-blur ${s.badge}`}>
            <PeopleIcon width={16} height={16} />
            {servesLabel(dish.servesMin, dish.servesMax)}
          </span>
        </div>
        <button
          type="button"
          disabled={!dish.available}
          onClick={onAdd}
          className={`mt-3 flex w-full items-center justify-center rounded-full bg-white font-semibold text-ink active:bg-white/85 disabled:bg-white/20 disabled:text-white/70 ${s.button}`}
        >
          {dish.available ? "Add to order" : "Sold out"}
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------

function CategoryView({
  category,
  menu,
  order,
  onDish,
  onAdd,
  onBack,
}: {
  category: Category;
  menu: Menu;
  order: Order;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-2" aria-labelledby="cat-title">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-11 items-center gap-0.5 rounded-lg pl-1 pr-3 text-[15px] font-semibold text-leaf active:bg-leaf-tint"
      >
        <ChevronLeft width={20} height={20} />
        Home
      </button>
      <h1 id="cat-title" className="mt-1 font-display text-[40px] font-bold leading-none">
        {category.name}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {category.dishIds.length} {category.dishIds.length === 1 ? "item" : "items"}
      </p>
      <ul className="mt-5 grid grid-cols-2 items-stretch gap-3">
        {category.dishIds.map((id) => (
          <li key={id}>
            <DishCard
              dish={menu.dishes[id]}
              size="grid"
              inOrder={order[id] ?? 0}
              onOpen={() => onDish(id)}
              onAdd={() => onAdd(id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

/** Title bar shared by the Menu list and My order: forest, like the header. */
function PanelTitle({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }) {
  return (
    <div className="shrink-0 bg-forest pt-[env(safe-area-inset-top)] text-white">
      <div className="flex h-14 items-center justify-between pl-4 pr-2">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-11 w-11 place-items-center rounded-lg active:bg-white/10">
          <CloseIcon width={22} height={22} />
        </button>
      </div>
    </div>
  );
}

function MenuList({
  menu,
  current,
  onPick,
  onClose,
}: {
  menu: Menu;
  current: string | null;
  onPick: (categoryId: string | null) => void;
  onClose: () => void;
}) {
  const row = (active: boolean) =>
    `flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-[17px] ${
      active ? "bg-leaf-tint font-semibold text-leaf" : "active:bg-wash"
    }`;
  return (
    <>
      <PanelTitle title="Menu" onClose={onClose} closeLabel="Close menu" />
      <div className="banig" aria-hidden="true" />
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Categories">
        <button type="button" className={row(current === null)} onClick={() => onPick(null)} aria-current={current === null ? "page" : undefined}>
          <span className="flex items-center gap-3">
            <HomeIcon width={20} height={20} />
            Home
          </span>
        </button>
        <div className="my-2 border-t border-line" />
        {menu.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={row(current === c.id)}
            onClick={() => onPick(c.id)}
            aria-current={current === c.id ? "page" : undefined}
          >
            {c.name}
            <span className="text-sm font-normal text-muted">{c.dishIds.length}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------

function DishDetails({
  dish,
  inOrder,
  onAdd,
  onClose,
}: {
  dish: Dish;
  inOrder: number;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-2 pb-3 pl-4 pr-2 pt-[calc(12px+env(safe-area-inset-top))] sm:pt-3">
        <h2 className="pt-1.5 font-display text-[26px] font-bold leading-tight">{dish.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash active:bg-line">
          <CloseIcon width={20} height={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(24px+env(safe-area-inset-bottom))]">
        <DishImage dish={dish} eager className="mx-4 aspect-[4/3] rounded-2xl" />

        <div className="px-4">
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="text-[15px] text-muted">{dish.shortDescription}</p>
            <p className="shrink-0 font-display text-[26px] font-bold">{formatPrice(dish.priceCents)}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <PeopleIcon width={20} height={20} />
              {servesLabel(dish.servesMin, dish.servesMax)}
            </span>
            {dish.spiceLevel !== null && <SpiceMeter level={dish.spiceLevel} />}
          </div>

          <p className="mt-4 text-[16px] leading-relaxed">{dish.description}</p>

          <button
            type="button"
            disabled={!dish.available}
            onClick={onAdd}
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:bg-wash disabled:text-muted"
          >
            {!dish.available ? (
              "Sold out"
            ) : (
              <>
                <PlusIcon width={20} height={20} />
                Add to order
              </>
            )}
          </button>
          <p className="mt-2 h-5 text-center text-sm text-muted" aria-live="polite">
            {inOrder > 0 ? `${inOrder} in your order` : ""}
          </p>

          {dish.ingredients.length > 0 && (
            <>
              <h3 className="mt-5 font-display text-lg font-bold">Ingredients</h3>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
                {dish.ingredients.map((ing, i) => {
                  const Icon = INGREDIENT_ICONS[ing.kind];
                  return (
                    <li key={i} className="flex items-center gap-2 text-[15px]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-leaf-tint text-leaf" title={INGREDIENT_LABELS[ing.kind]}>
                        {Icon ? <Icon width={18} height={18} /> : null}
                      </span>
                      <span className="min-w-0 leading-tight">{ing.name}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function OrderList({
  menu,
  order,
  setQty,
  sent,
  canSend,
  sending,
  sendError,
  onSend,
  nickname,
  onNickname,
  onClose,
}: {
  menu: Menu;
  order: Order;
  setQty: (id: string, qty: number) => void;
  sent: GuestOrders | null;
  canSend: boolean;
  sending: boolean;
  sendError: string;
  onSend: () => void;
  /** "" when the guest skipped it. */
  nickname: string;
  onNickname: () => void;
  onClose: () => void;
}) {
  const lines = menu.dishOrder.filter((id) => order[id]).map((id) => ({ dish: menu.dishes[id], qty: order[id] }));
  const total = lines.reduce((sum, l) => sum + l.dish.priceCents * l.qty, 0);
  const hasSent = !!sent && sent.batches.length > 0;

  return (
    <>
      <PanelTitle title="My order" onClose={onClose} closeLabel="Close my order" />
      <div className="banig" aria-hidden="true" />

      {lines.length === 0 && !hasSent ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <BagIcon width={40} height={40} className="text-muted/60" />
          <p className="mt-3 font-display text-lg font-bold">Nothing added yet</p>
          <p className="mt-1 text-[15px] text-muted">Tap a dish, then Add to order.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {lines.length > 0 && (
              <section aria-label="Not sent yet">
                {hasSent && <h3 className="px-4 pt-4 font-display text-lg font-bold">Not sent yet</h3>}
                <ul className="divide-y divide-line px-4">
                  {lines.map(({ dish, qty }) => (
                    <li key={dish.id} className="flex items-center gap-3 py-3">
                      <DishImage dish={dish} className="aspect-square w-14 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{dish.name}</p>
                        <p className="text-sm text-muted">{formatPrice(dish.priceCents * qty)}</p>
                      </div>
                      <div className="flex shrink-0 items-center rounded-full border border-line">
                        <button type="button" onClick={() => setQty(dish.id, qty - 1)} aria-label={`One less ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-wash">
                          <MinusIcon width={18} height={18} />
                        </button>
                        <span className="w-5 text-center font-semibold tabular-nums">{qty}</span>
                        <button type="button" onClick={() => setQty(dish.id, qty + 1)} aria-label={`One more ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-wash">
                          <PlusIcon width={18} height={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hasSent && <SentOrders sent={sent!} />}
          </div>

          <div className="shrink-0 border-t border-line px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            {lines.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[17px] font-medium">{hasSent ? "To send" : "Total"}</span>
                  <span className="font-display text-2xl font-bold">{formatPrice(total)}</span>
                </div>
                {canSend ? (
                  <>
                    <p className="mt-2 flex items-center justify-between gap-2 text-sm text-muted">
                      <span className="min-w-0 truncate">
                        {nickname ? (
                          <>
                            Sending as <span className="font-semibold text-ink">{nickname}</span>
                          </>
                        ) : (
                          "No nickname: your waiter sees a guest number"
                        )}
                      </span>
                      <button type="button" onClick={onNickname} className="-my-2 h-10 shrink-0 rounded-lg px-2 font-semibold text-leaf active:bg-leaf-tint">
                        {nickname ? "Change" : "Add"}
                      </button>
                    </p>
                    <button
                      type="button"
                      onClick={onSend}
                      disabled={sending}
                      className="mt-3 flex h-[52px] w-full items-center justify-center rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-60"
                    >
                      {sending ? "Sending…" : "Send to waiter"}
                    </button>
                    {sendError && (
                      <p role="alert" className="mt-2 text-center text-sm text-chili">
                        {sendError}
                      </p>
                    )}
                  </>
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
                  <span className="font-display text-2xl font-bold">{formatPrice(sent!.subtotal)}</span>
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

/** What this phone already sent, batch by batch. Read-only: the waiter has it. */
function SentOrders({ sent }: { sent: GuestOrders }) {
  return (
    <section aria-label="Sent to waiter" className="pb-4 pt-4">
      <div className="flex items-baseline justify-between gap-3 px-4">
        <h3 className="font-display text-lg font-bold">Sent to waiter</h3>
        <span className="rounded-full bg-mango-soft px-2.5 py-0.5 text-[13px] font-semibold text-forest">{sent.nickname ?? `Guest ${sent.number}`}</span>
      </div>
      {sent.batches.map((b, i) => (
        <div key={b.id} className="mt-2">
          <p className="flex justify-between bg-wash px-4 py-1.5 text-[13px] font-semibold text-muted">
            <span>Batch {i + 1}</span>
            <span className="font-medium">{formatTime(b.sentAt)}</span>
          </p>
          <ul className="px-4">
            {b.lines.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[15px]">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{l.qty}×</span> {l.name}
                </span>
                <span className="shrink-0 text-muted">{formatPrice(l.priceCents * l.qty)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-2 flex justify-between px-4 text-[15px] font-semibold">
        <span>Sent so far</span>
        <span>{formatPrice(sent.subtotal)}</span>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Once anything is in the order, the running total stays in view at the
 * bottom of the menu, so the customer always knows what they will pay.
 */
function OrderBar({ count, total, onOpen }: { count: number; total: number; onOpen: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2">
      <button
        type="button"
        onClick={onOpen}
        className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 rounded-2xl bg-leaf pl-4 pr-5 text-white shadow-[0_8px_24px_rgb(16_52_42/0.35)] ring-1 ring-white/25 active:bg-leaf-dark"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-mango px-1.5 text-sm font-bold text-forest">{count}</span>
          <span className="text-[16px] font-semibold">View my order</span>
        </span>
        <span className="font-display text-xl font-bold">{formatPrice(total)}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * "Added to order" notice after every add, and "Sent to your waiter". It lives in the browser's top
 * layer (popover), so it still shows above an open dish sheet, which is
 * itself a top-layer <dialog>. Sits above the order bar when that is showing.
 */
type Toast = { key: number; title: string; detail: string };

function AddedToast({
  toast,
  lifted,
  onDone,
}: {
  toast: Toast | null;
  lifted: boolean;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The parent passes a new function every render; only a new toast should
  // restart the timer.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const el = ref.current;
    if (!el || !toast) return;
    // Re-showing moves it to the top of the top layer, above any dialog
    // opened since it was last shown.
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    } catch {
      // No popover support: it is still a fixed element, just not above dialogs.
    }
    const t = setTimeout(() => {
      try {
        el.hidePopover();
      } catch {}
      doneRef.current();
    }, 1800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div
      ref={ref}
      popover="manual"
      role="status"
      aria-live="polite"
      className={`toast fixed inset-auto left-1/2 m-0 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-visible border-0 bg-transparent p-0 ${
        lifted ? "bottom-[calc(84px+env(safe-area-inset-bottom))]" : "bottom-[calc(20px+env(safe-area-inset-bottom))]"
      }`}
    >
      {toast && (
        <div key={toast.key} className="flex items-center gap-3 rounded-2xl bg-forest py-2.5 pl-2.5 pr-5 text-white shadow-[0_10px_28px_rgb(16_52_42/0.35)]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mango text-forest">
            <CheckIcon width={18} height={18} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[15px] font-semibold">{toast.title}</span>
            <span className="block truncate text-[13px] text-white/75">{toast.detail}</span>
          </span>
        </div>
      )}
    </div>
  );
}
