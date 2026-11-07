import { useState } from "react";
import type { Dish } from "@/lib/menu";
import { ChiliIcon, NoChiliIcon, PlateIcon } from "@/app/components/Icons";

// Photos are stored full size (often 1200px wide). Cloudinary makes smaller
// copies on request, so a 160px card on a phone on mobile data loads a 20 KB
// photo, not an 80 KB one.
const DELIVERY = "/upload/f_auto,q_auto/";
const WIDTHS = [240, 480, 720, 960];

/** The photo at most `width` pixels wide; a URL that isn't one of ours as it is. */
export const photoUrl = (url: string, width: number) =>
  url.includes(DELIVERY) ? url.replace(DELIVERY, `/upload/f_auto,q_auto,c_limit,w_${width}/`) : url;

/**
 * A dish photo at a fixed aspect ratio, so the layout never jumps while it
 * loads. No photo yet shows a plain plate. Unavailable dishes are greyed with a
 * label, but stay tappable so the customer can still read about them.
 * `sizes` says how wide it shows, so the browser picks the smallest copy that is sharp.
 */
export function DishImage({
  dish,
  className = "",
  eager = false,
  onDark = false,
  soldOutLabel = true,
  sizes = "(min-width: 1024px) 25vw, 50vw",
}: {
  dish: Dish;
  className?: string;
  eager?: boolean;
  /** On the forest stage the loading box must be dark too, not a pale flash. */
  onDark?: boolean;
  /** Off where the photo is too small for the label and the text says it instead. */
  soldOutLabel?: boolean;
  sizes?: string;
}) {
  const url = dish.imageUrl;
  return (
    <div className={`relative overflow-hidden ${onDark ? "bg-forest-soft" : "bg-wash"} ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(url, 960)}
          srcSet={url.includes(DELIVERY) ? WIDTHS.map((w) => `${photoUrl(url, w)} ${w}w`).join(", ") : undefined}
          sizes={sizes}
          alt=""
          width={960}
          height={717}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${dish.available ? "" : "grayscale opacity-60"}`}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted/60">
          <PlateIcon width={36} height={36} />
        </div>
      )}
      {!dish.available && soldOutLabel && (
        <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
          Not Available Today
        </span>
      )}
    </div>
  );
}

/**
 * The dish sheet's photo: the cover plus up to two more, swiped sideways. The
 * strip follows the finger and snaps to a photo (CSS scroll snap); the dots
 * show which one is up. One photo or none looks exactly like DishImage.
 * Photos 2 and 3 load lazily, as the guest swipes toward them.
 */
export function DishPhotos({ dish, className = "", sizes }: { dish: Dish; className?: string; sizes: string }) {
  const [at, setAt] = useState(0);
  const urls = [dish.imageUrl, ...dish.moreImages].filter((u): u is string => !!u);
  if (urls.length < 2) return <DishImage dish={dish} eager sizes={sizes} className={className} />;
  return (
    <div className={`relative overflow-hidden bg-wash ${className}`}>
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`Photos of ${dish.name}`}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leaf"
      >
        {urls.map((u, i) => (
          <div key={u} aria-label={`Photo ${i + 1} of ${urls.length}`} className="relative h-full w-full shrink-0 snap-center snap-always">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(u, 960)}
              srcSet={u.includes(DELIVERY) ? WIDTHS.map((w) => `${photoUrl(u, w)} ${w}w`).join(", ") : undefined}
              sizes={sizes}
              alt=""
              width={960}
              height={717}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              draggable={false}
              className={`absolute inset-0 h-full w-full object-cover ${dish.available ? "" : "grayscale opacity-60"}`}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
        {urls.map((u, i) => (
          <span
            key={u}
            className={`h-1.5 rounded-full shadow-[0_0_3px_rgb(0_0_0/0.45)] transition-[width,background-color] duration-200 ${
              i === at ? "w-4 bg-white" : "w-1.5 bg-white/60"
            }`}
          />
        ))}
      </div>
      {!dish.available && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
          Not Available Today
        </span>
      )}
    </div>
  );
}

/**
 * Five chilies with `level` of them lit. Not spicy at all is a single
 * struck-through chili rather than five empty ones.
 */
export function SpiceMeter({ level }: { level: number }) {
  if (level <= 0) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <NoChiliIcon width={22} height={22} />
        <span className="text-sm">Not spicy</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="img" aria-label={`Spice level ${level} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <ChiliIcon
            key={n}
            lit={n <= level}
            width={22}
            height={22}
            className={n <= level ? "text-chili" : "text-muted/35"}
          />
        ))}
      </div>
      <span className="text-sm text-muted" aria-hidden="true">
        {level} of 5
      </span>
    </div>
  );
}
