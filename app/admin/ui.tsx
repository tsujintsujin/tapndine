"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BASE_PATH, OPEN_COOKIE } from "@/lib/base";
import { ChevronLeft, MenuIcon } from "@/app/components/Icons";

// Pieces every staff screen shares. Staff screens are used on a phone in one
// hand, so everything you press is at least 44px tall.

/**
 * Who is on this page: a developer or not, the restaurant it shows (null: none
 * open), and when that restaurant's free trial ends (null: not on trial).
 */
export type StaffInfo = {
  developer: boolean;
  restaurant: { id: string; name: string } | null;
  trialEndsAt: number | null;
  /** In the guide: the page shows its sample restaurant and nothing saves. */
  guide: boolean;
  /** Offer the guide: a manager who has never finished or skipped it. */
  offerGuide: boolean;
};
const StaffContext = createContext<StaffInfo>({ developer: false, restaurant: null, trialEndsAt: null, guide: false, offerGuide: false });
export const useStaffInfo = () => useContext(StaffContext);

/** The restaurant this page was drawn for; api() refuses to act on another. */
let pageRestaurant: string | null = null;
/** This page is in the guide: api() saves nothing. */
let pageGuide = false;
/** What a change in the guide says instead of saving. */
export const GUIDE_NO_SAVE = "This is the guide, so nothing is saved. Leave the guide to change your own restaurant.";

