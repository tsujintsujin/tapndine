import type { NetworkId } from "@/lib/socials";

// Each network's mark on its own brand colour, in a circle, as on a phone's
// share sheet. Decorative: the link or label beside it carries the name.
const LOGOS: Record<NetworkId, { bg: string; glyph: React.ReactNode }> = {
  facebook: {
    bg: "#1877F2",
    glyph: <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21z" fill="currentColor" />,
  },
  instagram: {
    bg: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
      </g>
    ),
  },
  x: {
    bg: "#000",
    glyph: <path d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2.2 3h6.2l4.3 5.7zm-1 16.2h1.7L7.3 4.7H5.5z" fill="currentColor" />,
  },
  tiktok: {
    bg: "#000",
    glyph: (
      <path d="M16.6 3h-3v12.2a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.6 5.6 0 1 0 4.8 5.6V9.1a6.9 6.9 0 0 0 3.9 1.2V7.3a3.9 3.9 0 0 1-3.9-4.3z" fill="currentColor" />
    ),
  },
};

export function SocialLogo({ id, className = "h-11 w-11" }: { id: NetworkId; className?: string }) {
  const { bg, glyph } = LOGOS[id];
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full text-white ${className}`} style={{ background: bg }}>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]">
        {glyph}
      </svg>
    </span>
  );
}
