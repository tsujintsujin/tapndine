"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/base";
import {
  ClocheIcon,
  CloseIcon,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  NfcIcon,
  PeopleIcon,
  ReceiptIcon,
  TableIcon,
  TagIcon,
} from "@/app/components/Icons";
import { Logo } from "./kit";
import { api, useStaffInfo } from "./ui";

// The manager's frame, desktop first: a sidebar beside one big content
// panel. Below lg the sidebar folds into a top bar with a drawer.

const GROUPS = [
  {
    label: "Restaurant",
    links: [
      { href: "/staff/dashboard", label: "Dashboard", Icon: GridIcon },
      { href: "/staff", label: "Tables", Icon: TableIcon },
      { href: "/staff/links", label: "NFC links", Icon: NfcIcon },
      { href: "/staff/menu", label: "Menu", Icon: ClocheIcon },
      { href: "/staff/categories", label: "Categories", Icon: TagIcon },
    ],
  },
  { label: "Team", links: [{ href: "/staff/manage", label: "Staff", Icon: PeopleIcon }] },
];
/** Above every restaurant, for developers only. */
const DEVELOPER = {
  label: "Developer",
  links: [
    { href: "/staff/dev", label: "All restaurants", Icon: HomeIcon },
    { href: "/staff/dev/billing", label: "Billing", Icon: ReceiptIcon },
  ],
};

/** The link is "here" on its own page and the pages under it (a table, a dish). */
const isHere = (href: string, path: string) =>
  href === "/staff"
    ? path === "/staff" || path.startsWith("/staff/t/")
    : // Billing lives under /staff/dev, so All restaurants is only its own page.
      href === "/staff/dev"
      ? path === href
      : path === href || path.startsWith(href + "/");

function Nav({ name, onGo }: { name: string; onGo?: () => void }) {
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const { developer, restaurant } = useStaffInfo();
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
                      {label}
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
            window.location.href = `${BASE_PATH}/staff/login`;
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
      <aside className="sticky top-3 hidden h-[calc(100dvh-24px)] w-64 shrink-0 flex-col rounded-[28px] bg-paper px-5 py-6 lg:flex">
        <Logo />
        <Nav name={name} />
      </aside>

      {/* Phone and tablet: a top bar and a drawer */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-full bg-paper text-forest"
        >
          <MenuIcon width={22} height={22} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-forest/50" />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-paper px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
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

      <main className="min-w-0 flex-1 bg-paper px-4 pb-12 pt-5 sm:px-6 lg:rounded-[28px] lg:px-8 lg:pt-7">{children}</main>
    </div>
  );
}
