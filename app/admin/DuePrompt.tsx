"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { today } from "@/lib/plans";
import { useStaffInfo } from "./ui";

const SEEN = "tnd_due_prompt";

/**
 * The red pop-up on opening the staff app when the free trial or the plan has
 * 3 days or fewer left, or has ended and is in its grace days (Justin,
 * 2026-11-08). Owners and managers only, once a day on each browser, never on
 * the Subscription page itself, in the guide, or while the guide is offered.
 * Only the owner can pay, so a manager is told to ask them, with no Buy button.
 */
export default function DuePrompt() {
  const { due, guide, offerGuide, owner } = useStaffInfo();
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (due?.level !== "urgent" || guide || offerGuide || path === "/admin/plan") return;
    const key = `${today()}:${due.kind}:${due.left}`;
    try {
      if (localStorage.getItem(SEEN) === key) return;
      localStorage.setItem(SEEN, key);
    } catch {
      // Private window: show it, it just can't remember.
    }
    setOpen(true);
  }, [due, guide, offerGuide, path]);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  if (!open || !due) return null;
  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const ended = due.left <= 0;
  const title =
    due.kind === "trial"
      ? due.left === 1
        ? "Your free trial ends today"
        : `Your free trial ends in ${days(due.left)}`
      : ended
        ? "Your plan has ended"
        : due.left === 1
          ? "Your plan ends today"
          : `Your plan ends in ${days(due.left)}`;
  const text = !owner
    ? ended && due.kind === "plan"
      ? `Your menu closes to guests in ${days(due.closesIn)}. Ask the account owner to renew.`
      : "Ask the account owner to renew, so your menu stays open to guests."
    : due.kind === "trial"
      ? "Buy a plan to keep your menu, tables and staff open to guests after the trial."
      : ended
        ? `Your menu closes to guests in ${days(due.closesIn)}. Pay for the next month or year to keep it open.`
        : "Pay for the next month or year before then to keep your menu open to guests.";

  return (
    <dialog
      ref={dialog}
      onClose={() => setOpen(false)}
      aria-labelledby="due-title"
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[24px] bg-white p-0 text-ink shadow-[0_24px_60px_-20px_rgb(59_46_37/0.45)] backdrop:bg-forest/50"
    >
      <div className="border-t-[6px] border-chili p-6 sm:p-7">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-chili">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-chili" />
          {due.kind === "trial" ? "Free trial" : "Subscription"}
        </p>
        <h2 id="due-title" className="mt-2 font-display text-[26px] font-bold leading-tight tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-[16px] leading-relaxed text-muted">{text}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {owner ? (
            <>
              <button
                type="button"
                onClick={close}
                className="h-12 rounded-xl border border-line px-5 text-[16px] font-semibold text-ink hover:bg-paper"
              >
                Later
              </button>
              <Link
                href={due.kind === "trial" ? "/admin/plan" : "/admin/plan?term=month"}
                onClick={close}
                className="flex h-12 items-center justify-center rounded-xl bg-forest px-5 text-[16px] font-semibold text-white hover:bg-forest-soft"
              >
                {due.kind === "trial" ? "Buy a plan" : "Pay for next month"}
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={close}
              className="h-12 rounded-xl bg-forest px-5 text-[16px] font-semibold text-white hover:bg-forest-soft"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
