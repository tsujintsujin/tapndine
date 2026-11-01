"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A modal panel on a native <dialog>: focus stays inside, Esc closes it, and
 * the page behind stops scrolling. `from` picks which edge it enters from.
 * A bottom sheet fills the phone screen; on tablets it is a centred panel.
 *
 * Closing plays the exit motion before the dialog actually closes, and keeps
 * showing the last content meanwhile (the parent has usually dropped it).
 * Reopening mid-exit just reverses the CSS transition from where it is.
 */
export default function Sheet({
  open,
  onClose,
  from,
  label,
  half = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  from: "bottom" | "left" | "right";
  label: string;
  /** From the bottom, but only as tall as its content, so what is behind still shows above it. */
  half?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const last = useRef(children);
  if (open) last.current = children;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      d.removeAttribute("data-closing");
      // Paint it off-screen first, then slide. Starting the transition in the
      // same frame as mounting the content loses its first half to that
      // frame's work, and the panel jumps in from halfway.
      if (!d.open) {
        d.setAttribute("data-entering", "");
        d.showModal();
      }
      let id = requestAnimationFrame(() => {
        id = requestAnimationFrame(() => d.removeAttribute("data-entering"));
      });
      return () => cancelAnimationFrame(id);
    }
    if (!d.open) return;
    d.removeAttribute("data-entering");
    d.setAttribute("data-closing", "");
    const panel = d.firstElementChild as HTMLElement;
    let cancelled = false;
    // No running transition (reduced motion) means this resolves at once.
    Promise.all(panel.getAnimations().map((a) => a.finished)).then(
      () => {
        if (cancelled) return;
        d.close();
        d.removeAttribute("data-closing");
        setShown(false);
      },
      () => {} // reversed by a reopen
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  const panel =
    from === "bottom" && half
      ? "absolute inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[26px] sm:mx-auto sm:w-[min(520px,100%)]"
      : from === "bottom"
      ? "absolute inset-0 sm:m-auto sm:h-fit sm:max-h-[88dvh] sm:w-[min(560px,calc(100%-48px))] sm:rounded-[20px] md:h-[min(620px,88dvh)] md:w-[min(920px,calc(100%-48px))]"
      : from === "left"
        ? "absolute inset-y-0 left-0 w-[min(320px,86vw)]"
        : "absolute inset-y-0 right-0 w-[min(400px,92vw)]";

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onCancel={(e) => {
        // Esc: let the parent decide, so the URL stays in step.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A tap on the backdrop lands on the dialog itself, not the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`sheet-panel flex flex-col overflow-hidden bg-white ${panel}`}
        data-from={from}
      >
        {shown ? last.current : null}
      </div>
    </dialog>
  );
}
