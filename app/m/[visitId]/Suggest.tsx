"use client";

import { useState } from "react";
import type { Category, Menu } from "@/lib/menu";
import { formatPrice } from "@/lib/format";
import { lineKey, mustPick, resolvePicks } from "@/lib/options";
import { CategoryIcon } from "@/app/components/CategoryIcon";
import { CloseIcon, MinusIcon, PlusIcon } from "@/app/components/Icons";
import Sheet from "./Sheet";
import { DishImage } from "./parts";

type Line = { key: string; dish: { id: string; name: string }; qty: number };

/**
 * "You haven't ordered any drinks": shown on Send to waiter when the order has
 * nothing from a category holding dishes the manager set to Suggest when not
 * ordered, and the guest hasn't sent anything from it before. Those dishes, a +
 * on each. X goes back to My order, and the next Send doesn't ask again.
 * `categories` is fixed when it opens, so adding a drink doesn't empty it.
 */
export default function SuggestSheet({
  open,
  menu,
  categories,
  lines,
  onAdd,
  setQty,
  onClose,
}: {
  open: boolean;
  menu: Menu;
  categories: Category[];
  lines: Line[];
  /** The menu's quick +: straight in, or the dish sheet when a size must be picked. */
  onAdd: (dishId: string) => void;
  setQty: (key: string, qty: number) => void;
  onClose: () => void;
}) {
  // One category: its sub-categories as chips. Several: the categories.
  const [chip, setChip] = useState<string | null>(null);
  const shown = (id: string) => menu.dishes[id]?.suggest && menu.dishes[id].available;
  // A chip with nothing to offer would be a dead end.
  const chips = (categories.length > 1 ? categories : (categories[0]?.subs ?? [])).filter((c) => c.dishIds.some(shown));
  const picked = chips.find((c) => c.id === chip);
  const inAll = new Set((picked ? [picked] : categories).flatMap((c) => c.dishIds));
  const dishes = menu.dishOrder.filter((id) => inAll.has(id) && shown(id)).map((id) => menu.dishes[id]);

  const offered = new Set(categories.flatMap((c) => c.dishIds));
  const added = [...new Set(lines.filter((l) => offered.has(l.dish.id)).map((l) => l.dish.name))];
  const names = categories.map((c) => c.name);

  return (
    <Sheet open={open && categories.length > 0} onClose={onClose} from="bottom" label={names.join(" and ")}>
      <div className="shrink-0 bg-forest pt-[env(safe-area-inset-top)] text-white">
        <div className="flex h-14 items-center justify-between pl-4 pr-2">
          <h2 className="font-display text-xl font-bold">{names.join(" & ")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close, back to my order"
            className="grid h-11 w-11 place-items-center rounded-lg active:bg-white/10"
          >
            <CloseIcon width={22} height={22} />
          </button>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mango/25 text-forest">
            <CategoryIcon name={categories[0]?.name ?? ""} icon={categories[0]?.icon} width={22} height={22} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[19px] font-bold leading-snug">
              You haven&apos;t ordered any {names.join(" or ").toLowerCase()}
            </p>
            <p className="mt-0.5 text-[15px] text-muted">You may want one of these.</p>
          </div>
        </div>
        {chips.length > 0 && (
          <div role="group" aria-label="Show" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-3">
            {[{ id: null, name: "All" }, ...chips].map((c) => {
              const on = c.id === (picked?.id ?? null);
              return (
                <button
                  key={c.id ?? "all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChip(c.id)}
                  className={`h-11 shrink-0 rounded-full border px-4 text-[15px] font-medium ${
                    on ? "border-forest bg-forest text-white" : "border-line bg-white active:bg-wash"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ul className="min-h-0 flex-1 content-start divide-y divide-line overflow-y-auto overscroll-contain border-t border-line px-4 md:grid md:grid-cols-2 md:gap-x-8 md:divide-y-0">
        {dishes.map((d) => {
          // A dish with nothing to pick has one line in the order; that one gets − and +.
          const key = mustPick(d) ? null : lineKey(d.id, resolvePicks(d, []) ?? []);
          const qty = key ? (lines.find((l) => l.key === key)?.qty ?? 0) : 0;
          const anyQty = lines.reduce((n, l) => n + (l.dish.id === d.id ? l.qty : 0), 0);
          return (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <DishImage dish={d} soldOutLabel={false} sizes="56px" className="aspect-square w-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{d.name}</p>
                <p className="truncate text-sm text-muted">{d.shortDescription}</p>
                <p className="text-sm font-semibold">
                  {formatPrice(d.priceCents)}
                  {!qty && anyQty > 0 && <span className="font-normal text-muted"> · {anyQty} in your order</span>}
                </p>
              </div>
              {key && qty > 0 ? (
                <div className="flex shrink-0 items-center rounded-full border border-line">
                  <button
                    type="button"
                    onClick={() => setQty(key, qty - 1)}
                    aria-label={`One less ${d.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full active:bg-wash"
                  >
                    <MinusIcon width={18} height={18} />
                  </button>
                  <span className="w-5 text-center font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(key, qty + 1)}
                    aria-label={`One more ${d.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full active:bg-wash"
                  >
                    <PlusIcon width={18} height={18} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(d.id)}
                  aria-label={`Add ${d.name}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-white active:bg-leaf-dark"
                >
                  <PlusIcon width={20} height={20} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Always there, so adding a drink doesn't move the rows under the guest's thumb. */}
      <div className="shrink-0 border-t border-line px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={added.length === 0}
          className="flex h-[52px] w-full items-center justify-center rounded-xl bg-leaf text-[17px] font-semibold text-white active:bg-leaf-dark disabled:opacity-40"
        >
          Confirm
        </button>
      </div>
    </Sheet>
  );
}
