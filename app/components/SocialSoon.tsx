"use client";

import { useEffect, useState } from "react";

// The footer's Facebook and TikTok icons. The pages are not up yet, so a click
// says "Coming soon" instead of going anywhere. When a page exists, give it its
// href and turn its button into a link.
const NETWORKS = [
  {
    name: "Facebook",
    icon: (
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21z" fill="currentColor" />
    ),
  },
  {
    name: "TikTok",
    icon: (
      <path d="M16.6 3h-3v12.2a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.6 5.6 0 1 0 4.8 5.6V9.1a6.9 6.9 0 0 0 3.9 1.2V7.3a3.9 3.9 0 0 1-3.9-4.3z" fill="currentColor" />
    ),
  },
];

export function SocialSoon() {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div className="flex items-center gap-2">
      {NETWORKS.map((n) => (
        <div key={n.name} className="relative">
          <button
            type="button"
            onClick={() => setShown(n.name)}
            aria-label={`${n.name} (coming soon)`}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-butter"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              {n.icon}
            </svg>
          </button>
          {shown === n.name && (
            <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-home-butter px-3 py-1 text-xs font-bold text-home-cocoa">
              Coming soon
            </span>
          )}
        </div>
      ))}
      <span role="status" className="sr-only">
        {shown ? `${shown} page: coming soon` : ""}
      </span>
    </div>
  );
}
