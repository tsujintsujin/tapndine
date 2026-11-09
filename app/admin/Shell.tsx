"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import {
  CardIcon,
  ChatIcon,
  ClocheIcon,
  CloseIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  HomepageIcon,
  LogoutIcon,
  MenuIcon,
  NfcIcon,
  PeopleIcon,
  ReceiptIcon,
  SlidersIcon,
  TableIcon,
  TagIcon,
} from "@/app/components/Icons";
import type { Due } from "@/lib/plans";
import { daysLeft } from "@/lib/trial";
import { useAlerts, useTickets } from "./Alerts";
import DuePrompt from "./DuePrompt";
import Guide from "./Guide";
import { Logo } from "./kit";
import { api, useStaffInfo } from "./ui";

// The manager's frame, desktop first: a sidebar beside one big content
// panel. Below lg the sidebar folds into a top bar with a drawer.

const GROUPS = [
  {
    label: "Restaurant",
    links: [
      { href: "/admin/dashboard", label: "Dashboard", Icon: GridIcon },
      { href: "/admin", label: "Tables", Icon: TableIcon },
      { href: "/admin/links", label: "Menu links", Icon: NfcIcon },
      { href: "/admin/menu", label: "Menu", Icon: ClocheIcon },
      { href: "/admin/homepage", label: "Homepage", Icon: HomepageIcon },
      { href: "/admin/categories", label: "Categories", Icon: TagIcon },
    ],
  },
  { label: "Team", links: [{ href: "/admin/manage", label: "Staff", Icon: PeopleIcon }] },
  {
    label: "Settings",
    links: [
      { href: "/admin/settings", label: "General", Icon: SlidersIcon },
      // On the free trial this link reads "Free trial: N days" instead (Nav).
      { href: "/admin/plan", label: "Subscription", Icon: CardIcon },
      { href: "/admin/support", label: "Support", Icon: HelpIcon },
    ],
  },
];
/** Above every restaurant, for developers only. */
const DEVELOPER = {
  label: "Developer",
  links: [
    { href: "/admin/dev", label: "All restaurants", Icon: HomeIcon },
    { href: "/admin/dev/tickets", label: "Tickets", Icon: ChatIcon },
    { href: "/admin/dev/billing", label: "Billing", Icon: ReceiptIcon },
  ],
};

/** "6 days", "Last day", "Ended": the days a plan has left, beside the Subscription link. */
const dueShort = (left: number) => (left > 1 ? `${left} days` : left === 1 ? "Last day" : "Ended");

/** The same, said in full for screen readers. */
export function dueSentence(d: Due) {
  const what = d.kind === "trial" ? "Your free trial" : "Your plan";
  if (d.left > 1) return `${what} ends in ${d.left} days.`;
  if (d.left === 1) return `${what} ends today.`;
  return d.kind === "plan" && d.closesIn > 0
    ? `${what} has ended. Your menu closes in ${d.closesIn} ${d.closesIn === 1 ? "day" : "days"}.`
    : `${what} has ended.`;
}