export function StaffInfoProvider({ value, children }: { value: StaffInfo; children: React.ReactNode }) {
  pageRestaurant = value.restaurant?.id ?? null;
  pageGuide = value.guide;
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

/** fetch() under the base path, as JSON. A logged-out answer goes to the login screen. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  // The server refuses too; this says why instead of looking logged out.
  if (pageGuide && (init?.method ?? "GET") !== "GET" && path !== "/api/staff/guide" && path !== "/api/staff/logout") {
    throw new Error(GUIDE_NO_SAVE);
  }
  // A developer opened another restaurant in a different tab since this page
  // loaded. The server would act on the new one, so stop here instead.
  const open = document.cookie.match(new RegExp(`(?:^|; )${OPEN_COOKIE}=([^;]*)`))?.[1];
  if (open && pageRestaurant && !pageGuide && decodeURIComponent(open) !== pageRestaurant && !path.startsWith("/api/dev/")) {
    throw new Error("You opened another restaurant in a different tab. Reload this page.");
  }
  const res = await fetch(BASE_PATH + path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = `${BASE_PATH}/login`;
    throw new Error("logged out");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

/**
 * Keeps `initial` fresh by asking `path` every few seconds while the screen
 * is on (with `hiddenToo`, also when it isn't), and straight away when the
 * phone comes back to it.
 */
export function usePoll<T>(path: string, initial: T, pick: (data: unknown) => T, everyMs = 5000, hiddenToo = false) {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(false);
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const refresh = useCallback(async () => {
    try {
      setData(pickRef.current(await api<unknown>(path)));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [path]);

  useEffect(() => {
    const id = setInterval(() => {
      if (hiddenToo || document.visibilityState === "visible") refresh();
    }, everyMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, everyMs, hiddenToo]);

  return { data, refresh, offline };
}

export function StaffHeader({
  title,
  back,
  right,
}: {
  title: string;
  /** Where the back arrow goes, with its label. */
  back?: { href: string; label: string };
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-forest pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto grid h-14 max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 md:max-w-5xl md:px-4 lg:max-w-6xl">
        <div className="justify-self-start">
          {back ? (
            <Link href={back.href} className="flex h-11 items-center gap-0.5 rounded-lg pl-1 pr-3 text-[15px] font-medium active:bg-white/10">
              <ChevronLeft width={20} height={20} />
              {back.label}
            </Link>
          ) : (
            <span className="px-2 text-sm font-semibold uppercase tracking-wide text-mango">Staff</span>
          )}
        </div>
        <h1 className="truncate font-display text-lg font-bold">{title}</h1>
        <div className="flex items-center gap-1 justify-self-end">{right}</div>
      </div>
    </header>
  );
}

/**
 * The header on the top-level staff screens: just the menu button. The page
 * says what it is in its own title, under the header.
 */
export function StaffNav({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { href: "/admin/stats", label: "Statistics" },
    { href: "/admin", label: "Tables" },
    { href: "/admin/manage", label: "Staff" },
  ];
  const item = "flex h-12 w-full items-center px-4 text-left text-[16px] active:bg-wash";
  const logOut = async () => {
    setBusy(true);
    await api("/api/staff/logout", { method: "POST", body: {} }).catch(() => {});
    window.location.href = `${BASE_PATH}/login`;
  };

  // Waiters only ever see Tables, so they get no menu: just Log out.
  if (!isManager) {
    return (
      <header className="sticky top-0 z-20 bg-forest pt-[env(safe-area-inset-top)] text-white">
        <nav className="mx-auto flex h-14 max-w-3xl items-center justify-between px-2 md:max-w-5xl md:px-4 lg:max-w-6xl">
          <span className="px-2 text-sm font-semibold uppercase tracking-wide text-mango">Staff</span>
          <button
            type="button"
            disabled={busy}
            onClick={logOut}
            className="h-11 rounded-lg px-3 text-[15px] font-medium active:bg-white/10 disabled:opacity-60"
          >
            Log out
          </button>
        </nav>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 bg-forest pt-[env(safe-area-inset-top)] text-white">
      <nav className="relative mx-auto flex h-14 max-w-3xl items-center px-2 md:max-w-5xl md:px-4 lg:max-w-6xl">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="staff-menu"
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 items-center gap-1.5 rounded-lg pl-1.5 pr-3 active:bg-white/10"
        >
          <MenuIcon width={22} height={22} />
          <span className="text-sm font-semibold uppercase tracking-wide text-mango">Staff</span>
        </button>

        {open && (
          <>
            {/* Tapping anywhere off the menu closes it. */}
            <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-0 cursor-default" />
            <ul id="staff-menu" className="absolute left-2 top-full z-10 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 text-ink shadow-[0_12px_32px_rgb(59_46_37/0.25)]">
              {links.map((l) => {
                const here = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={here ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`${item} ${here ? "font-semibold text-leaf" : "font-medium"}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
              <li role="separator" className="my-1 border-t border-line" />
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onClick={logOut}
                  className={`${item} font-medium text-chili`}
                >
                  Log out
                </button>
              </li>
            </ul>
          </>
        )}
      </nav>
    </header>
  );
}

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel: string;
  /** Red confirm button, for things that remove or end something. */
  danger?: boolean;
};

/**
 * The app's own "are you sure?" in place of window.confirm, which looks like
 * the browser talking, not the app. `await confirm({...})` resolves true or
 * false; render `dialog` once anywhere in the screen.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolve = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((res) => {
        resolve.current?.(false);
        resolve.current = res;
        setOptions(o);
      }),
    []
  );
  const done = (ok: boolean) => {
    resolve.current?.(ok);
    resolve.current = null;
    setOptions(null);
  };

  return { confirm, dialog: <ConfirmDialog options={options} onDone={done} /> };
}

function ConfirmDialog({ options, onDone }: { options: ConfirmOptions | null; onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Keep the words up while it closes, after the parent has dropped them.
  const last = useRef(options);
  if (options) last.current = options;
  const o = last.current;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (options && !d.open) {
      d.showModal();
      // showModal focuses the first button (Remove); start on Cancel instead,
      // so a stray Enter cancels rather than removes.
      cancelRef.current?.focus();
    }
    else if (!options && d.open) d.close();
  }, [options]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onDone(false);
      }}
      onClick={(e) => {
        // A tap on the backdrop lands on the dialog itself, not the card.
        if (e.target === e.currentTarget) onDone(false);
      }}
      className="m-auto w-[min(380px,calc(100%-32px))] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_20px_50px_rgb(59_46_37/0.35)] backdrop:bg-forest/60"
    >
      {o && (
        <div className="p-5">
          <h2 id="confirm-title" className="font-display text-[22px] font-bold leading-tight">
            {o.title}
          </h2>
          {o.body && <p className="mt-1.5 text-[15px] text-muted">{o.body}</p>}
          <button
            type="button"
            onClick={() => onDone(true)}
            className={`mt-5 h-[52px] w-full rounded-xl text-[17px] font-semibold text-white ${
              o.danger ? "bg-chili active:bg-chili/85" : "bg-leaf active:bg-leaf-dark"
            }`}
          >
            {o.confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onDone(false)}
            className="mt-1 h-11 w-full rounded-xl text-[15px] font-medium text-muted active:bg-wash"
          >
            Cancel
          </button>
        </div>
      )}
    </dialog>
  );
}

/** A thin warning under the header when the last refresh failed. */
export function OfflineNote({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <p role="status" className="bg-mango-soft px-4 py-2 text-center text-sm text-ink">
      Can&apos;t reach the server. Showing the last orders we got; retrying…
    </p>
  );
}
