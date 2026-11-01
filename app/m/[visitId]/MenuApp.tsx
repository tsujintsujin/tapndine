"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BASE_PATH } from "@/lib/base";
import type { Dish, Menu } from "@/lib/menu";
import type { CallKind, GuestOrders } from "@/lib/orders";
import { fold, formatPrice, formatTime, servesLabel } from "@/lib/format";
import { randomId } from "@/lib/ids";
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
  startPicks,
  togglePick,
  type DishOption,
} from "@/lib/options";
import Expired from "@/app/components/Expired";
import {
  BagIcon,
  BellIcon,
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
  ReceiptIcon,
  SearchIcon,
} from "@/app/components/Icons";
import Sheet from "./Sheet";
import { closeParam, notePop, setParams } from "./history";
import MenuB from "./MenuB";
import { DishImage, SpiceMeter } from "./parts";

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
function useSent(visitId: string, onDead: () => void, watch: boolean) {
  const [sent, setSent] = useState<GuestOrders | null>(null);
  const [calls, setCalls] = useState<OpenCall[]>([]);
  const deadRef = useRef(onDead);
  deadRef.current = onDead;

  const load = useCallback(() => {
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
  }, [visitId]);

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
  demo,
}: {
  visitId: string;
  menu: Menu;
  expiresAt: number;
  /** False for a tag not placed at a table: there is no waiter to send to. */
  canSend: boolean;
  /** The homepage's demo menu: says ordering is in the real thing. */
  demo: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const view = params.get("v") === "menu" ? "menu" : "home";
  const dishId = params.get("d");
  const orderOpen = params.get("o") === "1";

  const [callOpen, setCallOpen] = useState(false);
  const { expired, expire } = useVisitAlive(visitId, expiresAt);
  const { order, setQty, clear, notes, setNote } = useOrder(visitId);
  const lines = orderLines(menu, order);
  const { sent, setSent, calls, setCalls, load: loadSent } = useSent(visitId, expire, orderOpen || callOpen);
  const { nick, save: saveNick } = useNickname();
  const [nickOpen, setNickOpen] = useState(false);
  // The nickname is asked the first time this phone sends, not on opening the
  // menu: looking comes first. True while that question stands between the
  // guest and their send.
  const [sendAfterNick, setSendAfterNick] = useState(false);
  // The category tag picked on the whole menu; null is All.
  const [categoryId, setCategoryId] = useState<string | null>(null);

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
    window.scrollTo(0, view === "home" ? homeScroll.current : 0);
    lastView.current = view;
  }, [view]);

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
      setToast({ key: Date.now(), title: "Sent to your waiter", detail: `${itemCount} ${itemCount === 1 ? "item" : "items"}` });
    } catch (e) {
      setSendError(e instanceof TypeError ? "No connection. Check your signal and try again." : (e as Error).message);
    } finally {
      setSending(false);
    }
  };
  /** Send to waiter: first time on this phone, ask what to call them, then send. */
  const trySend = () => {
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
        nickname={nick || ""}
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

  return (
    <>
      <Header
        nickname={nick || ""}
        businessName={menu.businessName}
        logoUrl={menu.logoUrl}
        tableLabel={menu.tableLabel}
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
            <CategoryTags menu={menu} current={categoryId} onPick={pickCategory} />
          </>
        )}
      </Header>

      {/* Room for the fixed bottom bar. On phones the page is laid out for the
          screen without the address bar (100lvh) while the bar sits above the
          address bar, so a short page ends that much under the bar and can't
          scroll further: add the difference (0 on desktop). */}
      <main className="pb-[calc(112px_+_env(safe-area-inset-bottom)_+_100lvh_-_100svh)] md:pb-16">
        <div key={view} className="view-in">
          {view === "menu" ? (
            <WholeMenu menu={menu} categoryId={categoryId} onDish={openDish} onAdd={quickAdd} onPick={pickCategory} />
          ) : (
            <HomeView menu={menu} onDish={openDish} onAdd={quickAdd} onMenu={openMenu} />
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

      <Sheet open={!!dish} onClose={() => closeParam("d")} from="bottom" label={dish?.name ?? "Dish"}>
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
          nickname={nick || ""}
          onNickname={() => setNickOpen(true)}
          onClose={() => closeParam("o")}
        />
      </Sheet>

      {shared}
    </>
  );
}

/**
 * "What should we call you?" A small native dialog over the menu. Skip (or
 * Esc) keeps whatever name the phone had, or none: the waiter then sees Guest #.
 */
