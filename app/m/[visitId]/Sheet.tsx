"use client";

import { useEffect, useRef } from "react";

/**
 * A modal panel on a native <dialog>: focus stays inside, Esc closes it, and
 * the page behind stops scrolling. `from` picks which edge it enters from.
 * On tablets a bottom sheet becomes a centred panel instead.
 */
export default function Sheet({
  open,
  onClose,
  from,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  from: "bottom" | "left" | "right";
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add("sheet-open");
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) {
      // Only unlock when no other sheet is still showing.
      if (!document.querySelector("dialog.sheet[open]")) {
        document.documentElement.classList.remove("sheet-open");
      }
    }
  }, [open]);

  const panel =
    from === "bottom"
      ? "absolute inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[20px] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100%-48px))] sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px]"
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
        {open ? children : null}
      </div>
    </dialog>
  );
}
