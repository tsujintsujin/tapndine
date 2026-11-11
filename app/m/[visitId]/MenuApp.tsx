"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BASE_PATH } from "@/lib/base";
import type { Category, Dish, Menu, SubCategory } from "@/lib/menu";
import type { CallKind, GuestOrders } from "@/lib/orders";
import { formatPrice, formatTime, servesLabel } from "@/lib/format";
import { randomId } from "@/lib/ids";
import { searchDishes } from "@/lib/search";
import {
  choiceLists,
  extraCents,
  lineKey,
  missingPick,
  mustPick,
  offered,
  optionsLabel,
  parseLineKey,
  resolvePicks,
  sizeTitle,
  startPicks,
  togglePick,
  type DishOption,
} from "@/lib/options";
import Expired from "@/app/components/Expired";
import { CategoryIcon } from "@/app/components/CategoryIcon";
import { SocialLogo } from "@/app/components/SocialLogo";
import {
  BagIcon,
  BellIcon,
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  ClocheIcon,
  CloseIcon,
  HomeIcon,
  INGREDIENT_ICONS,
  INGREDIENT_LABELS,
  MenuIcon,
  MinusIcon,
  PencilIcon,
  PeopleIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  TrashIcon,
} from "@/app/components/Icons";
import Sheet from "./Sheet";
import SuggestSheet from "./Suggest";
import { closeParam, notePop, setParams } from "./history";
import MenuB from "./MenuB";
import MenuC from "./MenuC";
import { DishImage, DishPhotos, photoUrl, SpiceMeter } from "./parts";

// The whole menu's header and its boxes line up at this width.
const MENU_WIDTH = "max-w-3xl md:max-w-5xl lg:max-w-[1400px]";

// ---------------------------------------------------------------------------
// The list being built lives on this phone until Send to waiter; then it is a
// batch on the server and the list starts empty again.

/** Line key (lib/options.ts lineKey: the dish plus its picks) to how many. */
type Order = Record<string, number>;
/** The guest's note per line in the list ("no egg"), sent with it. */
export type Notes = Record<string, string>;

/** A line in the phone's order, priced from today's menu. */
export type OrderLine = { key: string; dish: Dish; picks: DishOption[]; label: string | null; unitCents: number; qty: number };

/**
 * The order's lines in menu order. A line whose dish or picks the menu no
 * longer offers is left out, so it is neither shown nor sent.
 */
function orderLines(menu: Menu, order: Order): OrderLine[] {
  const lines: OrderLine[] = [];
  for (const [key, qty] of Object.entries(order)) {
    const { dishId, optionIds } = parseLineKey(key);
    const dish = menu.dishes[dishId];
    const picks = dish && resolvePicks(dish, optionIds);
    if (dish && picks) lines.push({ key, dish, picks, label: optionsLabel(picks), unitCents: dish.priceCents + extraCents(picks), qty });
  }
  const at = new Map(menu.dishOrder.map((id, i) => [id, i]));
  return lines.sort((a, b) => at.get(a.dish.id)! - at.get(b.dish.id)!);
}

function useOrder(visitId: string) {
  const key = `tapndine:order:${visitId}`;
  const notesKey = `tapndine:notes:${visitId}`;
  const [order, setOrder] = useState<Order>({});
  const [notes, setNotes] = useState<Notes>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setOrder(JSON.parse(raw));
      const rawNotes = localStorage.getItem(notesKey);
      if (rawNotes) setNotes(JSON.parse(rawNotes));
    } catch {
      // Private mode or blocked storage: the list just starts empty.
    }
  }, [key, notesKey]);

  const updateNotes = useCallback(
    (fn: (n: Notes) => Notes) => {
      setNotes((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(notesKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [notesKey]
  );

  const setNote = useCallback(
    (id: string, text: string) =>
      updateNotes((n) => {
        const next = { ...n };
        if (text.trim()) next[id] = text;
        else delete next[id];
        return next;
      }),
    [updateNotes]
  );

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
    (id: string, qty: number) => {
      update((o) => {
        const next = { ...o };
        if (qty <= 0) delete next[id];
        else next[id] = qty;
        return next;
      });
      // A dish taken off the list takes its note with it.
      if (qty <= 0) setNote(id, "");
    },
    [update, setNote]
  );

  const clear = useCallback(() => {
    update(() => ({}));
    updateNotes(() => ({}));
  }, [update, updateNotes]);

  return { order, setQty, clear, notes, setNote };
}

type OpenCall = { kind: CallKind; createdAt: number };

/**
 * What this phone has already sent (and whether the waiter has seen it), and
 * the table's open calls, from the server. While `watch` is on (My order or
 * the call box is open) it asks again every 10 seconds, so "Waiting for your
 * waiter" turns into "Seen" without a reload.
 */
function useSent(visitId: string, onDead: () => void, watch: boolean, off: boolean) {
  const [sent, setSent] = useState<GuestOrders | null>(null);
  const [calls, setCalls] = useState<OpenCall[]>([]);
  const deadRef = useRef(onDead);
  deadRef.current = onDead;

  const load = useCallback(() => {
    if (off) return;
    fetch(`${BASE_PATH}/api/visits/${visitId}/order`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 410) return deadRef.current();
        if (!r.ok) return;
        const j = (await r.json()) as { sent: GuestOrders | null; calls?: OpenCall[] };
        setSent(j.sent);
        setCalls(j.calls ?? []);
      })
      .catch(() => {
        // Offline for a moment: keep what we last had.
      });
  }, [visitId, off]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!watch) return;
    const t = setInterval(() => document.visibilityState === "visible" && load(), 10_000);
    return () => clearInterval(t);
  }, [watch, load]);
  return { sent, setSent, calls, setCalls, load };
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

function useVisitAlive(visitId: string, expiresAt: number, off: boolean) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (off) return;
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
  }, [visitId, expiresAt, off]);

  return { expired, expire: () => setExpired(true) };
}

// ---------------------------------------------------------------------------

