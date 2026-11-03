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
