import Link from "next/link";
import { Wordmark } from "@/app/components/Wordmark";

// Plain pieces of the manager screens, usable from server and client
// components alike (Shell.tsx is a client module, so constants exported
// from there arrive on the server as client references, not strings).

export function Logo({ href = "/admin/dashboard", light }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className={`flex items-center rounded-xl px-1 py-2 text-[28px] leading-none ${light ? "text-white" : "text-home-cocoa"}`}>
      <Wordmark />
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

/**
 * An empty list drawn as faded rows the shape of what will fill it (with a
 * photo square for dishes), then what to do first. Decorative: screen readers
 * get only the words.
 */
export function SkeletonList({
  photo = false,
  title,
  text,
  children,
}: {
  photo?: boolean;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <ul aria-hidden="true" className="space-y-2.5">
        {[1, 0.6, 0.3].map((o, i) => (
          <li key={i} style={{ opacity: o }} className="flex items-center gap-4 rounded-2xl border border-dashed border-line px-3 py-3">
            {photo && <span className="h-14 w-14 shrink-0 rounded-2xl bg-wash md:h-16 md:w-16" />}
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-2/5 rounded-full bg-wash" />
              <span className="block h-3 w-3/5 rounded-full bg-wash" />
            </span>
            <span className="h-3.5 w-14 shrink-0 rounded-full bg-wash" />
          </li>
        ))}
      </ul>
      <div className="mx-auto mt-6 max-w-sm text-center">
        <p className="font-display text-[20px] font-bold">{title}</p>
        <p className="mt-1 text-[15px] text-muted">{text}</p>
        {children && <div className="mt-4 flex flex-wrap justify-center gap-2.5">{children}</div>}
      </div>
    </div>
  );
}