export default function MenuApp({
  visitId,
  menu,
  expiresAt,
  canSend,
  demo,
  preview = false,
  startAt,
}: {
  visitId: string;
  menu: Menu;
  expiresAt: number;
  /** False for a tag not placed at a table: there is no waiter to send to. */
  canSend: boolean;
  /** The homepage's demo menu: says ordering is in the real thing. */
  demo: boolean;
  /** The manager's Homepage preview: no visit behind it, so it never checks in with the server. */
  preview?: boolean;
  /** Preview only: the id of the home row to open on (the one the manager just changed). */
  startAt?: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const view = params.get("v") === "menu" ? "menu" : "home";
  const dishId = params.get("d");
  const orderOpen = params.get("o") === "1";
  const suggestOpen = params.get("s") === "1";

  const [callOpen, setCallOpen] = useState(false);
  const { expired, expire } = useVisitAlive(visitId, expiresAt, preview);
  const { order, setQty, clear, notes, setNote } = useOrder(visitId);
  const lines = orderLines(menu, order);
  const { sent, setSent, calls, setCalls, load: loadSent } = useSent(visitId, expire, orderOpen || callOpen, preview);
  const { nick, save: saveNick } = useNickname();
  // The demo menu greets everyone as Guest: the name this phone saved from a
  // real table means nothing there, and it read as if the demo knew you.
  const shownNick = demo ? "Guest" : nick || "";
  const [nickOpen, setNickOpen] = useState(false);
  // The nickname is asked the first time this phone sends, not on opening the
  // menu: looking comes first. True while that question stands between the
  // guest and their send.
  const [sendAfterNick, setSendAfterNick] = useState(false);
  const { active: chapter, jump: jumpToChapter } = useChapterSpy(view === "menu");

  // How tall the sticky header is right now (its search and tabs come and go
  // with the view and the screen), for what sticks under it.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
    set();
    const watch = new ResizeObserver(set);
    watch.observe(header);
    return () => watch.disconnect();
  }, [view]);

  // Opening My order or the call box picks up anything the waiter did since.
  useEffect(() => {
    if (orderOpen || callOpen) loadSent();
  }, [orderOpen, callOpen, loadSent]);

  useEffect(() => {
    window.addEventListener("popstate", notePop);
    return () => window.removeEventListener("popstate", notePop);
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
    const row = lastView.current === null && startAt ? document.getElementById(startAt)?.closest("section") : null;
    lastView.current = view;
    if (row) {
      window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY - (window.innerHeight - row.offsetHeight) / 2);
    } else {
      window.scrollTo(0, view === "home" ? homeScroll.current : 0);
    }
  }, [view, startAt]);

  const [toast, setToast] = useState<Toast | null>(null);
  /** Adds n of one line (lineKey: the dish plus its picks). */
  const addOne = (key: string, n = 1) => {
    setQty(key, (order[key] ?? 0) + n);
    const { dishId, optionIds } = parseLineKey(key);
    const dish = menu.dishes[dishId];
    const label = dish && optionsLabel(resolvePicks(dish, optionIds) ?? []);
    const name = [dish?.name ?? "", label].filter(Boolean).join(", ");
    // A fresh key each time, so adding twice in a row shows it again.
    setToast({ key: Date.now(), title: "Added to order", detail: n > 1 ? `${n}× ${name}` : name });
  };

  // A line the menu no longer offers as picked (a size made required, a
  // choice removed) comes out of the order, with a word why, instead of
  // silently vanishing or blocking the send.
  useEffect(() => {
    const gone = Object.keys(order).filter((k) => !lines.some((l) => l.key === k));
    if (!gone.length) return;
    gone.forEach((k) => setQty(k, 0));
    setToast({ key: Date.now(), title: "Your order changed", detail: "The menu changed. Add those dishes again." });
  }, [order, lines, setQty]);

  // The categories missing from this Send ("Drinks"), kept while the popup is
  // open; and whether this list was offered them already, so the next Send
  // after closing it goes straight through.
  const [suggestFor, setSuggestFor] = useState<Category[]>([]);
  const suggested = useRef(false);

  // One key per list sent, so a double tap or a retry cannot send it twice.
  // Changing the list makes it a different send.
  const sendKey = useRef<string | null>(null);
  useEffect(() => {
    sendKey.current = null;
  }, [order]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const send = async (nickname: string | null = nick || null) => {
    sendKey.current ??= randomId();
    setSending(true);
    setSendError("");
    try {
      const r = await fetch(`${BASE_PATH}/api/visits/${visitId}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: sendKey.current,
          items: lines.map((l) => ({
            dishId: l.dish.id,
            options: l.picks.map((p) => p.id),
            qty: l.qty,
            note: notes[l.key] ?? "",
          })),
          nickname,
        }),
      });
      if (r.status === 410) return expire();
      if (r.status === 422) {
        // The menu changed since this page loaded (a dish sold out, a choice
        // removed): load it again, which takes out what can't be ordered.
        router.refresh();
        throw new Error("The menu just changed. Check your order, then send again.");
      }
      const j = (await r.json().catch(() => ({}))) as { sent?: GuestOrders | null; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not send. Try again.");
      setSent(j.sent ?? null);
      clear();
      suggested.current = false;
      setToast({ key: Date.now(), title: "Sent to your waiter", detail: `${itemCount} ${itemCount === 1 ? "item" : "items"}` });
    } catch (e) {
      setSendError(e instanceof TypeError ? "No connection. Check your signal and try again." : (e as Error).message);
    } finally {
      setSending(false);
    }
  };
  /**
   * Send to waiter: first, if the order has nothing from a category holding a
   * dish the manager wants suggested and this guest never sent one, offer those (once).
   * Then, first time on this phone, ask what to call them, then send.
   */
  const trySend = () => {
    if (!suggested.current) {
      const offer = unordered(menu, lines, sent);
      if (offer.length) {
        suggested.current = true;
        setSuggestFor(offer);
        setParams((p) => p.set("s", "1"), "push");
        return;
      }
    }
    if (nick === null) {
      setSendAfterNick(true);
      setNickOpen(true);
    } else send();
  };

  const [calling, setCalling] = useState<CallKind | null>(null);
  const [callError, setCallError] = useState("");
  const call = async (kind: CallKind) => {
    setCalling(kind);
    setCallError("");
    try {
      const r = await fetch(`${BASE_PATH}/api/visits/${visitId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, nickname: nick || null }),
      });
      if (r.status === 410) return expire();
      const j = (await r.json().catch(() => ({}))) as { calls?: OpenCall[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not reach your waiter. Try again.");
      setCalls(j.calls ?? []);
    } catch (e) {
      setCallError(e instanceof TypeError ? "No connection. Check your signal and try again." : (e as Error).message);
    } finally {
      setCalling(null);
    }
  };

  const openDish = (id: string) => setParams((p) => p.set("d", id), "push");
  /** The quick + on a card: straight in, unless the dish needs a size picked first. */
  const quickAdd = (id: string) => {
    const d = menu.dishes[id];
    if (!d) return;
    if (mustPick(d)) return openDish(id);
    addOne(lineKey(id, resolvePicks(d, []) ?? []));
  };
  const openOrder = () => setParams((p) => p.set("o", "1"), "push");
  const openMenu = () => setParams((p) => p.set("v", "menu"), "push");
  // A category tapped on home: open the menu, then jump there once it is laid out.
  const jumpAfterOpen = useRef<string | null>(null);
  const openMenuAt = (id: string) => {
    jumpAfterOpen.current = id;
    openMenu();
  };
  // Only on arriving at the menu.
  useEffect(() => {
    const id = jumpAfterOpen.current;
    if (view !== "menu" || !id) return;
    jumpAfterOpen.current = null;
    const frame = requestAnimationFrame(() => jumpToChapter(id));
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const goHome = () => {
    if (view === "menu") closeParam("v");
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const itemCount = lines.reduce((a, l) => a + l.qty, 0);
  const orderTotal = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);

  if (expired) return <Expired />;

  // The two small dialogs and the notice are the same in both designs; under
  // Design B they take its colours and type from .theme-ube.
  const shared = (
    <>
      <AddedToast toast={toast} top={menu.design === "b"} onDone={() => setToast(null)} />
      <NicknamePrompt
        open={nickOpen}
        initial={nick || ""}
        sending={sendAfterNick}
        onDone={(v) => {
          saveNick(v);
          setNickOpen(false);
          if (sendAfterNick) {
            setSendAfterNick(false);
            send(v || null);
          }
        }}
        onCancel={() => {
          setNickOpen(false);
          setSendAfterNick(false);
        }}
      />
      <SuggestSheet
        key={suggestFor.map((c) => c.id).join()}
        open={suggestOpen}
        menu={menu}
        categories={suggestFor}
        lines={lines}
        onAdd={quickAdd}
        setQty={setQty}
        onClose={() => closeParam("s")}
      />
      <CallPrompt
        open={callOpen}
        calls={calls}
        calling={calling}
        error={callError}
        onCall={call}
        onClose={() => {
          setCallOpen(false);
          setCallError("");
        }}
      />
    </>
  );

  if (menu.design === "b") {
    return (
      <MenuB
        menu={menu}
        nickname={shownNick}
        canSend={canSend}
        demo={demo}
        lines={lines}
        notes={notes}
        setNote={setNote}
        setQty={setQty}
        sent={sent}
        calling={calls.length > 0}
        dish={dish}
        orderOpen={orderOpen}
        indexOpen={params.get("i") === "1"}
        onDish={openDish}
        onQuickAdd={quickAdd}
        onAdd={(id, n, picks) => addOne(lineKey(id, picks), n)}
        onCloseDish={() => closeParam("d")}
        onOrder={openOrder}
        onCloseOrder={() => closeParam("o")}
        onNickname={canSend ? () => setNickOpen(true) : undefined}
        onCall={canSend ? () => setCallOpen(true) : undefined}
        sending={sending}
        sendError={sendError}
        onSend={trySend}
      >
        {shared}
      </MenuB>
    );
  }

  if (menu.design === "c") {
    return (
      <MenuC
        menu={menu}
        nickname={shownNick}
        canSend={canSend}
        demo={demo}
        lines={lines}
        notes={notes}
        setNote={setNote}
        setQty={setQty}
        sent={sent}
        calling={calls.length > 0}
        dish={dish}
        orderOpen={orderOpen}
        onDish={openDish}
        onQuickAdd={quickAdd}
        onAdd={(id, n, picks) => addOne(lineKey(id, picks), n)}
        onCloseDish={() => closeParam("d")}
        onOrder={openOrder}
        onCloseOrder={() => closeParam("o")}
        onNickname={canSend ? () => setNickOpen(true) : undefined}
        onCall={canSend ? () => setCallOpen(true) : undefined}
        sending={sending}
        sendError={sendError}
        onSend={trySend}
      >
        {shared}
      </MenuC>
    );
  }

  return (
    <>
      {/* The whole menu's white boxes sit on a darker page, over the home page's backdrop. */}
      {view === "menu" && <div aria-hidden="true" className="fixed inset-0 -z-10 bg-wash" />}
      <Header
        nickname={shownNick}
        businessName={menu.businessName}
        logoUrl={menu.logoUrl}
        itemCount={itemCount}
        calling={calls.length > 0}
        onNickname={canSend ? () => setNickOpen(true) : undefined}
        onCall={canSend ? () => setCallOpen(true) : undefined}
        onOrder={openOrder}
        view={view}
        orderTotal={orderTotal}
        onHome={goHome}
        onMenu={view === "menu" ? () => window.scrollTo({ top: 0, behavior: "smooth" }) : openMenu}
      >
        {view === "menu" && (
          <>
            <DishSearch menu={menu} onDish={openDish} />
            <ChapterChips menu={menu} active={chapter} onJump={jumpToChapter} />
          </>
        )}
      </Header>

      {/* Room for the fixed bottom bar. On phones the page is laid out for the
          screen without the address bar (100lvh) while the bar sits above the
          address bar, so a short page ends that much under the bar and can't
          scroll further: add the difference (0 on desktop). */}
      <main className="pb-[calc(84px_+_env(safe-area-inset-bottom)_+_100lvh_-_100svh)] md:pb-16">
        <div key={view} className="view-in">
          {view === "menu" ? (
            <WholeMenu menu={menu} active={chapter} onJump={jumpToChapter} onDish={openDish} onAdd={quickAdd} />
          ) : (
            <HomeView menu={menu} onDish={openDish} onAdd={quickAdd} onMenu={openMenu} onCategory={openMenuAt} />
          )}
        </div>
      </main>

      <BottomNav
        view={view}
        count={itemCount}
        total={orderTotal}
        onHome={goHome}
        onMenu={view === "menu" ? () => window.scrollTo({ top: 0, behavior: "smooth" }) : openMenu}
        onOrder={openOrder}
      />

      <Sheet open={!!dish} onClose={() => closeParam("d")} from="bottom" fit label={dish?.name ?? "Dish"}>
        {dish && (
          <DishDetails
            key={dish.id}
            dish={dish}
            inOrder={lines.reduce((n, l) => n + (l.dish.id === dish.id ? l.qty : 0), 0)}
            onAdd={(n, picks) => addOne(lineKey(dish.id, picks), n)}
            onClose={() => closeParam("d")}
          />
        )}
      </Sheet>

      <Sheet open={orderOpen} onClose={() => closeParam("o")} from="right" label="My order">
        <OrderList
          lines={lines}
          setQty={setQty}
          notes={notes}
          setNote={setNote}
          sent={sent}
          canSend={canSend}
          demo={demo}
          sending={sending}
          sendError={sendError}
          onSend={trySend}
          nickname={shownNick}
          onNickname={() => setNickOpen(true)}
          onClose={() => closeParam("o")}
        />
      </Sheet>

      {shared}
    </>
  );
}

/**
 * The categories ("Drinks") with a dish the manager wants suggested, available
 * today, that the order has nothing from and this guest hasn't sent anything
 * from before. Any dish in the category counts, suggested or not: someone who
 * ordered a juice has a drink.
 */
function unordered(menu: Menu, lines: OrderLine[], sent: GuestOrders | null): Category[] {
  const had = new Set([...lines.map((l) => l.dish.id), ...(sent?.dishIds ?? [])]);
  return menu.categories.filter(
    (c) => !c.dishIds.some((id) => had.has(id)) && c.dishIds.some((id) => menu.dishes[id]?.suggest && menu.dishes[id].available)
  );
}

/**
 * "What should we call you?" A small native dialog over the menu. Skip keeps
 * whatever name the phone had, or none: the waiter then sees Guest #.
 * Closing it (×, Esc, the phone's Back) changes nothing and, on the way to
 * Send to waiter, sends nothing: the guest is back at their order.
 */
function NicknamePrompt({
  open,
  initial,
  sending,
  onDone,
  onCancel,
}: {
  open: boolean;
  initial: string;
  /** Asked on the way to Send to waiter: the buttons say so. */
  sending: boolean;
  onDone: (v: string) => void;
  onCancel: () => void;
}) {
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
        onCancel();
      }}
      className="m-auto w-[min(380px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(value.replace(/\s+/g, " ").trim());
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="nick-title" className="pt-1 font-display text-[24px] font-bold leading-tight">
            What should we call you?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={sending ? "Back to my order" : "Close"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash active:bg-line"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>
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
          {sending ? "Send to waiter" : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => onDone(initial)}
          className="mt-1 h-11 w-full rounded-xl text-[15px] font-medium text-muted active:bg-wash"
        >
          {sending ? "Skip and send" : initial ? "Cancel" : "Skip"}
        </button>
      </form>
    </dialog>
  );
}


