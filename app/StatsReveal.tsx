"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

/**
 * A homepage statistics capture that draws itself in once, when it scrolls into
 * view: the real chart (`full`) is laid over an empty copy of it (`base`) in
 * slices, one per hour column or day bar, given as x ranges in the capture's
 * own pixels. "fade" brings each slice in, "grow" raises it from the baseline.
 * The styles are in globals.css. Without JS, or with reduced motion, the chart
 * is just shown.
 */
export function StatsReveal({
  base,
  full,
  alt,
  width,
  height,
  slices,
  kind,
  className = "",
  imgClassName = "",
}: {
  base: string;
  full: string;
  alt: string;
  width: number;
  height: number;
  slices: [number, number][];
  kind: "fade" | "grow";
  className?: string;
  imgClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.reveal = "wait";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.reveal = "play";
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      <div className="relative">
        <img src={base} alt={alt} width={width} height={height} className={`block h-auto w-full ${imgClassName}`} />
        {slices.map(([x0, x1], i) => (
          <img
            key={x0}
            src={full}
            alt=""
            aria-hidden
            width={width}
            height={height}
            className={`chart-slice ${kind} absolute inset-0 h-full w-full ${imgClassName}`}
            style={{ "--l": `${(x0 / width) * 100}%`, "--r": `${100 - (x1 / width) * 100}%`, "--i": i } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