/** Yellow at 7 days or fewer, red at 3 or fewer (and once a plan has ended). Colour is backed by text beside it. */
function DueDot({ level }: { level: "soon" | "urgent" }) {
  return <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${level === "urgent" ? "bg-chili" : "bg-mango"}`} />;
}

/** The link is "here" on its own page and the pages under it (a table, a dish). */
const isHere = (href: string, path: string) =>
  href === "/admin"
    ? path === "/admin" || path.startsWith("/admin/t/")
    : // Billing lives under /admin/dev, so All restaurants is only its own page.
      href === "/admin/dev"
      ? path === href
      : path === href || path.startsWith(href + "/");

function Nav({ name, onGo }: { name: string; onGo?: () => void }) {
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const { developer, restaurant, trialEndsAt, due } = useStaffInfo();
  const { needYou, support } = useAlerts();
  const { unread: tickets } = useTickets();
  /** The count on a link, and what it counts for a screen reader. */
  const badges: Record<string, [number, string]> = {
    "/admin": [needYou, needYou === 1 ? "table needs you" : "tables need you"],
    "/admin/support": [support, support === 1 ? "unread message" : "unread messages"],
    "/admin/dev/tickets": [tickets, tickets === 1 ? "unread message" : "unread messages"],
  };
  const left = trialEndsAt === null ? null : daysLeft(trialEndsAt);
  const trial = left === null ? null : left === 0 ? "Free trial ended" : `Free trial: ${left === 1 ? "last day" : `${left} days`}`;
  // A developer sees their own group, plus the restaurant they have open.
  const groups = [
    ...(developer ? [DEVELOPER] : []),
    ...(restaurant ? GROUPS.map((g, i) => (i === 0 ? { ...g, label: restaurant.name } : g)) : []),
  ];
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Manager" className="mt-9 flex-1 space-y-7">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="truncate px-4 text-[13px] text-muted">{g.label}</p>
            <ul className="mt-1.5 space-y-0.5">
              {g.links.map(({ href, label, Icon }) => {
                const here = isHere(href, path);
                return (
                  <li key={href} className="relative">
                    {here && <span aria-hidden="true" className="absolute -left-5 top-1.5 h-8 w-1.5 rounded-r-full bg-forest" />}
                    <Link
                      href={href}
                      onClick={onGo}
                      aria-current={here ? "page" : undefined}
                      className={`flex h-11 items-center gap-3 rounded-xl px-4 text-[15px] ${
                        here ? "font-semibold text-ink" : "font-medium text-muted hover:bg-white/70 hover:text-ink"
                      }`}
                    >
                      <Icon width={21} height={21} className={here ? "text-forest" : ""} />
                      {href === "/admin/plan" && trial ? trial : label}
                      {href === "/admin/plan" && due?.level && (
                        <span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink">
                          {due.kind === "plan" && dueShort(due.left)}
                          <DueDot level={due.level} />
                          <span className="sr-only">{dueSentence(due)}</span>
                        </span>
                      )}
                      {badges[href]?.[0] > 0 && (
                        <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-mango px-1.5 text-[13px] font-bold text-forest">
                          {badges[href][0]}
                          <span className="sr-only"> {badges[href][1]}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line pt-4">
        <p className="px-4 text-[13px] text-muted">Signed in as{developer ? " developer" : ""}</p>
        <p className="truncate px-4 text-[15px] font-semibold">{name}</p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api("/api/staff/logout", { method: "POST", body: {} }).catch(() => {});
            window.location.href = `${BASE_PATH}/login`;
          }}
          className="mt-2 flex h-11 w-full items-center gap-3 rounded-xl px-4 text-[15px] font-medium text-chili hover:bg-chili/10 disabled:opacity-60"
        >
          <LogoutIcon width={21} height={21} />
          Log out
        </button>
      </div>
    </div>
  );
}

export default function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  const { guide, due } = useStaffInfo();
  const { needYou, support } = useAlerts();
  const { unread: tickets } = useTickets();
  const waiting = needYou + support + tickets;
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="theme-green min-h-dvh bg-white text-ink lg:flex lg:gap-3 lg:p-3">
      {/* Desktop sidebar */}
      <aside className="sticky top-3 hidden h-[calc(100dvh-24px)] w-64 shrink-0 flex-col overflow-y-auto rounded-[28px] bg-paper px-5 py-6 lg:flex">
        <Logo />
        <Nav name={name} />
      </aside>

      {/* Phone and tablet: a top bar and a drawer */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          aria-label={(waiting ? `Open menu, ${waiting} waiting for you` : "Open menu") + (due?.level ? `. ${dueSentence(due)}` : "")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="relative grid h-11 w-11 place-items-center rounded-full bg-paper text-forest"
        >
          <MenuIcon width={22} height={22} />
          {due?.level && (
            <span
              aria-hidden="true"
              className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full ring-2 ring-white ${due.level === "urgent" ? "bg-chili" : "bg-mango"}`}
            />
          )}
          {waiting > 0 && (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-mango px-1 text-[12px] font-bold text-forest">
              {waiting}
            </span>
          )}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-forest/50" />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col overflow-y-auto bg-paper px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-white"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </div>
            <Nav name={name} onGo={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Room under the page for the guide's card, so it never hides the end of the page. */}
      <main className={`min-w-0 flex-1 bg-paper px-4 ${guide ? "pb-[340px] lg:pb-[300px]" : "pb-12"} pt-5 sm:px-6 lg:rounded-[28px] lg:px-8 lg:pt-7`}>
        {children}
      </main>
      <Guide />
      <DuePrompt />
    </div>
  );
}
