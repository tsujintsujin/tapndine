"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import {
  CardIcon,
  ClocheIcon,
  CloseIcon,
  GridIcon,
  HomepageIcon,
  NfcIcon,
  PeopleIcon,
  SlidersIcon,
  TableIcon,
  TagIcon,
} from "@/app/components/Icons";
import { btn } from "./kit";
import { api, useStaffInfo } from "./ui";

// The guide: a walk through every manager page, shown on Cove Café (the
// server swaps it in while the guide is on, and refuses every change). It is
// offered once, the first time a manager opens tapndine, and from Settings.
// Each page has a few frames; a frame lights up the part of the page it talks
// about (the `target` elements, marked with data-guide on the pages) and
// darkens the rest.

type Frame = { target: string; title: string; text: string };

/** One stop per page in the sidebar, in its order. */
export const GUIDE_STEPS: { href: string; title: string; Icon: typeof GridIcon; frames: Frame[] }[] = [
  {
    href: "/admin/dashboard",
    title: "Dashboard",
    Icon: GridIcon,
    frames: [
      {
        target: '[data-guide="stats"]',
        title: "The top row",
        text: "What guests sent and how many groups came, next to the period before. Ordering now counts the tables with open orders.",
      },
      {
        target: 'nav[aria-label="Period"], [data-guide="period"]',
        title: "Pick a period",
        text: "Today, the last 7 days or the last 30. Pick one table to see only its numbers.",
      },
      {
        target: '[data-guide="when"]',
        title: "When guests order",
        text: "Sales by day, and the busy hours of a typical week. Plan your waiters around them.",
      },
      {
        target: '[data-guide="top-dishes"]',
        title: "Top dishes",
        text: "What sells best in this period, and the dishes nobody ordered.",
      },
    ],
  },
  {
    href: "/admin",
    title: "Tables",
    Icon: TableIcon,
    frames: [
      {
        target: '[data-guide="tables"]',
        title: "Every table, live",
        text: "A dark table has guests ordering, with the total of their open orders. This screen refreshes by itself every few seconds.",
      },
      {
        target: '[data-guide="needs-you"]',
        title: "Tables that need you",
        text: "A ring means a new order, a call for the waiter or a request for the bill. Open the table to see the orders by guest and key them into your POS. The ring clears once someone opens it.",
      },
    ],
  },
  {
    href: "/admin/links",
    title: "Menu links",
    Icon: NfcIcon,
    frames: [
      {
        target: '[data-guide="first-link"]',
        title: "One link per table",
        text: "Copy a table's link and write it to the NFC tag on that table with any NFC app, or open its QR code to print. Guests who tap it get your menu, and their orders come to that table.",
      },
      {
        target: '[data-guide="add-table"]',
        title: "Add a table",
        text: "Your plan sets how many tables you can have.",
      },
    ],
  },
  {
    href: "/admin/menu",
    title: "Menu",
    Icon: ClocheIcon,
    frames: [
      {
        target: '[data-guide="first-dish"], [data-guide="first-dishes"]',
        title: "Your dishes",
        text: "Everything guests can order, in the order they see it. Drag a dish to move it. Open one to change its photos, price, sizes, add-ons and spice choices.",
      },
      {
        target: '[data-guide="first-dish"] [role="switch"]',
        title: "Ran out of something?",
        text: "Switch off Available today and guests see the dish can't be ordered. Switch it back on when you have it again.",
      },
      {
        target: '[data-guide="add-dish"]',
        title: "Add dishes",
        text: "Add one dish at a time, or bring in a whole menu from a spreadsheet with Import CSV.",
      },
    ],
  },
  {
    href: "/admin/homepage",
    title: "Homepage",
    Icon: HomepageIcon,
    frames: [
      {
        target: '[aria-labelledby="hero-title"]',
        title: "The hero",
        text: "The big photo at the top of the menu's first screen. Pick the dish it shows.",
      },
      {
        target: '[aria-labelledby="hero-title"] + [data-guide="home-rows"]',
        title: "The rows under it",
        text: "Rows of dishes under the hero, like Featured dishes. Choose the ones you want guests to notice, and remove the rest.",
      },
      {
        target: '[data-guide="preview"]',
        title: "See it as a guest",
        text: "Check your changes the way guests see them on their phones.",
      },
    ],
  },
  {
    href: "/admin/categories",
    title: "Categories",
    Icon: TagIcon,
    frames: [
      {
        target: '[data-guide="first-categories"]',
        title: "Categories",
        text: "The tags guests filter the menu by, like Rice meals or Drinks, with sub-categories under them. Drag to reorder. Open one to rename it, pick its icon and choose its dishes.",
      },
      {
        target: '[data-guide="add-category"]',
        title: "Add a category",
        text: "Make a new tag, or a sub-category inside one.",
      },
    ],
  },
  {
    href: "/admin/manage",
    title: "Staff",
    Icon: PeopleIcon,
    frames: [
      {
        target: '[data-guide="logins"]',
        title: "Who can log in",
        text: "Everyone on your team with a login. Waiters see only Tables and each table's orders. Managers see every page in this guide.",
      },
      {
        target: '[data-guide="add-login"]',
        title: "Add a login",
        text: "Make a login for a waiter or a manager. They log in with the username and password you set here.",
      },
    ],
  },
  {
    href: "/admin/settings",
    title: "General",
    Icon: SlidersIcon,
    frames: [
      {
        target: '[aria-labelledby="logo-title"]',
        title: "Your logo",
        text: "It sits next to your name at the top of the guests' menu.",
      },
      {
        target: '[aria-labelledby="palette-title"]',
        title: "Menu colors",
        text: "The colors guests see on their phones. Pick one and it saves right away.",
      },
      {
        target: '[aria-labelledby="guide-title"]',
        title: "This guide",
        text: "Open it again any time with See guide.",
      },
    ],
  },
  {
    href: "/admin/plan",
    title: "Subscription",
    Icon: CardIcon,
    frames: [
      {
        target: '[data-guide="plan"]',
        title: "Your plan",
        text: "How many tables your plan covers, and until when. On the free trial, this is where you pick a plan to keep everything you set up.",
      },
    ],
  },
];