function NicknamePrompt({
  open,
  initial,
  sending,
  onDone,
}: {
  open: boolean;
  initial: string;
  /** Asked on the way to Send to waiter: the buttons say so. */
  sending: boolean;
  onDone: (v: string) => void;
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
        onDone(initial);
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
 * Stays at the top while the page scrolls; on the whole menu it also holds
 * the search and the category tags (`children`).
 */
function Header({
  nickname,
  businessName,
  logoUrl,
  tableLabel,
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
  tableLabel: string | null;
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
    `flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold ${
      on ? "bg-leaf-tint text-ink" : "text-muted hover:bg-wash hover:text-ink"
    }`;
  const who = [tableLabel, nickname ? `Hi ${nickname}` : null].filter(Boolean).join(" · ");
  return (
    <header className="sticky top-0 z-20 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 md:max-w-5xl md:px-6 lg:max-w-6xl">
        <div className="flex h-[72px] items-center justify-between gap-3 md:h-20">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full bg-white object-contain ring-1 ring-line" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[22px] font-bold leading-tight">{businessName}</p>
              {onNickname ? (
                <button
                  type="button"
                  onClick={onNickname}
                  className="-mx-1.5 -my-1 flex min-h-8 max-w-full items-center gap-1 rounded-lg px-1.5 text-[14px] leading-tight text-muted active:bg-wash"
                >
                  <span className="truncate">{who || "Add your name"}</span>
                  <span className="shrink-0 font-semibold text-leaf">{nickname ? "Edit" : who ? "· Add name" : ""}</span>
                  <span className="sr-only">Change your nickname</span>
                </button>
              ) : (
                who && <p className="truncate text-[14px] leading-tight text-muted">{who}</p>
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
              className="ml-2 flex h-12 items-center gap-2.5 rounded-full border border-line bg-white pl-4 pr-5 text-[15px] font-semibold hover:border-leaf"
            >
              <span className="relative">
                <BagIcon width={20} height={20} />
                {itemCount > 0 && <CountBadge count={itemCount} />}
              </span>
              My order
              {itemCount > 0 && <span className="text-muted">{formatPrice(orderTotal)}</span>}
            </button>
          </nav>
          {onCall ? (
            <button
              type="button"
              onClick={onCall}
              aria-label={calling ? "Call your waiter, a call is waiting" : "Call your waiter or ask for the bill"}
              className="relative flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-leaf pl-3 pr-4 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgb(59_46_37/0.3)] active:bg-leaf-dark"
            >
              <BellIcon width={22} height={22} />
              Waiter
              {calling && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-mango ring-2 ring-paper" aria-hidden />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOrder}
              aria-label={itemCount ? `My order, ${itemCount} items` : "My order"}
              className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-leaf text-white shadow-[0_6px_16px_rgb(59_46_37/0.3)] active:bg-leaf-dark md:hidden"
            >
              <BagIcon width={22} height={22} />
              {itemCount > 0 && <CountBadge count={itemCount} />}
            </button>
          )}
        </div>
        {children && <div className="pb-3 lg:hidden">{children}</div>}
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
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[60dvh] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_14px_36px_rgb(59_46_37/0.2)] ring-1 ring-line"
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

/**
 * Every dish, or one category's: two to a row on phones, three on tablets.
 * On desktop the search and categories leave the header for a rail on the
 * left, and the dishes fill the rest, up to four to a row.
 */
function WholeMenu({
  menu,
  categoryId,
  onDish,
  onAdd,
  onPick,
}: {
  menu: Menu;
  categoryId: string | null;
  onDish: (id: string) => void;
  onAdd: (id: string) => void;
  onPick: (id: string | null) => void;
}) {
  const category = categoryId ? menu.categories.find((c) => c.id === categoryId) : undefined;
  const ids = category ? category.dishIds : menu.dishOrder;
  const rail = [{ id: null, name: "All dishes", count: menu.dishOrder.length }, ...menu.categories.map((c) => ({ id: c.id, name: c.name, count: c.dishIds.length }))];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-2 md:max-w-5xl md:px-6 lg:grid lg:max-w-6xl lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:px-6 lg:pt-4">
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <DishSearch menu={menu} onDish={onDish} />
        <div role="group" aria-label="Categories" className="mt-5 flex flex-col gap-0.5">
          {rail.map((t) => {
            const on = t.id === categoryId;
            return (
              <button
                key={t.id ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => onPick(t.id)}
                className={`flex h-11 items-center justify-between rounded-xl px-4 text-left text-[15px] font-semibold ${
                  on ? "bg-leaf text-white" : "text-ink hover:bg-wash"
                }`}
              >
                <span className="truncate">{t.name}</span>
                <span className={`shrink-0 text-[13px] font-medium ${on ? "text-white/70" : "text-muted"}`}>{t.count}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <section aria-label={category?.name ?? "All dishes"} className="min-w-0">
        <h2 className="mb-5 hidden font-display text-[28px] font-bold leading-tight lg:block">{category?.name ?? "All dishes"}</h2>
        {ids.length === 0 && (
          <div className="pb-6 pt-2">
            <ul aria-hidden="true" className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:gap-x-5 xl:grid-cols-4">
              {[1, 0.7, 0.45, 0.25].map((o, i) => (
                <li key={i} style={{ opacity: o }} className={i > 1 ? "hidden sm:block" : ""}>
                  <span className="block rounded-[22px] bg-leaf-tint p-2">
                    <span className="block aspect-square rounded-2xl bg-white/70" />
                  </span>
                  <span className="mt-4 block h-4 w-3/4 rounded-full bg-wash" />
                  <span className="mt-2 block h-3.5 w-1/3 rounded-full bg-wash" />
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center text-[16px] text-muted">
              {category ? "No dishes here yet." : "No dishes yet. They show up here as soon as the restaurant adds them."}
            </p>
          </div>
        )}
        <ul key={categoryId ?? "all"} className="view-in grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-4">
          {ids.map((id) => (
            <li key={id}>
              <GridCard dish={menu.dishes[id]} onOpen={() => onDish(id)} onAdd={() => onAdd(id)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
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
  if (!all.length) return <MenuSoon name={menu.businessName} />;
  const hero = all.find((d) => d.featured) ?? all[0];
  const featured = all.filter((d) => d.bestSeller && d.id !== hero?.id).slice(0, 3);
  const fresh = all.filter((d) => d.isNew && d.id !== hero?.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl md:max-w-5xl md:px-6 md:pt-2 lg:max-w-6xl">
      {hero && <Hero dish={hero} onOpen={() => onDish(hero.id)} onAdd={() => onAdd(hero.id)} onMenu={onMenu} />}

      <div className="lg:grid lg:grid-cols-2 lg:gap-10">
        {featured.length > 0 && (
          <MiniRow title="Featured dishes" rowId="featured" dishes={featured} onDish={onDish} onAdd={onAdd} />
        )}
        {fresh.length > 0 && <MiniRow title="New on the menu" rowId="new" dishes={fresh} onDish={onDish} onAdd={onAdd} />}
      </div>

      <div className="mt-10 px-4 md:mx-auto md:max-w-md md:px-0">
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
        <DishImage dish={dish} eager onDark className="h-full w-full" />
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
    <section className="mt-10 px-4 md:px-0" aria-labelledby={titleId}>
      <SectionTitle id={titleId}>{title}</SectionTitle>
      <ul className="mt-4 grid grid-cols-3 gap-2.5">
        {dishes.map((d, i) => (
          <li key={d.id} className={`flex flex-col rounded-[20px] p-1.5 pb-2 ${MINI_TINTS[i % MINI_TINTS.length]}`}>
            <button type="button" onClick={() => onDish(d.id)} className="relative block text-center">
              <DishImage dish={d} className="aspect-square rounded-[14px]" />
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
        ))}
      </ul>
    </section>
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
      <DishImage dish={dish} eager className="hidden md:block md:w-[46%] md:shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 pb-3 pl-4 pr-2 pt-[calc(12px+env(safe-area-inset-top))] sm:pt-3 md:pl-6 md:pr-3 md:pt-5">
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
        <DishImage dish={dish} eager className="mx-4 aspect-[4/3] rounded-2xl md:hidden" />

        <div className="px-4 md:px-6">
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

          {sizes.length > 0 && (
            <PickList title="Size" required={dish.sizeRequired} options={sizes} picked={picked} onPick={pick} />
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

  return (
    <>
      <PanelTitle title="My order" onClose={onClose} closeLabel="Close my order" />

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
                          <button type="button" onClick={() => setQty(key, qty - 1)} aria-label={`One less ${dish.name}`} className="grid h-10 w-10 place-items-center rounded-full active:bg-wash">
                            <MinusIcon width={18} height={18} />
                          </button>
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
      className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper from-60% to-paper/0 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-6 md:hidden"
    >
      <div className="mx-auto grid h-[60px] max-w-md grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full bg-leaf px-2 text-white shadow-[0_10px_28px_rgb(59_46_37/0.35)]">
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