/**
 * "Call waiter" and "Bill, please". A small dialog like the nickname one.
 * A kind already asked for shows as waiting until the waiter opens the
 * table; asking again would do nothing, so its button is off meanwhile.
 */
function CallPrompt({
  open,
  calls,
  calling,
  error,
  onCall,
  onClose,
}: {
  open: boolean;
  calls: { kind: CallKind; createdAt: number }[];
  calling: CallKind | null;
  error: string;
  onCall: (kind: CallKind) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const options: { kind: CallKind; label: string; waiting: string; Icon: typeof BellIcon }[] = [
    { kind: "waiter", label: "Call waiter", waiting: "Waiter called", Icon: BellIcon },
    { kind: "bill", label: "Bill, please", waiting: "Bill asked for", Icon: ReceiptIcon },
  ];

  return (
    <dialog
      ref={ref}
      aria-labelledby="call-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(380px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="call-title" className="pt-1 font-display text-[24px] font-bold leading-tight">
            Need your waiter?
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash active:bg-line">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <p className="mt-1 text-[15px] text-muted">It shows on your waiter&apos;s phone right away.</p>
        <ul className="mt-4 space-y-2.5">
          {options.map(({ kind, label, waiting, Icon }) => {
            const open = calls.find((c) => c.kind === kind);
            return (
              <li key={kind}>
                <button
                  type="button"
                  disabled={!!open || calling !== null}
                  onClick={() => onCall(kind)}
                  className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 text-left ${
                    open ? "bg-mango-soft text-forest" : "bg-leaf text-white active:bg-leaf-dark disabled:opacity-60"
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${open ? "bg-mango" : "bg-white/15"}`}>
                    {open ? <CheckIcon width={20} height={20} /> : <Icon width={20} height={20} />}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[17px] font-semibold">{open ? waiting : calling === kind ? "Calling…" : label}</span>
                    {open && <span className="block text-[13px] text-forest/70">At {formatTime(open.createdAt)}. Your waiter sees it on their phone.</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-chili">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------

/**
 * The restaurant's logo and name, then the table and the guest's name, with
 * the call button opposite (the order button where there is no waiter).
 * Stays at the top while the page scrolls, a dark band edge to edge; on the
 * whole menu a white strip under it holds the search and the chapters (`children`).
 */
function Header({
  nickname,
  businessName,
  logoUrl,
  itemCount,
  calling,
  onNickname,
  onCall,
  onOrder,
  view,
  orderTotal,
  onHome,
  onMenu,
  children,
}: {
  nickname: string;
  businessName: string;
  logoUrl: string | null;
  itemCount: number;
  /** A call from this table is waiting for the waiter. */
  calling: boolean;
  /** Missing where there is no waiter, so no name to set. */
  onNickname?: () => void;
  /** Missing where there is no waiter to call. */
  onCall?: () => void;
  onOrder: () => void;
  view: "home" | "menu";
  orderTotal: number;
  onHome: () => void;
  onMenu: () => void;
  children?: React.ReactNode;
}) {
  const navTab = (on: boolean) =>
    `flex h-11 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold ${
      on ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;
  const hi = nickname && (
    <span className="truncate">
      Hi <span className="font-semibold text-mango">{nickname}</span>
    </span>
  );
  return (
    <header className="sticky top-0 z-20 bg-forest pt-[env(safe-area-inset-top)] text-white">
      <div className={`mx-auto px-4 md:px-6 ${view === "menu" ? MENU_WIDTH : "max-w-3xl md:max-w-5xl lg:max-w-6xl"}`}>
        <div className="flex h-[60px] items-center justify-between gap-3 md:h-[72px]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[20px] font-bold leading-tight md:text-[22px]">{businessName}</p>
              {onNickname ? (
                // Tall enough for a thumb while the header stays 60px: the
                // padding reaches into the space around the line.
                <button
                  type="button"
                  onClick={onNickname}
                  className="-mx-1.5 -my-3 flex min-h-11 max-w-full items-center gap-1.5 rounded-lg px-1.5 text-[14px] leading-tight text-white/70 active:bg-white/10"
                >
                  {hi || <span className="truncate font-semibold text-mango">Add your name</span>}
                  <PencilIcon width={14} height={14} className="shrink-0 text-white/60" aria-hidden />
                  <span className="sr-only">Change your nickname</span>
                </button>
              ) : (
                hi && <p className="flex text-[14px] leading-tight text-white/70">{hi}</p>
              )}
            </div>
          </div>
          {/* Tablets and desktop: the bottom bar's three places, up here. */}
          <nav aria-label="Menu sections" className="hidden items-center gap-1 md:flex">
            <button type="button" onClick={onHome} aria-current={view === "home" ? "page" : undefined} className={navTab(view === "home")}>
              <HomeIcon width={20} height={20} />
              Home
            </button>
            <button type="button" onClick={onMenu} aria-current={view === "menu" ? "page" : undefined} className={navTab(view === "menu")}>
              <ClocheIcon width={20} height={20} />
              Menu
            </button>
            <button
              type="button"
              onClick={onOrder}
              aria-label={itemCount ? `My order, ${itemCount} items` : "My order"}
              className="ml-2 flex h-11 items-center gap-2.5 rounded-lg bg-mango pl-3.5 pr-4 text-[15px] font-semibold text-forest hover:brightness-105"
            >
              <span className="relative">
                <BagIcon width={20} height={20} />
                {itemCount > 0 && <CountBadge count={itemCount} />}
              </span>
              My order
              {itemCount > 0 && <span className="font-bold">{formatPrice(orderTotal)}</span>}
            </button>
          </nav>
          {onCall ? (
            <button
              type="button"
              onClick={onCall}
              aria-label={calling ? "Call your waiter, a call is waiting" : "Call your waiter or ask for the bill"}
              className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white/15 pl-2.5 pr-3.5 text-[15px] font-semibold text-white hover:bg-white/25 active:bg-white/25"
            >
              <BellIcon width={22} height={22} />
              Waiter
              {calling && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-mango ring-2 ring-forest" aria-hidden />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOrder}
              aria-label={itemCount ? `My order, ${itemCount} items` : "My order"}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-mango text-forest active:brightness-95 md:hidden"
            >
              <BagIcon width={22} height={22} />
              {itemCount > 0 && <CountBadge count={itemCount} />}
            </button>
          )}
        </div>
      </div>
      {children && (
        <div className="border-b border-ink/15 bg-white pb-2 pt-2 text-ink lg:hidden">
          <div className="mx-auto max-w-3xl px-4 md:max-w-5xl md:px-6">{children}</div>
        </div>
      )}
    </header>
  );
}

/** Sits on the mango order button. */
function CountBadge({ count }: { count: number }) {
  return (
    <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-[12px] font-bold leading-none text-white ring-2 ring-mango">
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------

/**
 * Type and every matching dish drops down under the box, best first, with how
 * many there are; picking one opens it. Matching (lib/search.ts) takes in the
 * category, synonyms and typos: "coffee", "drinks", "capuccino" all find.
 */
function DishSearch({ menu, onDish }: { menu: Menu; onDish: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const typed = q.trim() !== "";
  const matches = typed ? searchDishes(menu, q).map((id) => menu.dishes[id]) : [];
  const show = open && typed;

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
        className="h-11 w-full rounded-lg border border-ink/15 bg-white pl-11 pr-11 text-[16px] outline-none placeholder:text-muted/80 focus:border-leaf focus:ring-2 focus:ring-leaf/20 [&::-webkit-search-cancel-button]:hidden"
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
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[60dvh] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_14px_36px_rgb(59_46_37/0.2)] ring-1 ring-line"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-[15px] text-muted">No dishes match &ldquo;{q.trim()}&rdquo;. Try a dish or a category, like rice or drinks.</p>
          ) : (
            <>
            {/* Not shown, but a screen reader still says how many matched. */}
            <p className="sr-only" aria-live="polite">
              {dishCount(matches.length)}
            </p>
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
                      <img src={photoUrl(d.imageUrl, 120)} alt="" className={`h-full w-full object-cover ${d.available ? "" : "grayscale"}`} />
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** A block of the whole menu: a main category, or the dishes in none ("other"). */
type Chapter = { id: string; name: string; icon: string | null; direct: string[]; subs: SubCategory[] };

/**
 * The menu in reading order. A main category's own dishes come first, then one
 * strip per sub-category. A dish in no category still gets a place at the end.
 */
function menuChapters(menu: Menu): Chapter[] {
  const chapters: Chapter[] = menu.categories.map((c) => {
    const inSub = new Set(c.subs.flatMap((s) => s.dishIds));
    return { id: c.id, name: c.name, icon: c.icon, direct: c.dishIds.filter((id) => !inSub.has(id)), subs: c.subs };
  });
  const placed = new Set(menu.categories.flatMap((c) => c.dishIds));
  const rest = menu.dishOrder.filter((id) => !placed.has(id));
  if (rest.length) chapters.push({ id: "other", name: chapters.length ? "More dishes" : "All dishes", icon: null, direct: rest, subs: [] });
  return chapters;
}

const dishCount = (n: number) => `${n} ${n === 1 ? "dish" : "dishes"}`;

/**
 * Which chapter or sub-category the guest has scrolled to (the last one whose
 * top has passed under the sticky header), and how to jump to one. Jumps are
 * instant: a smooth scroll would light up every section on the way past.
 */
function useChapterSpy(on: boolean) {
  const [active, setActive] = useState<string | null>(null);
  // A jump to a section too short to reach the top still shows that section:
  // the scroll it causes is not read, the guest's next one is.
  const skipScroll = useRef(false);
  const headerBottom = () => document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  // A category's own row of sub-categories (SubTabs) sticks under the header
  // while the guest is in it; a section counts as reached once it passes that.
  const line = () => {
    let bottom = headerBottom();
    for (const tabs of document.querySelectorAll<HTMLElement>("[data-subtabs]")) {
      const r = tabs.getBoundingClientRect();
      if (r.height && r.top <= bottom + 1 && r.bottom > bottom) bottom = r.bottom;
    }
    return bottom + 16;
  };

  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      let current: string | null = null;
      for (const el of document.querySelectorAll<HTMLElement>("[data-chapter]")) {
        // A jump puts a section's top on the line; rounding can leave it a fraction below.
        if (el.getBoundingClientRect().top > line() + 1) break;
        current = el.dataset.chapter!;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (skipScroll.current) skipScroll.current = false;
      else frame ||= requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [on]);

  const jump = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-chapter="${CSS.escape(id)}"]`);
    if (!el) return;
    // A sub-category lands below its category's row of sub-categories, which
    // will be stuck under the header by then even if it isn't yet.
    const tabs = el.tagName === "SECTION" ? null : el.closest("section")?.querySelector<HTMLElement>("[data-subtabs]");
    const y = Math.round(el.getBoundingClientRect().top + window.scrollY - headerBottom() - (tabs?.offsetHeight ?? 0) - 16);
    skipScroll.current = Math.round(window.scrollY) !== Math.min(Math.max(y, 0), document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, y);
    setActive(id);
    el.focus({ preventScroll: true });
  };

  return { active, jump };
}

/** Moves a scrolling list only as far as it takes to show this row, never the page. */
function showInList(list: HTMLElement, row: Element | null | undefined) {
  if (!row) return;
  const r = row.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  if (r.top < l.top) list.scrollTop -= l.top - r.top;
  else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
}

/** Scrolls a row of tabs sideways so its current tab sits in the middle. */
function useCentred(current: string | undefined) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const tab = row?.querySelector("[aria-current]");
    if (!row || !tab) return;
    const t = tab.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    row.scrollLeft += t.left + t.width / 2 - (r.left + r.width / 2);
  }, [current]);
  return rowRef;
}

/**
 * Phones and tablets: the main categories only, each with a food icon, in one
 * row that follows the scroll and never changes. A category's sub-categories
 * are a second, lighter row inside its own section (SubTabs), the primary and
 * secondary tabs of Material Design: in one row, "Drinks" and "Beverage" read
 * as two equal categories.
 */
function ChapterChips({ menu, active, onJump }: { menu: Menu; active: string | null; onJump: (id: string) => void }) {
  const chapters = menuChapters(menu);
  // In one of Drinks' sub-categories, Drinks is the tab that is lit.
  const current = chapters.find((c) => c.id === active || c.subs.some((s) => s.id === active))?.id ?? chapters[0]?.id;
  const rowRef = useCentred(current);
  if (!chapters.length) return null;
  return (
    <div ref={rowRef} role="group" aria-label="Categories" className="no-scrollbar -mx-4 mt-2 flex items-center gap-1 overflow-x-auto px-4 motion-safe:scroll-smooth md:-mx-6 md:px-6">
      {chapters.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-current={c.id === current ? "location" : undefined}
          onClick={() => onJump(c.id)}
          className={`flex h-11 shrink-0 items-center gap-1.5 rounded-lg pl-3 pr-3.5 text-[15px] font-semibold ${
            c.id === current ? "bg-leaf text-white" : "text-muted active:bg-wash"
          }`}
        >
          <CategoryIcon name={c.name} icon={c.icon} />
          {c.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Phones and tablets: a category's sub-categories, as a row of plain words
 * with a line under the one the guest is in, right under the category's dark
 * band. It sticks under the header while the guest scrolls through that
 * category and leaves with it, so the header never changes height. Desktop
 * has them indented in the side list instead.
 */
function SubTabs({ chapter, active, onJump }: { chapter: Chapter; active: string | null; onJump: (id: string) => void }) {
  const current = chapter.subs.find((s) => s.id === active)?.id;
  const rowRef = useCentred(current);
  return (
    <div data-subtabs className="sticky z-[5] border-b border-ink/10 bg-white lg:hidden" style={{ top: "var(--header-h, 0px)" }}>
      <div ref={rowRef} role="group" aria-label={`${chapter.name}: sections`} className="no-scrollbar flex overflow-x-auto px-1.5 motion-safe:scroll-smooth">
        {chapter.subs.map((s) => {
          const on = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={on ? "location" : undefined}
              onClick={() => onJump(s.id)}
              className={`relative h-11 shrink-0 px-3 text-[14px] font-semibold ${on ? "text-ink" : "text-muted active:bg-wash"}`}
            >
              {s.name}
              {on && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-mango" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The whole menu on one scroll, each category in its own box under a dark band
 * and each sub-category under its own strip. On desktop a panel on the left
 * holds the search and the list of chapters, which follows the scroll; on
 * phones and tablets those are in the header (ChapterChips).
 */
function WholeMenu({
  menu,
  active,
  onJump,
  onDish,
  onAdd,
}: {
  menu: Menu;
  active: string | null;
  onJump: (id: string) => void;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const chapters = menuChapters(menu);
  const current = active ?? chapters[0]?.id;
  const open = chapters.find((c) => c.id === current || c.subs.some((s) => s.id === current));
  // A long list scrolls by itself; keep the open chapter and its sub-categories in view.
  const listRef = useRef<HTMLDivElement>(null);
  // More rows below the list's edge (a laptop screen): a fade says so.
  const [more, setMore] = useState(false);
  const readMore = useCallback(() => {
    const l = listRef.current;
    setMore(!!l && l.scrollTop + l.clientHeight < l.scrollHeight - 4);
  }, []);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    showInList(list, [...list.querySelectorAll("[data-sub]")].at(-1));
    showInList(list, list.querySelector("[aria-current]"));
    readMore();
  }, [current, readMore]);
  useEffect(() => {
    window.addEventListener("resize", readMore);
    return () => window.removeEventListener("resize", readMore);
  }, [readMore]);

  const grid = (ids: string[]) => (
    <ul className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-4 xl:grid-cols-4">
      {ids.map((id) => (
        <li key={id}>
          <GridCard dish={menu.dishes[id]} onOpen={() => onDish(id)} onAdd={() => onAdd(id)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`${MENU_WIDTH} mx-auto px-2.5 pt-2.5 md:px-6 md:pt-4 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-4`}>
      <aside className="hidden rounded-[14px] border border-ink/15 bg-white lg:sticky lg:top-[88px] lg:flex lg:max-h-[calc(100dvh-104px)] lg:flex-col lg:self-start">
        <div className="shrink-0 border-b border-ink/15 p-3">
          <DishSearch menu={menu} onDish={onDish} />
        </div>
        <div className="relative flex min-h-0 flex-col">
        <div ref={listRef} onScroll={readMore} role="group" aria-label="Categories" className="flex min-h-0 flex-col overflow-y-auto rounded-b-[13px] [scrollbar-width:thin]">
          {chapters.map((c) => (
            <Fragment key={c.id}>
              {/* 34px rows (a mouse, not a thumb) so a whole menu's list fits more laptop screens. */}
              <button
                type="button"
                aria-current={c.id === current ? "location" : undefined}
                onClick={() => onJump(c.id)}
                className={`flex h-[34px] shrink-0 items-center gap-2 border-b border-ink/10 px-4 text-left text-[15px] font-semibold last:border-b-0 ${
                  c.id === open?.id ? "bg-leaf text-white" : "hover:bg-wash"
                }`}
              >
                <CategoryIcon name={c.name} icon={c.icon} className="shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
              {c.id === open?.id &&
                c.subs.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    data-sub
                    aria-current={s.id === current ? "location" : undefined}
                    onClick={() => onJump(s.id)}
                    className={`flex h-[34px] shrink-0 items-center border-b border-ink/10 pl-8 pr-4 text-left text-[15px] font-medium last:border-b-0 ${
                      s.id === current ? "bg-leaf-tint shadow-[inset_3px_0_0_rgb(var(--mango))]" : "bg-paper hover:bg-wash"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
            </Fragment>
          ))}
        </div>
        {more && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center rounded-b-[13px] bg-[linear-gradient(to_top,white_35%,rgb(255_255_255/0))] pb-1 text-muted">
            <ChevronRight width={18} height={18} className="rotate-90" />
          </div>
        )}
        </div>
      </aside>
      <div className="min-w-0 space-y-3 md:space-y-4">
        {chapters.length === 0 && (
          <p className="rounded-[14px] border border-ink/15 bg-white px-4 py-12 text-center text-[16px] text-muted">
            No dishes yet. They show up here as soon as the restaurant adds them.
          </p>
        )}
        {chapters.map((c) => (
          // clip, not hidden: hidden would stop its row of sub-categories from sticking.
          <section key={c.id} data-chapter={c.id} tabIndex={-1} aria-labelledby={`ch-${c.id}`} className="overflow-clip rounded-[14px] border border-ink/15 bg-white">
            <h2 id={`ch-${c.id}`} className="bg-forest px-3.5 py-2.5 font-display text-[21px] font-bold leading-tight text-white sm:px-5 sm:py-3 sm:text-[23px]">
              {c.name}
            </h2>
            {c.subs.length > 0 && <SubTabs chapter={c} active={active} onJump={onJump} />}
            {c.direct.length > 0 && grid(c.direct)}
            {c.subs.map((s, i) => (
              <div key={s.id} data-chapter={s.id} tabIndex={-1}>
                <h3 className={`border-b border-ink/10 bg-leaf-tint px-3.5 py-2 font-display text-[17px] font-bold leading-tight sm:px-5 ${i > 0 || c.direct.length > 0 ? "border-t" : ""}`}>
                  {s.name}
                </h3>
                {grid(s.dishIds)}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * A bordered card: the photo edge to edge, then the name and description, then
 * a row with the price, how many it feeds and the add button. The photo and
 * name open the details.
 */
function GridCard({ dish, onOpen, onAdd }: { dish: Dish; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-ink/15 bg-white">
      <button type="button" onClick={onOpen} aria-label={dish.name} className="block w-full">
        <DishImage dish={dish} className="aspect-[4/3]" sizes="(min-width: 1280px) 260px, (min-width: 640px) 33vw, 50vw" />
      </button>
      {dish.isNew && dish.available && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-mango px-2.5 py-1 text-[13px] font-bold leading-none text-forest">
          New
        </span>
      )}
      {/* Two lines of description: enough to tell one dish from the next without opening it. */}
      <button type="button" onClick={onOpen} tabIndex={-1} className="block flex-1 px-3 pb-1 pt-2.5 text-left">
        <h3 className="font-display text-[15px] font-bold leading-tight sm:text-[16px]">{dish.name}</h3>
        {dish.shortDescription && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{dish.shortDescription}</p>}
      </button>
      <div className="flex min-h-[52px] items-center justify-between gap-2 pb-2 pl-3 pr-2">
        <div className="min-w-0 leading-tight">
          <p className="text-[16px] font-bold">{formatPrice(dish.priceCents)}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <PeopleIcon width={15} height={15} aria-hidden />
            <span className="truncate">{servesLabel(dish.servesMin, dish.servesMax)}</span>
          </p>
        </div>
        {dish.available && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${dish.name} to order`}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-leaf text-[14px] font-semibold text-white hover:bg-leaf-dark active:bg-leaf-dark sm:px-3"
          >
            <PlusIcon width={20} height={20} strokeWidth={2.4} />
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------

/**
 * The landing page: the featured dish big, then the featured dishes, the new
 * ones, and the menu's categories, each a way straight into the menu.
 */
function HomeView({
  menu,
  onDish,
  onAdd,
  onMenu,
  onCategory,
}: {
  menu: Menu;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
  onMenu: () => void;
  /** Opens the whole menu at this category. */
  onCategory: (id: string) => void;
}) {
  const all = menu.dishOrder.map((id) => menu.dishes[id]);
  if (!all.length) return <MenuSoon name={menu.businessName} />;
  const hero = all.find((d) => d.featured) ?? all[0];
  const featured = all.filter((d) => d.bestSeller && d.id !== hero?.id);
  const fresh = all.filter((d) => d.isNew && d.id !== hero?.id);

  return (
    <div className="mx-auto max-w-3xl md:max-w-5xl md:px-6 md:pt-2 lg:max-w-6xl">
      {hero && <Hero dish={hero} onOpen={() => onDish(hero.id)} onAdd={() => onAdd(hero.id)} onMenu={onMenu} />}

      <div className="lg:grid lg:grid-cols-2 lg:gap-10">
        {featured.length > 0 && (
          <MiniRow title="Featured dishes" rowId="featured" dishes={featured} onDish={onDish} onAdd={onAdd} />
        )}
        {fresh.length > 0 && <MiniRow title="New on the menu" rowId="new" dishes={fresh} onDish={onDish} onAdd={onAdd} />}
      </div>

      {menu.socials.length > 0 && <FollowUs socials={menu.socials} />}

      <BrowseMenu menu={menu} onMenu={onMenu} onCategory={onCategory} />
    </div>
  );
}

/**
 * The restaurant's social pages, the ones its manager switched on in
 * Settings > Socials. Each opens in a new tab so the menu stays where it was.
 */
function FollowUs({ socials }: { socials: Menu["socials"] }) {
  return (
    <section className="mt-10 px-4 md:px-0" aria-labelledby="row-follow">
      <SectionTitle id="row-follow">Follow us</SectionTitle>
      <p className="mt-1 text-center text-[15px] text-muted">See our new dishes and promos first.</p>
      <ul className="mt-4 flex justify-center gap-2 min-[380px]:gap-3">
        {socials.map((s) => (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-[76px] flex-col items-center gap-1.5 rounded-2xl py-2 active:bg-wash"
            >
              <SocialLogo id={s.id} className="h-12 w-12" />
              <span className="text-[13px] font-semibold">{s.name}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Every main category as a tile with a photo from it: a guest who came for a
 * drink goes straight to Drinks instead of scrolling past everything else.
 * A last row that isn't full sits centred, over the way into the whole menu.
 */
function BrowseMenu({
  menu,
  onMenu,
  onCategory,
}: {
  menu: Menu;
  onMenu: () => void;
  onCategory: (id: string) => void;
}) {
  const chapters = menuChapters(menu);
  const tile = "flex min-h-[64px] items-center gap-2 rounded-2xl p-2 text-left min-[380px]:gap-2.5 min-[380px]:pr-2.5";
  return (
    <section className="mt-10 px-4 md:px-0" aria-labelledby="row-browse">
      <SectionTitle id="row-browse">Browse the menu</SectionTitle>
      {/* Two, three, then four across; the 10px gaps come out of each tile's width. */}
      <ul className="mt-4 flex flex-wrap justify-center gap-2.5">
        {chapters.map((c) => {
          // Its first dish with a photo, one on today's menu if any (a sold-out one shows grey).
          const inIt = [...c.direct, ...c.subs.flatMap((s) => s.dishIds)].map((id) => menu.dishes[id]).filter((d) => d.imageUrl);
          const photo = inIt.find((d) => d.available) ?? inIt[0];
          return (
            <li key={c.id} className="flex-none basis-[calc(50%-5px)] md:basis-[calc((100%-20px)/3)] lg:basis-[calc((100%-30px)/4)]">
              <button type="button" onClick={() => onCategory(c.id)} className={`${tile} h-full w-full border border-ink/10 bg-white active:bg-wash`}>
                {photo ? (
                  <DishImage dish={photo} soldOutLabel={false} sizes="44px" className="h-10 w-10 shrink-0 rounded-xl min-[380px]:h-11 min-[380px]:w-11" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-wash min-[380px]:h-11 min-[380px]:w-11" />
                )}
                {/* A step smaller on a narrow phone so "Sandwiches" fits; a longer word still wraps instead of being cut. */}
                <span className="line-clamp-2 min-w-0 font-display text-[14px] font-bold leading-tight [overflow-wrap:anywhere] min-[380px]:text-[15px]">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mb-4 mt-5 flex justify-center">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-[56px] items-center gap-3 rounded-full bg-forest pl-5 pr-6 text-white active:bg-forest-soft"
        >
          <MenuIcon width={22} height={22} />
          <span className="font-display text-[18px] font-bold">Whole menu</span>
        </button>
      </div>
    </section>
  );
}

/**
 * A menu with no dishes yet (a restaurant just signed up): the home page's
 * shapes, faded, so the guest sees where the dishes will go, and a word for them.
 */
function MenuSoon({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-3xl md:max-w-5xl md:px-6 md:pt-2 lg:max-w-6xl">
      <section
        aria-labelledby="soon-title"
        className="relative isolate flex min-h-[440px] flex-col justify-end overflow-hidden rounded-b-[32px] bg-forest px-5 pb-8 text-white sm:mx-4 sm:rounded-[32px] md:mx-0 md:min-h-[400px] md:px-8 md:pb-10"
      >
        <div aria-hidden="true" className="absolute right-4 top-4 h-[84px] w-[84px] -rotate-[8deg] rounded-full border-2 border-dashed border-white/25 md:right-8 md:top-8" />
        <div aria-hidden="true">
          <span className="block h-7 w-28 rounded-full bg-white/15" />
          <span className="mt-4 block h-11 w-3/4 max-w-sm rounded-xl bg-white/15" />
          <span className="mt-2.5 block h-11 w-1/2 max-w-[240px] rounded-xl bg-mango/30" />
        </div>
        <h1 id="soon-title" className="mt-8 font-display text-[30px] font-bold leading-tight">
          The menu is on its way
        </h1>
        <p className="mt-2 max-w-md text-[16px] leading-snug text-white/80">
          Dishes show up here as soon as {name} adds them. Your waiter can tell you what&apos;s cooking today.
        </p>
      </section>
      <section aria-hidden="true" className="mt-10 px-4 md:px-0">
        <span className="mx-auto block h-5 w-44 rounded-full bg-wash" />
        <ul className="mt-4 grid grid-cols-3 gap-2.5 md:mx-auto md:max-w-xl">
          {MINI_TINTS.map((tint, i) => (
            <li key={i} className={`rounded-[20px] p-1.5 pb-2.5 ${tint}`}>
              <span className="block aspect-square rounded-[14px] bg-white/70" />
              <span className="mx-auto mt-2.5 block h-3 w-3/4 rounded-full bg-white/80" />
              <span className="mt-2.5 block h-10 rounded-full bg-white/60" />
            </li>
          ))}
        </ul>
      </section>
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
      className="relative isolate h-[min(74svh,640px)] min-h-[460px] overflow-hidden rounded-b-[32px] bg-forest text-white sm:mx-4 sm:rounded-[32px] md:mx-0 md:grid md:h-[min(60vh,480px)] md:min-h-[420px] lg:h-[min(72vh,540px)] lg:min-h-[440px] md:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <button type="button" onClick={onOpen} aria-label={`${dish.name}, see details`} className="absolute inset-0 -z-10 block md:relative md:z-auto md:h-full">
        <DishImage dish={dish} eager onDark sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 100vw" className="h-full w-full" />
      </button>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(33_24_18/0.94)_0%,rgb(33_24_18/0.6)_36%,rgb(33_24_18/0)_64%)] md:hidden"
      />

      {/* The price stamp, tilted like a sticker on the menu board. */}
      <div className="pointer-events-none absolute right-4 top-4 grid h-[84px] w-[84px] -rotate-[8deg] md:right-8 md:top-8 md:h-[104px] md:w-[104px] place-items-center rounded-full bg-mango text-forest shadow-[0_8px_20px_rgb(0_0_0/0.3)]">
        <div className="grid h-[72px] w-[72px] place-content-center rounded-full border-[1.5px] border-dashed border-forest/40 text-center md:h-[90px] md:w-[90px]">
          <span className="text-[12px] font-medium leading-none text-forest/70">Price</span>
          <span className="mt-0.5 font-display text-[20px] font-bold leading-tight">{formatPrice(dish.priceCents)}</span>
        </div>
      </div>

      {/* Taps on the words fall through to the photo; only the buttons catch them. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-5 md:static md:flex md:flex-col md:justify-end md:px-8 md:pb-8 lg:px-10 lg:pb-10">
        <p className="inline-flex h-7 items-center self-start rounded-full bg-white/15 px-3 text-[13px] font-semibold backdrop-blur">
          Today&apos;s pick
        </p>
        <h1
          id="hero-name"
          className="mt-3 font-display text-[clamp(42px,13vw,64px)] font-bold md:text-[clamp(44px,5vw,72px)] leading-[0.9] tracking-[-0.02em] [overflow-wrap:anywhere]"
        >
          <span className="block">{first}</span>
          {rest && <span className="block text-mango">{rest}</span>}
        </h1>
        <p className="mt-3 text-[16px] leading-snug text-white/85">{dish.shortDescription}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-white/70">
          <PeopleIcon width={17} height={17} />
          {servesLabel(dish.servesMin, dish.servesMax)}
        </p>

        <div className="pointer-events-auto mt-5 flex gap-3 sm:max-w-md md:mt-8">
          <button
            type="button"
            disabled={!dish.available}
            onClick={onAdd}
            className="flex h-[54px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-mango text-[16px] font-bold text-forest active:brightness-95 disabled:bg-white/20 disabled:text-white/80"
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

/**
 * Dishes side by side on tinted tiles, each with its price stamp. Up to three
 * fill the row; more swipe sideways and go round (LoopRow).
 */
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
    <section className="mt-10 px-4 md:px-0" aria-labelledby={titleId}>
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {dishes.length > 3 ? (
        <LoopRow dishes={dishes} onDish={onDish} onAdd={onAdd} />
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-2.5">
          {dishes.map((d, i) => (
            <MiniTile key={d.id} dish={d} tint={MINI_TINTS[i % MINI_TINTS.length]} onDish={onDish} onAdd={onAdd} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MiniTile({
  dish: d,
  tint,
  copy,
  onDish,
  onAdd,
}: {
  dish: Dish;
  tint: string;
  /** In a LoopRow: true for the copies around the real set, seen but skipped by screen readers and Tab. */
  copy?: boolean;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  return (
    <li
      aria-hidden={copy || undefined}
      inert={copy || undefined}
      className={`flex flex-col rounded-[20px] p-1.5 pb-2 ${tint} ${
        copy === undefined ? "" : "shrink-0 grow-0 snap-start basis-[calc((100%-32px)/3.3)] md:basis-[calc((100%-20px)/3)]"
      }`}
    >
      <button type="button" onClick={() => onDish(d.id)} className="relative block text-center">
        <DishImage dish={d} sizes="(min-width: 1024px) 180px, 33vw" className="aspect-square rounded-[14px]" />
        <span className="absolute -right-1 -top-1 grid h-[50px] w-[50px] place-items-center rounded-full bg-white font-display text-[13px] font-bold text-forest shadow-[0_4px_12px_rgb(59_46_37/0.18)]">
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
  );
}

// ponytail: enough copies for at least 12 tiles each side of the middle set; a
// fling longer than that stops at the row's real end, then the loop carries on.
const LOOP_REACH = 12;

/**
 * A row that goes round: the dishes are laid out several times over and the
 * guest starts in the middle set. Whenever a swipe comes to rest outside the
 * middle set, the row jumps back by one whole set; the tiles in view are the
 * same dishes, so nothing seems to move. On a phone a sliver of the next tile
 * shows; from a tablet up there are arrows.
 */
function LoopRow({ dishes, onDish, onAdd }: { dishes: Dish[]; onDish: (id: string) => void; onAdd: (id: string) => void }) {
  const ref = useRef<HTMLUListElement>(null);
  const n = dishes.length;
  const mid = Math.ceil(LOOP_REACH / n);

  // One set's width and one tile's step, measured, so fractional tile widths stay exact.
  const measure = useCallback(() => {
    const kids = ref.current!.children;
    const left = (i: number) => kids[i].getBoundingClientRect().left;
    return { set: left(n) - left(0), step: left(1) - left(0) };
  }, [n]);

  /** Back into the middle set, by whole sets. */
  const recentre = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { set } = measure();
    let x = el.scrollLeft;
    while (x < (mid - 0.5) * set) x += set;
    while (x >= (mid + 0.5) * set) x -= set;
    if (Math.abs(x - el.scrollLeft) > 1) el.scrollLeft = x;
  }, [measure, mid]);

  useLayoutEffect(() => {
    const el = ref.current!;
    el.scrollLeft = mid * measure().set;
    // A finger still on the row: wait for it to lift (and the coast after).
    let touching = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (!touching) recentre();
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 150);
    };
    const down = () => {
      touching = true;
    };
    const up = () => {
      touching = false;
      onScroll();
    };
    // scrollend where the browser has it; a pause after the last scroll event everywhere.
    el.addEventListener("scrollend", settle);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up);
    el.addEventListener("touchcancel", up);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scrollend", settle);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, [measure, recentre, mid]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // Taps faster than the glide never run out of row.
    recentre();
    el.scrollBy({ left: dir * measure().step, behavior: "smooth" });
  };
  const arrow =
    "absolute top-[calc(50%-46px)] z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-forest shadow-[0_4px_14px_rgb(59_46_37/0.22)] active:bg-wash md:grid";

  return (
    <div className="relative mt-4">
      {/* On a phone the row runs to both screen edges, and the 16px gap matches the side padding so the tile before ends right at the edge. */}
      <ul
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:scroll-px-0 md:gap-2.5 md:px-0"
      >
        {Array.from({ length: 2 * mid + 1 }, (_, copy) =>
          dishes.map((d, i) => (
            <MiniTile key={`${copy}-${d.id}`} dish={d} tint={MINI_TINTS[i % 2]} copy={copy !== mid} onDish={onDish} onAdd={onAdd} />
          ))
        )}
      </ul>
      <button type="button" aria-label="Previous dishes" onClick={() => go(-1)} className={`${arrow} -left-3`}>
        <ChevronLeft width={20} height={20} strokeWidth={2.4} />
      </button>
      <button type="button" aria-label="Next dishes" onClick={() => go(1)} className={`${arrow} -right-3`}>
        <ChevronRight width={20} height={20} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** My order's title bar, forest. */
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
  /** How many of this dish are in the order, all picks together. */
  inOrder: number;
  /** Adds this many, with these picks. */
  onAdd: (n: number, picks: DishOption[]) => void;
  onClose: () => void;
}) {
  const sizes = offered(dish, "size");
  const addons = offered(dish, "addon");
  const spices = offered(dish, "spice");
  const lists = choiceLists(dish);
  const hasOptions = sizes.length + lists.length + addons.length + spices.length > 0;
  // How many the next Add puts in, and with what; back to the start after each add.
  const [n, setN] = useState(1);
  const [picked, setPicked] = useState(() => startPicks(dish));
  const picks = resolvePicks(dish, [...picked]);
  const ready = dish.available && picks !== null;
  const unit = dish.priceCents + extraCents(picks ?? []);

  const pick = (o: DishOption) => setPicked((prev) => togglePick(dish, prev, o));
  // Many dishes have the same one line and full text: say it once, beside the price.
  const full = dish.description.trim() !== dish.shortDescription.trim() ? dish.description.trim() : "";

  const addRow = (
    <>
      <div className="flex gap-3">
        {dish.available && (
          <div className="flex h-[52px] shrink-0 items-center rounded-xl border border-line" role="group" aria-label="How many">
            <button
              type="button"
              disabled={n <= 1}
              onClick={() => setN(n - 1)}
              aria-label="One less"
              className="grid h-full w-12 place-items-center rounded-l-xl active:bg-wash disabled:text-muted/50"
            >
              <MinusIcon width={20} height={20} />
            </button>
            <span className="w-7 text-center text-[18px] font-semibold tabular-nums" aria-live="polite">
              {n}
            </span>
            <button
              type="button"
              disabled={n >= 20}
              onClick={() => setN(n + 1)}
              aria-label="One more"
              className="grid h-full w-12 place-items-center rounded-r-xl active:bg-wash disabled:text-muted/50"
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
          className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-leaf px-3 text-[17px] font-semibold text-white active:bg-leaf-dark disabled:bg-wash disabled:text-muted"
        >
          {!dish.available ? (
            "Not Available Today"
          ) : !picks ? (
            `Choose a ${missingPick(dish, picked) ?? "size"}`
          ) : (
            <>
              <span className="truncate">{n > 1 ? `Add ${n}` : "Add to order"}</span>
              <span className="shrink-0 text-white/75">{formatPrice(unit * n)}</span>
            </>
          )}
        </button>
      </div>
      <p className="mt-2 h-5 text-center text-sm text-muted" aria-live="polite">
        {inOrder > 0 ? `${inOrder} in your order` : ""}
      </p>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Tablets and up: the photo takes the left half, full height. */}
      <DishPhotos key={dish.id} dish={dish} sizes="420px" className="hidden md:block md:w-[46%] md:shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 pb-3 pl-4 pr-2 pt-3 md:pl-6 md:pr-3 md:pt-5">
        <h2 className="pt-1.5 font-display text-[26px] font-bold leading-tight">{dish.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash active:bg-line">
          <CloseIcon width={20} height={20} />
        </button>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
          hasOptions ? "pb-6" : "pb-[calc(24px+env(safe-area-inset-bottom))]"
        }`}
      >
        <DishPhotos key={dish.id} dish={dish} sizes="100vw" className="mx-4 aspect-[4/3] rounded-2xl md:hidden" />

        <div className="px-4 md:px-6">
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className={`text-[15px] ${full ? "text-muted" : "text-ink"}`}>{dish.shortDescription}</p>
            <p className="shrink-0 font-display text-[26px] font-bold">{formatPrice(dish.priceCents)}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <PeopleIcon width={20} height={20} />
              {servesLabel(dish.servesMin, dish.servesMax)}
            </span>
            {dish.spiceLevel !== null && <SpiceMeter level={dish.spiceLevel} />}
          </div>

          {full && <p className="mt-4 text-[16px] leading-relaxed">{full}</p>}

          {sizes.length > 0 && (
            <PickList title={sizeTitle(dish)} required={dish.sizeRequired} options={sizes} picked={picked} onPick={pick} />
          )}
          {/* Set meals: one pick from each list ("Drink", "Side"), always required. */}
          {lists.map((l) => (
            <PickList key={l.name} title={l.name} required options={l.options} picked={picked} onPick={pick} />
          ))}

          {addons.length + spices.length > 0 && <Extras addons={addons} spices={spices} picked={picked} onPick={pick} />}

          {!hasOptions && <div className="mt-5">{addRow}</div>}

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

      {/* With options the sheet scrolls further, so Add stays in reach at the bottom. */}
      {hasOptions && (
        <div className="shrink-0 border-t border-line px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-3 md:px-6">{addRow}</div>
      )}
      </div>
    </div>
  );
}

/** A pick-one section of the dish sheet: Size, or a set meal's list such as "Drink". */
function PickList({
  title,
  required,
  options,
  picked,
  onPick,
}: {
  title: string;
  required: boolean;
  options: DishOption[];
  picked: Set<string>;
  onPick: (o: DishOption) => void;
}) {
  const done = options.some((o) => picked.has(o.id));
  return (
    <div role="radiogroup" aria-label={title} className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[19px] font-bold">{title}</h3>
        {required && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${done ? "bg-leaf-tint text-ink" : "bg-mango text-forest"}`}>
            {done ? "Picked" : "Required"}
          </span>
        )}
      </div>
      <p className="text-sm text-muted">Choose 1</p>
      <div className="mt-2.5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {options.map((o) => (
          <OptionRow key={o.id} option={o} on={picked.has(o.id)} round onPick={() => onPick(o)} />
        ))}
      </div>
    </div>
  );
}

/** One choice: a full-width row with a radio or tick mark, its name and what it adds. */
function OptionRow({ option, on, round, onPick }: { option: DishOption; on: boolean; round: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role={round ? "radio" : "checkbox"}
      aria-checked={on}
      onClick={onPick}
      className={`flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left ${on ? "bg-leaf-tint" : "bg-white active:bg-wash"}`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center border-2 ${round ? "rounded-full" : "rounded-[7px]"} ${
          on ? "border-leaf bg-leaf text-white" : "border-muted/50 bg-white"
        }`}
        aria-hidden
      >
        {on && (round ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : <CheckIcon width={16} height={16} />)}
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-medium">{option.name}</span>
      {option.priceCents > 0 && <span className="shrink-0 text-[15px] tabular-nums text-muted">+{formatPrice(option.priceCents)}</span>}
    </button>
  );
}

/** Add-ons and spice behind one "+" line, so a guest who wants the dish as it comes can skip them. */
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
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left active:bg-wash"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-leaf-tint" aria-hidden>
          {open ? <MinusIcon width={16} height={16} /> : <PlusIcon width={16} height={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">{title}</span>
          {chosen && <span className="block text-[13px] text-muted">{chosen}</span>}
        </span>
      </button>
      {open && addons.length > 0 && (
        <div role="group" aria-label="Add-ons" className="border-t border-line">
          <p className="px-3.5 pb-0.5 pt-2.5 text-[13px] font-bold text-muted">Add-ons · Choose any</p>
          <div className="divide-y divide-line">
            {addons.map((o) => (
              <OptionRow key={o.id} option={o} on={picked.has(o.id)} round={false} onPick={() => onPick(o)} />
            ))}
          </div>
        </div>
      )}
      {open && spices.length > 0 && (
        <div role="radiogroup" aria-label="Spice" className="border-t border-line">
          <p className="px-3.5 pb-0.5 pt-2.5 text-[13px] font-bold text-muted">Spice · Choose 1</p>
          <div className="divide-y divide-line">
            {spices.map((o) => (
              <OptionRow key={o.id} option={o} on={picked.has(o.id)} round onPick={() => onPick(o)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrderList({
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
  setNote: (id: string, text: string) => void;
  sent: GuestOrders | null;
  canSend: boolean;
  demo: boolean;
  sending: boolean;
  sendError: string;
  onSend: () => void;
  /** "" when the guest skipped it. */
  nickname: string;
  onNickname: () => void;
  onClose: () => void;
}) {
  const total = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
  const hasSent = !!sent && sent.batches.length > 0;

  // The last one of a dish taken off: it can come back, note and all, for a few seconds.
  const [removed, setRemoved] = useState<{ key: string; qty: number; note: string; name: string } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);
  const remove = (key: string, name: string) => {
    setRemoved({ key, qty: 1, note: notes[key] ?? "", name });
    setQty(key, 0);
  };
  const undo = () => {
    if (!removed) return;
    setQty(removed.key, removed.qty);
    if (removed.note) setNote(removed.key, removed.note);
    setRemoved(null);
  };

  return (
    <>
      <PanelTitle title="My order" onClose={onClose} closeLabel="Close my order" />

      {removed && (
        <div role="status" className="flex shrink-0 items-center justify-between gap-3 bg-mango-soft py-1.5 pl-4 pr-2 text-[15px]">
          <span className="min-w-0 truncate">
            Removed <span className="font-semibold">{removed.name}</span>
          </span>
          <button type="button" onClick={undo} className="h-10 shrink-0 rounded-lg px-3 font-semibold text-forest underline underline-offset-2 active:bg-white/50">
            Undo
          </button>
        </div>
      )}

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
                  {lines.map(({ key, dish, label, unitCents, qty }, i) => (
                    <li key={key} className="py-3">
                      <div className="flex items-center gap-3">
                        <DishImage dish={dish} className="aspect-square w-14 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{dish.name}</p>
                          {label && <p className="text-sm leading-snug">{label}</p>}
                          <p className="text-sm text-muted">{formatPrice(unitCents * qty)}</p>
                        </div>
                        <div className="flex shrink-0 items-center rounded-full border border-line">
                          {/* At one, the minus says what it does: takes the dish off. */}
                          {qty > 1 ? (
                            <button type="button" onClick={() => setQty(key, qty - 1)} aria-label={`One less ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-wash">
                              <MinusIcon width={18} height={18} />
                            </button>
                          ) : (
                            <button type="button" onClick={() => remove(key, dish.name)} aria-label={`Remove ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full text-chili active:bg-wash">
                              <TrashIcon width={18} height={18} />
                            </button>
                          )}
                          <span className="w-5 text-center font-semibold tabular-nums">{qty}</span>
                          <button type="button" onClick={() => setQty(key, qty + 1)} aria-label={`One more ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-wash">
                            <PlusIcon width={18} height={18} />
                          </button>
                        </div>
                      </div>
                      {canSend && <NoteField id={`note-${i}`} note={notes[key] ?? ""} onNote={(t) => setNote(key, t)} />}
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

/**
 * "Add a note" under a dish in My order; tapping it opens a labelled box.
 * The note goes to the waiter with the dish ("no egg, less spicy").
 */
function NoteField({ id, note, onNote }: { id: string; note: string; onNote: (t: string) => void }) {
  const [open, setOpen] = useState(note !== "");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-[68px] mt-1 flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-[14px] font-semibold text-leaf active:bg-leaf-tint"
      >
        <PlusIcon width={16} height={16} />
        Add a note
      </button>
    );
  }
  return (
    <div className="ml-[68px] mt-2">
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
        className="mt-1 block h-11 w-full rounded-xl border border-line bg-white px-3 text-[16px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20"
      />
    </div>
  );
}

/** What this phone already sent, batch by batch, and whether the waiter has seen each. Read-only: the waiter has it. */
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
          <p
            className={`mx-4 mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${b.seenAt ? "text-leaf" : "text-muted"}`}
          >
            {b.seenAt ? (
              <>
                <CheckIcon width={16} height={16} />
                Your waiter has it
              </>
            ) : (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-mango motion-reduce:animate-none" aria-hidden />
                Waiting for your waiter to see it
              </>
            )}
          </p>
          <ul className="px-4">
            {b.lines.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[15px]">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{l.qty}×</span> {l.name}
                  {l.options && <span className="block text-[13px]">{l.options}</span>}
                  {l.note && <span className="block text-[13px] italic text-muted">“{l.note}”</span>}
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
 * Home on the left, the whole menu in the middle, the order on the right, on a
 * dark band edge to edge.
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
    `flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[12px] font-semibold ${on ? "text-mango" : "text-white/80 active:bg-white/10"}`;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 bg-forest pb-[env(safe-area-inset-bottom)] text-white md:hidden">
      <div className="mx-auto grid h-[60px] max-w-md grid-cols-[1fr_1fr_1.5fr] items-center gap-1 px-2">
        <button type="button" onClick={onHome} aria-current={view === "home" ? "page" : undefined} className={tab(view === "home")}>
          <HomeIcon width={22} height={22} />
          Home
        </button>
        <button type="button" onClick={onMenu} aria-current={view === "menu" ? "page" : undefined} className={tab(view === "menu")}>
          <ClocheIcon width={22} height={22} />
          Menu
        </button>
        <button
          type="button"
          onClick={onOrder}
          aria-label={count ? `My order, ${count} items, ${formatPrice(total)}` : "My order"}
          className="flex h-11 min-w-0 items-center justify-center gap-2.5 rounded-lg bg-mango px-2 text-[15px] font-bold text-forest active:brightness-95"
        >
          <span className="relative shrink-0">
            <BagIcon width={20} height={20} />
            {count > 0 && <CountBadge count={count} />}
          </span>
          {/* With something in it, still "My order", the total under it. */}
          {count ? (
            <span className="min-w-0 text-left leading-none">
              <span className="block truncate text-[12px] font-semibold">My order</span>
              <span className="mt-0.5 block truncate text-[15px]">{formatPrice(total)}</span>
            </span>
          ) : (
            <span className="truncate">My order</span>
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
  top = false,
  onDone,
}: {
  toast: Toast | null;
  /** Design B: at the top, because the bottom of the screen holds the dish's buttons. */
  top?: boolean;
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
        top ? "top-[calc(72px+env(safe-area-inset-top))]" : "bottom-[calc(92px+env(safe-area-inset-bottom))] md:bottom-8"
      }`}
    >
      {toast && (
        <div key={toast.key} className="flex items-center gap-3 rounded-2xl bg-forest py-2.5 pl-2.5 pr-5 text-white shadow-[0_10px_28px_rgb(59_46_37/0.35)]">
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
