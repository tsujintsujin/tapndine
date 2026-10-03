import type { SVGProps } from "react";

// Hand-drawn style food line art for the homepage's background, like the
// doodles on a cafe's printed menu. Decorative only.

type P = SVGProps<SVGSVGElement>;

function Doodle({ children, ...p }: P) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const Bowl = (p: P) => (
  <Doodle {...p}>
    <path d="M6 22h36c0 10-8 17-18 17S6 32 6 22z" />
    <path d="M18 39l-2 4h16l-2-4" />
    <path d="M17 6c-2 3 2 5 0 8M24 4c-2 3 2 5 0 8M31 6c-2 3 2 5 0 8" />
    <path d="M12 27c2 3 5 5 9 6" />
  </Doodle>
);

export const Cutlery = (p: P) => (
  <Doodle {...p}>
    <path d="M13 5v11a4 4 0 0 0 8 0V5M17 5v38" />
    <path d="M33 5c-4 0-6 4-6 9s2 8 6 8 6-3 6-8-2-9-6-9zM33 22v21" />
  </Doodle>
);

export const Chili = (p: P) => (
  <Doodle {...p}>
    <path d="M9 37c13 1 25-9 27-22 .3-2.4-2.6-3.2-3.6-1C29 22 21 30 10 32c-2.6.5-3.2 4.8-1 5z" />
    <path d="M34 13c0-4 2-6 5-7M30 14c1-2 4-2 6 0" />
  </Doodle>
);

export const Leaf = (p: P) => (
  <Doodle {...p}>
    <path d="M8 40C8 20 20 8 40 8c0 20-12 32-32 32z" />
    <path d="M8 40l20-20M18 30v-7M24 24h7" />
  </Doodle>
);

export const Drink = (p: P) => (
  <Doodle {...p}>
    <path d="M11 15h26l-3 28H14z" />
    <path d="M9 15h30M26 15l4-11h6" />
    <path d="M14 26h20" />
    <circle cx="20" cy="33" r="1.5" />
    <circle cx="27" cy="37" r="1.5" />
  </Doodle>
);

export const Fish = (p: P) => (
  <Doodle {...p}>
    <path d="M4 24c6-8 14-11 22-9 5 1 9 4 12 9-3 5-7 8-12 9-8 2-16-1-22-9z" />
    <path d="M38 24l7-6v12z" />
    <path d="M14 20c2 2 2 6 0 8" />
    <circle cx="11" cy="23" r="1" />
  </Doodle>
);

export const Shrimp = (p: P) => (
  <Doodle {...p}>
    <path d="M14 10c12-2 24 6 24 18 0 6-4 10-9 10-4 0-6-3-5-6" />
    <path d="M14 10c-3 1-5 4-4 7l4 2M20 11l-2 8M27 14l-4 7M33 19l-5 6M37 26h-7" />
    <path d="M24 32l-6 5 4 2" />
    <path d="M12 12C8 8 5 7 3 8M13 15c-5-2-8-1-9 1" />
  </Doodle>
);
