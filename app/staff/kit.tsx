import Link from "next/link";
import { ClocheIcon } from "@/app/components/Icons";

// Plain pieces of the manager screens, usable from server and client
// components alike (Shell.tsx is a client module, so constants exported
// from there arrive on the server as client references, not strings).

export function Logo({ href = "/staff/dashboard", light }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
      <span className={`grid h-10 w-10 place-items-center rounded-full text-mango ${light ? "bg-white/10" : "bg-forest"}`}>
        <ClocheIcon width={22} height={22} />
      </span>
      <span className={`font-display text-[22px] font-bold tracking-tight ${light ? "text-white" : "text-forest"}`}>Tap&apos;N&apos;Dine</span>
    </Link>
  );
}

/** The page's title row: what this is, one line on what it's for, and its main actions. */
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-display text-[32px] font-bold leading-tight tracking-tight sm:text-[38px]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Pill buttons, as in the page head. */
export const btn = {
  primary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-[15px] font-semibold text-white hover:bg-forest-soft disabled:opacity-60",
  secondary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-forest/80 bg-white px-5 text-[15px] font-semibold text-forest hover:bg-leaf-tint disabled:opacity-60",
  danger:
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold text-chili hover:bg-chili/10 disabled:opacity-60",
};

export const card = "rounded-[22px] bg-white p-5 shadow-[0_1px_2px_rgb(16_52_42/0.06)]";
