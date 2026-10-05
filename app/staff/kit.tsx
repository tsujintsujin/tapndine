import Link from "next/link";
import { ClocheIcon } from "@/app/components/Icons";

// Plain pieces of the staff screens, usable from server and client components.

export function Logo({ href = "/staff", light }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
      <span className={`grid h-10 w-10 place-items-center rounded-full text-mango ${light ? "bg-white/10" : "bg-forest"}`}>
        <ClocheIcon width={22} height={22} />
      </span>
      <span className={`font-display text-[22px] font-bold tracking-tight ${light ? "text-white" : "text-forest"}`}>Tap&apos;N&apos;Dine</span>
    </Link>
  );
}
