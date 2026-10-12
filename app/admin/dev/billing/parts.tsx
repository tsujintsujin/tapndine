import type { Standing } from "@/lib/billing";
import { formatPrice } from "@/lib/format";

// Small pieces both Billing pages use. Plain functions, safe on the server
// and in the browser.

/** "8 Oct 2026" from "2026-10-08". */
export const day = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-PH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** What the standing says, and how loudly. */
export function standingText(s: Standing): { label: string; detail: string; tone: "bad" | "warn" | "good" | "plain" } {
  switch (s.kind) {
    case "due":
      return { label: "Payment due", detail: `${formatPrice(s.owedCents)} not paid yet`, tone: "bad" };
    case "expired":
      return { label: "Contract ended", detail: `Ended ${day(s.endedOn)}`, tone: "bad" };
    case "renew":
      return {
        label: "Renew soon",
        detail: s.days === 0 ? `Ends today` : `Ends ${day(s.endsOn)}, in ${s.days} ${s.days === 1 ? "day" : "days"}`,
        tone: "warn",
      };
    case "none":
      return { label: "No contract", detail: "Nothing recorded yet", tone: "plain" };
    case "starts":
      return { label: "Signed", detail: `Starts ${day(s.startsOn)}`, tone: "good" };
    case "paid":
      return { label: "Paid", detail: `Covered until ${day(s.endsOn)}`, tone: "good" };
  }
}

const TONES = {
  bad: "bg-chili/10 text-chili",
  warn: "bg-mango-soft text-ink",
  good: "bg-leaf-tint text-leaf",
  plain: "bg-wash text-muted",
};

export function StandingBadge({ standing }: { standing: Standing }) {
  const t = standingText(standing);
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONES[t.tone]}`}>{t.label}</span>;
}
