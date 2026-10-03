"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BASE_PATH } from "@/lib/base";
import type { Dish, Menu } from "@/lib/menu";
import type { GuestOrders } from "@/lib/orders";
import { formatPrice, formatTime, servesLabel } from "@/lib/format";
import { randomId } from "@/lib/ids";
import Expired from "@/app/components/Expired";
import {
  BagIcon,
  CheckIcon,
  ClocheIcon,
  CloseIcon,
  HomeIcon,
  INGREDIENT_ICONS,
  INGREDIENT_LABELS,
  MenuIcon,
  MinusIcon,
  PeopleIcon,
  PlusIcon,
  SearchIcon,
} from "@/app/components/Icons";
import Sheet from "./Sheet";
import { DishImage, SpiceMeter } from "./parts";

// ---------------------------------------------------------------------------
// Where the customer is lives in the URL (?v=menu the whole menu, ?d= dish,
// ?o= order), pushed with history.pushState so the phone's Back button
// closes a sheet or goes back home instead of leaving the menu.
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
  const view = params.get("v") === "menu" ? "menu" : "home";
  const dishId = params.get("d");
  const orderOpen = params.get("o") === "1";

  const { expired, expire } = useVisitAlive(visitId, expiresAt);
  const { order, setQty, clear } = useOrder(visitId);
  const { sent, setSent, load: loadSent } = useSent(visitId, expire);
  const { nick, save: saveNick } = useNickname();
  const [nickOpen, setNickOpen] = useState(false);
  // The category tag picked on the whole menu; null is All.
  const [categoryId, setCategoryId] = useState<string | null>(null);

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

  const dish = dishId ? menu.dishes[dishId] : undefined;

  // Leaving home remembers where you were; coming back puts you there again.
  // Recorded while home is on screen, because by the time the menu renders
  // the page has already been re-laid out and scrollY no longer means home.
  const homeScroll = useRef(0);
  const lastView = useRef<string | null>(null);
  const currentView = useRef<string>(view);
  currentView.current = view;
  useEffect(() => {
    const onScroll = () => {
      // Both must say home: mid-switch, the scroll events are the new view's.
      if (currentView.current === "home" && lastView.current === "home") {
        homeScroll.current = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (view === lastView.current) return;
    window.scrollTo(0, view === "home" ? homeScroll.current : 0);
    lastView.current = view;
  }, [view]);

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
  const openOrder = () => setParams((p) => p.set("o", "1"), "push");
  const openMenu = () => {
    setCategoryId(null);
    setParams((p) => p.set("v", "menu"), "push");
  };
  const goHome = () => {
    if (view === "menu") closeParam("v");
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const pickCategory = (id: string | null) => {
    setCategoryId(id);
    // The tags stay put at the top; the dishes start again from the first.
    window.scrollTo(0, 0);
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
        nickname={nick || ""}
        place={menu.tableLabel ?? menu.businessName}
        itemCount={itemCount}
        onNickname={canSend ? () => setNickOpen(true) : undefined}
        onOrder={openOrder}
      >
        {view === "menu" && (
          <>
            <DishSearch menu={menu} onDish={openDish} />
            <CategoryTags menu={menu} current={categoryId} onPick={pickCategory} />
          </>
        )}
      </Header>

      {/* Room for the fixed bottom bar. On phones the page is laid out for the
          screen without the address bar (100lvh) while the bar sits above the
          address bar, so a short page ends that much under the bar and can't
          scroll further: add the difference (0 on desktop). */}
      <main className="pb-[calc(112px_+_env(safe-area-inset-bottom)_+_100lvh_-_100svh)]">
        <div key={view} className="view-in">
          {view === "menu" ? (
            <WholeMenu menu={menu} categoryId={categoryId} onDish={openDish} onAdd={addOne} />
          ) : (
            <HomeView menu={menu} onDish={openDish} onAdd={addOne} onMenu={openMenu} />
          )}
        </div>
      </main>

      <AddedToast toast={toast} onDone={() => setToast(null)} />

      <BottomNav
        view={view}
        count={itemCount}
        total={orderTotal}
        onHome={goHome}
        onMenu={view === "menu" ? () => window.scrollTo({ top: 0, behavior: "smooth" }) : openMenu}
        onOrder={openOrder}
      />

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

/**
 * "Hi Jecery!" and where they are sitting, with the order button opposite.
 * Stays at the top while the page scrolls; on the whole menu it also holds
 * the search and the category tags (`children`).
 */
function Header({
  nickname,
  place,
  itemCount,
  onNickname,
  onOrder,
  children,
}: {
  nickname: string;
  place: string;
  itemCount: number;
  /** Missing where there is no waiter, so no name to set. */
  onNickname?: () => void;
  onOrder: () => void;
  children?: React.ReactNode;
}) {
  const hello = (
    <>
      <span className="block truncate font-display text-[26px] font-bold leading-tight">Hi {nickname || "there"}!</span>
      <span className="block truncate text-[14px] leading-tight text-muted">{place}</span>
    </>
  );
  return (
    <header className="sticky top-0 z-20 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex h-[72px] items-center justify-between gap-3">
          {onNickname ? (
            <button type="button" onClick={onNickname} className="-mx-2 min-w-0 rounded-xl px-2 py-1 text-left active:bg-wash">
              {hello}
              <span className="sr-only">Change your nickname</span>
            </button>
          ) : (
            <div className="min-w-0">{hello}</div>
          )}
          <button
            type="button"
            onClick={onOrder}
            aria-label={itemCount ? `My order, ${itemCount} items` : "My order"}
            className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-leaf text-white shadow-[0_6px_16px_rgb(31_92_63/0.3)] active:bg-leaf-dark"
          >
            <BagIcon width={22} height={22} />
            {itemCount > 0 && <CountBadge count={itemCount} />}
          </button>
        </div>
        {children && <div className="pb-3">{children}</div>}
      </div>
    </header>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-mango px-1 text-[12px] font-bold leading-none text-forest ring-2 ring-paper">
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------

/** Accents and case don't matter: "sinigang" finds "Sinigang", "creme" finds "crème". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Type and the matching dishes drop down under the box; picking one opens it.
 * Names that start with what was typed come first, then names that contain
 * it, then dishes whose one-line description does.
 */
function DishSearch({ menu, onDish }: { menu: Menu; onDish: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const needle = fold(q.trim());
  const matches = needle
    ? menu.dishOrder
        .map((id) => menu.dishes[id])
        .map((d) => {
          const name = fold(d.name);
          const rank = name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : fold(d.shortDescription).includes(needle) ? 2 : 3;
          return { d, rank };
        })
        .filter((m) => m.rank < 3)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 6)
        .map((m) => m.d)
    : [];
  const show = open && needle !== "";

  const pick = (d: Dish) => {
    // Blur first: the dish sheet hands focus back on close, and a focused box
    // would bring the keyboard and the list straight back up.
    inputRef.current?.blur();
    setOpen(false);
    onDish(d.id);
  };

  return (
    <div className="relative">
      <SearchIcon width={20} height={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search the menu"
        aria-expanded={show}
        aria-controls="dish-suggest"
        aria-autocomplete="list"
        aria-activedescendant={show && matches[active] ? `sug-${matches[active].id}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && show && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            if (q) setQ("");
            else inputRef.current?.blur();
          }
        }}
        placeholder="Search dishes"
        enterKeyHint="search"
        autoComplete="off"
        className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-11 text-[16px] outline-none placeholder:text-muted/80 focus:border-leaf focus:ring-2 focus:ring-leaf/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <button
          type="button"
          aria-label="Clear search"
          // Keep the box focused, so clearing doesn't close the keyboard.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            setQ("");
            inputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted active:bg-wash"
        >
          <CloseIcon width={18} height={18} />
        </button>
      )}
      {show && (
        // preventDefault keeps focus in the box, so its blur doesn't close
        // the list before the tap on a suggestion lands.
        <div
          onPointerDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[60dvh] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_14px_36px_rgb(16_52_42/0.2)] ring-1 ring-line"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-[15px] text-muted">No dishes match &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            <ul id="dish-suggest" role="listbox" aria-label="Matching dishes">
              {matches.map((d, i) => (
                <li
                  key={d.id}
                  id={`sug-${d.id}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => pick(d)}
                  onPointerMove={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 ${i === active ? "bg-leaf-tint" : ""}`}
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-wash">
                    {d.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.imageUrl} alt="" className={`h-full w-full object-cover ${d.available ? "" : "grayscale"}`} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[15px] font-semibold">{d.name}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {d.available ? d.shortDescription : "Not Available Today"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold text-leaf">{formatPrice(d.priceCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** All, then each category. Picking one swaps the dishes below in place. */
function CategoryTags({
  menu,
  current,
  onPick,
}: {
  menu: Menu;
  current: string | null;
  onPick: (id: string | null) => void;
}) {
  const tags = [{ id: null, name: "All" }, ...menu.categories];
  return (
    <div role="group" aria-label="Categories" className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4">
      {tags.map((t) => {
        const on = t.id === current;
        return (
          <button
            key={t.id ?? "all"}
            type="button"
            aria-pressed={on}
            onClick={(e) => {
              onPick(t.id);
              e.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
            }}
            className={`h-10 shrink-0 rounded-xl px-4 text-[15px] font-semibold ${
              on ? "bg-leaf text-white" : "text-muted active:bg-wash"
            }`}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Every dish, or one category's, two to a row. */
function WholeMenu({
  menu,
  categoryId,
  onDish,
  onAdd,
}: {
  menu: Menu;
  categoryId: string | null;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const category = categoryId ? menu.categories.find((c) => c.id === categoryId) : undefined;
  const ids = category ? category.dishIds : menu.dishOrder;
  return (
    <section className="mx-auto max-w-3xl px-4 pt-2" aria-label={category?.name ?? "All dishes"}>
      <ul key={categoryId ?? "all"} className="view-in grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
        {ids.map((id) => (
          <li key={id}>
            <GridCard dish={menu.dishes[id]} onOpen={() => onDish(id)} onAdd={() => onAdd(id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The photo on a pale tile with the add button on its corner, then the name,
 * price and how many it feeds. The photo and name open the details.
 */
function GridCard({ dish, onOpen, onAdd }: { dish: Dish; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="flex h-full flex-col">
      <div className="relative">
        <button type="button" onClick={onOpen} aria-label={dish.name} className="block w-full rounded-[22px] bg-leaf-tint p-2">
          <DishImage dish={dish} className="aspect-square rounded-2xl" />
        </button>
        {dish.isNew && dish.available && (
          <span className="pointer-events-none absolute left-3.5 top-3.5 rounded-full bg-mango px-2.5 py-1 text-[12px] font-bold leading-none text-forest">
            New
          </span>
        )}
        {dish.available && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${dish.name} to order`}
            className="absolute -bottom-3 right-2 grid h-11 w-11 place-items-center rounded-full bg-leaf text-white ring-4 ring-paper active:bg-leaf-dark"
          >
            <PlusIcon width={22} height={22} strokeWidth={2.4} />
          </button>
        )}
      </div>
      <button type="button" onClick={onOpen} tabIndex={-1} className="mt-4 block flex-1 text-left">
        <h3 className="font-display text-[17px] font-bold leading-tight">{dish.name}</h3>
      </button>
      <p className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-semibold text-leaf">{formatPrice(dish.priceCents)}</span>
        <span className="flex items-center gap-1 text-[13px] text-muted">
          <PeopleIcon width={15} height={15} />
          {servesLabel(dish.servesMin, dish.servesMax).replace(/ (people|person)$/, "")}
        </span>
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------

/**
 * The landing page: the featured dish big, then three featured dishes, three
 * new ones, and the way into the whole menu.
 */
function HomeView({
  menu,
  onDish,
  onAdd,
  onMenu,
}: {
  menu: Menu;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
  onMenu: () => void;
}) {
  const all = menu.dishOrder.map((id) => menu.dishes[id]);
  const hero = all.find((d) => d.featured) ?? all[0];
  const featured = all.filter((d) => d.bestSeller && d.id !== hero?.id).slice(0, 3);
  const fresh = all.filter((d) => d.isNew && d.id !== hero?.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      {hero && <Hero dish={hero} onOpen={() => onDish(hero.id)} onAdd={() => onAdd(hero.id)} onMenu={onMenu} />}

      {featured.length > 0 && (
        <MiniRow title="Featured dishes" rowId="featured" dishes={featured} onDish={onDish} onAdd={onAdd} />
      )}
      {fresh.length > 0 && <MiniRow title="New on the menu" rowId="new" dishes={fresh} onDish={onDish} onAdd={onAdd} />}

      <div className="mt-10 px-4">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-forest text-white active:bg-forest-soft"
        >
          <MenuIcon width={22} height={22} />
          <span className="font-display text-[19px] font-bold">View whole menu</span>
          <span className="text-[14px] text-white/60">{all.length} dishes</span>
        </button>
      </div>
    </div>
  );
}

/** The dish name over two lines, the second in mango: "Kare-" / "Kare". */
function splitName(name: string): [string, string] {
  const m = name.match(/^(\S+?-|\S+\s)(.+)$/);
  return m ? [m[1].trim(), m[2]] : [name, ""];
}

/**
 * The featured dish as the page's hero: its photo fills most of the first
 * screen, with the name, price and the two actions over a dark fade at the
 * bottom. Anywhere on the photo (text included) opens the details.
 */
function Hero({ dish, onOpen, onAdd, onMenu }: { dish: Dish; onOpen: () => void; onAdd: () => void; onMenu: () => void }) {
  const [first, rest] = splitName(dish.name);
  return (
    <section
      aria-labelledby="hero-name"
      className="relative isolate h-[min(74svh,640px)] min-h-[460px] overflow-hidden rounded-b-[32px] bg-forest text-white sm:mx-4 sm:rounded-[32px]"
    >
      <button type="button" onClick={onOpen} aria-label={`${dish.name}, see details`} className="absolute inset-0 -z-10 block">
        <DishImage dish={dish} eager onDark className="h-full w-full" />
      </button>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(8_28_22/0.94)_0%,rgb(8_28_22/0.6)_36%,rgb(8_28_22/0)_64%)]"
      />

      {/* The price stamp, tilted like a sticker on the menu board. */}
      <div className="pointer-events-none absolute right-4 top-4 grid h-[84px] w-[84px] -rotate-[8deg] place-items-center rounded-full bg-mango text-forest shadow-[0_8px_20px_rgb(0_0_0/0.3)]">
        <div className="grid h-[72px] w-[72px] place-content-center rounded-full border-[1.5px] border-dashed border-forest/40 text-center">
          <span className="text-[12px] font-medium leading-none text-forest/70">Price</span>
          <span className="mt-0.5 font-display text-[20px] font-bold leading-tight">{formatPrice(dish.priceCents)}</span>
        </div>
      </div>

      {/* Taps on the words fall through to the photo; only the buttons catch them. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-5">
        <p className="inline-flex h-7 items-center rounded-full bg-white/15 px-3 text-[13px] font-semibold backdrop-blur">
          Today&apos;s pick
        </p>
        <h1
          id="hero-name"
          className="mt-3 font-display text-[clamp(42px,13vw,64px)] font-bold leading-[0.9] tracking-[-0.02em] [overflow-wrap:anywhere]"
        >
          <span className="block">{first}</span>
          {rest && <span className="block text-mango">{rest}</span>}
        </h1>
        <p className="mt-3 text-[16px] leading-snug text-white/85">{dish.shortDescription}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-white/70">
          <PeopleIcon width={17} height={17} />
          {servesLabel(dish.servesMin, dish.servesMax)}
        </p>

        <div className="pointer-events-auto mt-5 flex gap-3 sm:max-w-md">
          <button
            type="button"
            disabled={!dish.available}
            onClick={onAdd}
            className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-mango text-[16px] font-bold text-forest active:brightness-95 disabled:bg-white/20 disabled:text-white/80"
          >
            {dish.available ? (
              <>
                <PlusIcon width={20} height={20} strokeWidth={2.4} />
                Add to order
              </>
            ) : (
              "Not Available Today"
            )}
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="flex h-[54px] items-center justify-center gap-2 rounded-full bg-white/15 px-6 text-[16px] font-semibold ring-1 ring-inset ring-white/50 backdrop-blur active:bg-white/25"
          >
            <MenuIcon width={20} height={20} />
            Menu
          </button>
        </div>
      </div>
    </section>
  );
}

/** The heading between two mango diamonds, the banig's motif. */
function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  const diamond = <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 bg-mango" />;
  return (
    <h2 id={id} className="flex items-center justify-center gap-3 font-display text-[24px] font-bold">
      {diamond}
      {children}
      {diamond}
    </h2>
  );
}

const MINI_TINTS = ["bg-leaf-tint", "bg-mango-soft", "bg-leaf-tint"];

/** Three dishes side by side on tinted tiles, each with its price stamp. */
function MiniRow({
  title,
  rowId,
  dishes,
  onDish,
  onAdd,
}: {
  title: string;
  rowId: string;
  dishes: Dish[];
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const titleId = `row-${rowId}`;
  return (
    <section className="mt-10 px-4" aria-labelledby={titleId}>
      <SectionTitle id={titleId}>{title}</SectionTitle>
      <ul className="mt-4 grid grid-cols-3 gap-2.5">
        {dishes.map((d, i) => (
          <li key={d.id} className={`flex flex-col rounded-[20px] p-1.5 pb-2 ${MINI_TINTS[i % MINI_TINTS.length]}`}>
            <button type="button" onClick={() => onDish(d.id)} className="relative block text-center">
              <DishImage dish={d} className="aspect-square rounded-[14px]" />
              <span className="absolute -right-1 -top-1 grid h-[50px] w-[50px] place-items-center rounded-full bg-white font-display text-[13px] font-bold text-forest shadow-[0_4px_12px_rgb(16_52_42/0.18)]">
                {formatPrice(d.priceCents)}
              </span>
              <span className="mt-2 line-clamp-2 block min-h-[2.5em] px-0.5 font-display text-[14px] font-bold leading-[1.25]">
                {d.name}
              </span>
            </button>
            <button
              type="button"
              disabled={!d.available}
              onClick={() => onAdd(d.id)}
              aria-label={d.available ? `Add ${d.name} to order` : undefined}
              className="mt-2 flex min-h-10 items-center justify-center gap-1 rounded-full bg-leaf px-1 text-[14px] font-semibold text-white active:bg-leaf-dark disabled:bg-white/70 disabled:text-[11px] disabled:leading-tight disabled:text-muted"
            >
              {d.available ? (
                <>
                  <PlusIcon width={16} height={16} strokeWidth={2.4} />
                  Add
                </>
              ) : (
                "Not Available Today"
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

/** My order's title bar, forest with the banig strip under it. */
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
              "Not Available Today"
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
 * Home on the left, the whole menu in the middle, the order on the right. It sits on a strip of the page
 * colour that fades in above it, so dishes scrolling past slip under the
 * fade instead of showing in pieces around the bar.
 * Once anything is in the order the right side grows into the running
 * total, so the customer always knows what they will pay.
 */
function BottomNav({
  view,
  count,
  total,
  onHome,
  onMenu,
  onOrder,
}: {
  view: "home" | "menu";
  count: number;
  total: number;
  onHome: () => void;
  onMenu: () => void;
  onOrder: () => void;
}) {
  const tab = (on: boolean) =>
    `grid h-12 w-12 shrink-0 place-items-center rounded-full ${on ? "bg-white text-leaf" : "active:bg-white/15"}`;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper from-60% to-paper/0 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-6"
    >
      <div className="mx-auto grid h-[60px] max-w-md grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full bg-leaf px-2 text-white shadow-[0_10px_28px_rgb(16_52_42/0.35)]">
        <button
          type="button"
          onClick={onHome}
          aria-label="Home"
          aria-current={view === "home" ? "page" : undefined}
          className={tab(view === "home")}
        >
          <HomeIcon width={24} height={24} />
        </button>
        <button
          type="button"
          onClick={onMenu}
          aria-label="All menu"
          aria-current={view === "menu" ? "page" : undefined}
          className={tab(view === "menu")}
        >
          <ClocheIcon width={24} height={24} />
        </button>
        <button
          type="button"
          onClick={onOrder}
          aria-label={count ? `My order, ${count} items, ${formatPrice(total)}` : "My order"}
          className={
            count
              ? "flex h-12 min-w-0 items-center gap-2.5 justify-self-end rounded-full bg-white pl-1.5 pr-4 text-leaf active:bg-white/90"
              : "grid h-12 w-12 place-items-center justify-self-end rounded-full active:bg-white/15"
          }
        >
          {count ? (
            <>
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf-tint">
                <BagIcon width={20} height={20} />
                <CountBadge count={count} />
              </span>
              <span className="font-display text-[18px] font-bold">{formatPrice(total)}</span>
            </>
          ) : (
            <BagIcon width={24} height={24} />
          )}
        </button>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------

/**
 * "Added to order" notice after every add, and "Sent to your waiter". It lives in the browser's top
 * layer (popover), so it still shows above an open dish sheet, which is
 * itself a top-layer <dialog>. Sits just above the bottom bar.
 */
type Toast = { key: number; title: string; detail: string };

function AddedToast({
  toast,
  onDone,
}: {
  toast: Toast | null;
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
      className={`toast fixed inset-auto left-1/2 m-0 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-visible border-0 bg-transparent p-0 bottom-[calc(92px+env(safe-area-inset-bottom))]`}
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
