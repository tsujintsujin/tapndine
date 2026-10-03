import type { Dish } from "@/lib/menu";
import { ChiliIcon, NoChiliIcon, PlateIcon } from "@/app/components/Icons";

/**
 * A dish photo at a fixed aspect ratio, so the layout never jumps while it
 * loads. No photo yet shows a plain plate. Unavailable dishes are greyed with a
 * label, but stay tappable so the customer can still read about them.
 */
export function DishImage({
  dish,
  className = "",
  eager = false,
  onDark = false,
}: {
  dish: Dish;
  className?: string;
  eager?: boolean;
  /** On the forest stage the loading box must be dark too, not a pale flash. */
  onDark?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden ${onDark ? "bg-forest-soft" : "bg-wash"} ${className}`}>
      {dish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.imageUrl}
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
      {!dish.available && (
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
            className={n <= level ? "text-chili" : "text-[#C5CBC6]"}
          />
        ))}
      </div>
      <span className="text-sm text-muted" aria-hidden="true">
        {level} of 5
      </span>
    </div>
  );
}