/** The step for this page (a table counts as Tables, a dish as Menu), or -1 for a page the tour skips. */
const stepAt = (path: string) =>
  GUIDE_STEPS.findIndex(({ href }) =>
    href === "/admin" ? path === "/admin" || path.startsWith("/admin/t/") : path === href || path.startsWith(href + "/")
  );
/** The last step shown, so a page off the tour can lead back to it. */
let lastStep = 0;
/** Back from a page's first frame opens the page before at its last frame. */
let enterAtEnd = false;

/** Turns the guide on or off, then opens the Dashboard (Cove Café's, or their own again). */
export async function switchGuide(on: boolean) {
  await api("/api/staff/guide", { method: "POST", body: { on } });
  window.location.assign(`${BASE_PATH}/admin/dashboard`);
}

/** The first time a manager opens tapndine: take the tour, or not now. */
function Welcome() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const notNow = async () => {
    setOpen(false);
    // Remembered on the account, so it isn't offered again on another phone.
    await api("/api/staff/guide", { method: "POST", body: { on: false } }).catch(() => {});
  };
  useEffect(() => {
    startRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && notNow();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-forest/50 sm:place-items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-welcome-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 sm:max-w-[480px] sm:rounded-[28px] sm:p-7"
      >
        <p className="text-[14px] font-semibold text-muted">Welcome to tapndine</p>
        <h2 id="guide-welcome-title" className="mt-1 font-display text-[26px] font-bold leading-tight">
          Want a quick tour?
        </h2>
        <p className="mt-2 text-[15px] text-muted">
          We'll walk you through each page using <span className="font-semibold text-ink">Cove Café</span>, a restaurant
          with its menu already filled in. Nothing you click in the tour is saved. It takes about two minutes.
        </p>
        <ol className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2.5">
          {GUIDE_STEPS.map(({ title, Icon }, i) => (
            <li key={title} className="flex items-center gap-2.5 text-[15px] font-medium">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper text-forest">
                <Icon width={17} height={17} aria-hidden />
              </span>
              <span>
                <span className="sr-only">{i + 1}. </span>
                {title}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={notNow} className={btn.secondary}>
            Not now
          </button>
          <button
            ref={startRef}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await switchGuide(true).catch(() => setBusy(false));
            }}
            className={btn.primary}
          >
            {busy ? "Opening…" : "Start the tour"}
          </button>
        </div>
        <p className="mt-4 text-center text-[13px] text-muted sm:text-right">You can open it again any time from Settings.</p>
      </div>
    </div>
  );
}

type Box = { top: number; left: number; width: number; height: number };
/** Where the card sits on a computer. */
type Side = "right" | "left" | "top";
const SIDE_CLASS: Record<Side, string> = {
  right: "lg:bottom-6 lg:right-6",
  left: "lg:bottom-6 lg:left-[304px]",
  top: "lg:bottom-auto lg:right-6 lg:top-6",
};
/** Space around the lit part, so it doesn't touch the edge of the dark. */
const PAD = 8;
/** Where the card sits on a computer when it isn't on the right: just past the sidebar. */
const CARD_LEFT = 304;
const CARD_W = 400;
const DESKTOP = 1024;
/** On a phone the top bar is 64px tall. */
const PHONE_TOP = 76;

/** The box around every element `selector` finds that is on screen, or null when none is. */
function boxOf(selector: string): Box | null {
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  document.querySelectorAll(selector).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return; // hidden at this width (e.g. the phone-only preview button)
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  return top === Infinity ? null : { top: top - PAD, left: left - PAD, width: right - left + 2 * PAD, height: bottom - top + 2 * PAD };
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/**
 * Keeps the lit box on the frame's target as the page scrolls, resizes or
 * fills in, scrolls the target into the space the card leaves free when the
 * frame opens, and says which side the card should sit on (computers only) so
 * it doesn't cover what is lit.
 */
function useSpotlight(target: string, frameKey: string, card: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = useState<Box | null>(null);
  const [side, setSide] = useState<Side>("right");
  useEffect(() => {
    let raf = 0;
    let scrolled = false;
    let last = "";
    const tick = () => {
      // A frame whose part isn't on this page (no table needs you) lights the whole page.
      const found = boxOf(target);
      const b = found ?? boxOf("main");
      const W = window.innerWidth;
      const H = window.innerHeight;
      const cardH = card.current?.offsetHeight ?? 0;
      if (found && !scrolled) {
        scrolled = true;
        const freeTop = W >= DESKTOP ? 24 : PHONE_TOP;
        const freeBottom = W >= DESKTOP ? H - 24 : H - cardH - 12;
        if (found.top < freeTop || found.top + found.height > freeBottom) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollBy({ top: found.top - freeTop, behavior: smooth ? "smooth" : "auto" });
        }
      }
      const key = b ? `${Math.round(b.top)} ${Math.round(b.left)} ${Math.round(b.width)} ${Math.round(b.height)}` : "";
      if (key !== last) {
        last = key;
        setBox(b);
        if (b && W >= DESKTOP) {
          // Bottom right if it leaves the lit part clear, else bottom left, else top right.
          const at = (left: number, top: number): Box => ({ left, top, width: CARD_W, height: cardH });
          const bottom = H - 24 - cardH;
          setSide(
            !overlaps(b, at(W - 24 - CARD_W, bottom))
              ? "right"
              : !overlaps(b, at(CARD_LEFT, bottom))
                ? "left"
                : !overlaps(b, at(W - 24 - CARD_W, 24))
                  ? "top"
                  : "right"
          );
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, frameKey, card]);
  return { box, side };
}

/** Bottom sheet on a phone, a card in a bottom corner on a computer. */
const CARD =
  "fixed inset-x-0 bottom-0 z-[35] rounded-t-[26px] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_32px_rgb(16_52_42/0.18)] lg:inset-x-auto lg:w-[400px] lg:rounded-[26px] lg:p-6 lg:shadow-[0_12px_40px_rgb(16_52_42/0.22)]";

/** While the guide is on, on one of its pages: the lit part, what it is for, and the way on. */
function StepCard({ i }: { i: number }) {
  const router = useRouter();
  const step = GUIDE_STEPS[i];
  const frames = step.frames;
  // Read in the initializer, cleared after (React may run an initializer twice).
  const [f, setF] = useState(() => (enterAtEnd ? frames.length - 1 : 0));
  useEffect(() => {
    enterAtEnd = false;
  }, []);
  const frame = frames[f];
  const lastPage = i === GUIDE_STEPS.length - 1;
  const lastFrame = f === frames.length - 1;
  const next = GUIDE_STEPS[i + 1];
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const { box, side } = useSpotlight(frame.target, `${i}.${f}`, cardRef);

  const leave = async () => {
    setBusy(true);
    await switchGuide(false).catch(() => setBusy(false));
  };
  const goNext = () => (lastFrame ? router.push(next.href) : setF(f + 1));
  const goBack = () => {
    if (f > 0) return setF(f - 1);
    enterAtEnd = true;
    router.push(GUIDE_STEPS[i - 1].href);
  };

  return (
    <>
      {/* The dark: one box with a huge shadow, so everything outside the lit part is dimmed. Clicks pass through. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[34] rounded-[24px] transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
        style={{
          ...(box ?? { top: 0, left: 0, width: 0, height: 0 }),
          boxShadow: "0 0 0 200vmax rgb(28 22 18 / 0.6)",
        }}
      />
      <section ref={cardRef} aria-labelledby="guide-step-title" className={`${CARD} ${SIDE_CLASS[side]}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <step.Icon width={15} height={15} aria-hidden />
            {step.title} · {i + 1} of {GUIDE_STEPS.length}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={leave}
            aria-label="Leave the guide"
            className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        {/* One bar per page; this page's fills frame by frame. */}
        <div aria-hidden="true" className="-mt-1 flex gap-1">
          {GUIDE_STEPS.map(({ href }, n) => (
            <span key={href} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full bg-mango transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: n < i ? "100%" : n > i ? "0%" : `${((f + 1) / frames.length) * 100}%` }}
              />
            </span>
          ))}
        </div>
        <div aria-live="polite">
          <h2 id="guide-step-title" className="mt-3.5 font-display text-[21px] font-bold leading-tight">
            {frame.title}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink/85">{frame.text}</p>
        </div>
        <p className="mt-3 text-[13px] text-muted">Cove Café is a sample. Nothing you change here is saved.</p>
        <div className="mt-4 flex items-center gap-2.5">
          {i > 0 || f > 0 ? (
            <button type="button" onClick={goBack} className={`${btn.secondary} flex-1 lg:flex-none`}>
              Back
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={leave} className={`${btn.secondary} flex-1 lg:flex-none`}>
              Skip
            </button>
          )}
          {lastPage && lastFrame ? (
            <button type="button" disabled={busy} onClick={leave} className={`${btn.primary} flex-1 lg:ml-auto`}>
              {busy ? "Closing…" : "Finish"}
            </button>
          ) : (
            <button type="button" onClick={goNext} className={`${btn.primary} flex-1 lg:ml-auto`}>
              {lastFrame ? `Next: ${next.title}` : "Next"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}

/** While the guide is on, on a page it doesn't cover (a dish, Support): the way back to it. */
function OffTour() {
  const [busy, setBusy] = useState(false);
  return (
    <section aria-label="Guide" className={`${CARD} ${SIDE_CLASS.right} flex flex-wrap items-center gap-3`}>
      <p className="min-w-0 flex-1 basis-[200px] text-[15px] text-ink/85">This page isn't part of the tour.</p>
      <Link href={GUIDE_STEPS[lastStep].href} className={btn.primary}>
        Back to the tour
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await switchGuide(false).catch(() => setBusy(false));
        }}
        className={btn.secondary}
      >
        Leave
      </button>
    </section>
  );
}

export default function Guide() {
  const { guide, offerGuide } = useStaffInfo();
  const path = usePathname();
  if (path.startsWith("/admin/dev")) return null;
  if (!guide) return offerGuide ? <Welcome /> : null;
  const at = stepAt(path);
  if (at < 0) return <OffTour />;
  lastStep = at;
  // A new page starts its frames afresh.
  return <StepCard key={at} i={at} />;
}
